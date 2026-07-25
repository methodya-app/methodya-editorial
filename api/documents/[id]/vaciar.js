import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { getDb } from '../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';
import { getGoogleOAuthConfig } from '../../_lib/googleAuth.js';
import {
  extractDriveId,
  findOrCreateSubfolder,
  copyFile,
  getFile,
  trashFile,
  exportAsPdf,
  uploadPdf,
} from '../../_lib/googleDrive.js';
import { replaceVariablesInDoc, replaceVariablesInSlides } from '../../_lib/googleDocsSlides.js';

// El vaciamiento real hace varias llamadas a Google (copiar, reemplazar) y
// tarda varios segundos. Si el clic se dispara dos veces, sin este candado
// se disparan dos vaciamientos en paralelo sobre el mismo documento.
const LOCK_TIMEOUT_MS = 3 * 60 * 1000; // por si un intento anterior quedó a medias sin liberar el candado

// Módulo de vaciamiento (punto 2.1.4 del documento de la beta).
// Si hay una cuenta de Google conectada (Parámetros del servidor) y el
// proyecto tiene plantilla + carpeta de Drive, hace el vaciamiento real
// contra Google Docs/Slides. Si falta cualquiera de esas piezas, cae
// automáticamente a la simulación de texto (igual que antes), para que el
// módulo nunca quede bloqueado por falta de configuración.
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { id } = req.query;
  const access = await loadDocumentWithAccess(auth, id);

  // Según el documento: el botón "Vaciar" lo ve el Administrador (desde el
  // listado de documentos) y el Revisor de Estilo (desde la revisión).
  if (!auth.isAdmin && !access.isRevisorEstilo) {
    throw new ApiError(403, 'Solo el Administrador o el Revisor de Estilo pueden vaciar el documento');
  }

  const db = await getDb();

  // Asegura que exista la fila de datos del documento (sin pisar valores si
  // ya existe), para poder adquirir el candado con una operación atómica.
  await db.collection('document_data').updateOne(
    { document_id: id },
    { $setOnInsert: { document_id: id, values: {}, comments: [] } },
    { upsert: true }
  );

  // Candado atómico: findOneAndUpdate hace el "leer y marcar" en una sola
  // operación de Mongo, así que dos peticiones que lleguen al mismo tiempo
  // (doble clic, doble disparo del evento) no pueden colarse ambas — la
  // segunda simplemente no encuentra ningún documento que cumpla el filtro
  // (porque la primera ya puso vaciado_en_progreso) y recibe null.
  const existing = await db.collection('document_data').findOneAndUpdate(
    {
      document_id: id,
      $or: [
        { vaciado_en_progreso: { $exists: false } },
        { vaciado_en_progreso: { $lt: new Date(Date.now() - LOCK_TIMEOUT_MS) } },
      ],
    },
    { $set: { vaciado_en_progreso: new Date() } },
    { returnDocument: 'before' }
  );
  if (!existing) {
    throw new ApiError(409, 'Ya se está vaciando este documento, espera a que termine.');
  }

  try {
    const project = access.document.projects || {};
    const values = existing?.values || {};

    const googleConfig = await getGoogleOAuthConfig();
    const templateFileId = extractDriveId(project.plantilla_url);
    const folderId = extractDriveId(project.drive_folder_url);
    const canDoReal = !!(googleConfig?.refreshToken && templateFileId && folderId && project.plantilla_tipo);

    const admin = supabaseAdmin();

    if (canDoReal) {
      const { googleFile, pdfFile } = await vaciarReal({
        document: access.document,
        project,
        values,
        templateFileId,
        folderId,
        previousFileId: existing?.vaciado_drive_file_id || null,
        previousPdfFileId: existing?.vaciado_pdf_file_id || null,
        formato: project.vaciado_formato || 'google',
      });

      await db.collection('document_data').updateOne(
        { document_id: id },
        {
          $set: {
            vaciado_resultado: googleFile ? googleFile.webViewLink || googleFile.id : null,
            vaciado_drive_file_id: googleFile ? googleFile.id : null,
            vaciado_pdf_resultado: pdfFile ? pdfFile.webViewLink || pdfFile.id : null,
            vaciado_pdf_file_id: pdfFile ? pdfFile.id : null,
            vaciado_at: new Date(),
          },
        }
      );
      await admin.from('documents').update({ vaciado_at: new Date().toISOString() }).eq('id', id);
      return res.status(200).json({
        vaciado_resultado: googleFile?.webViewLink || null,
        vaciado_pdf_resultado: pdfFile?.webViewLink || null,
        real: true,
      });
    }

    // --- Simulación (sin cuenta de Google o sin plantilla/carpeta de Drive) ---
    const template = project.plantilla_texto_simulado;
    if (!template) {
      throw new ApiError(
        400,
        'El proyecto no tiene plantilla configurada (ni de Google Drive ni de texto simulado). Ve a "Plantilla y vaciamiento".'
      );
    }
    let resultado = template;
    for (const [key, val] of Object.entries(values)) {
      const text = Array.isArray(val) ? val.join(', ') : typeof val === 'object' ? '' : String(val ?? '');
      resultado = resultado.replaceAll(`{{${key}}}`, text);
    }

    await db.collection('document_data').updateOne(
      { document_id: id },
      { $set: { vaciado_resultado: resultado, vaciado_at: new Date() }, $unset: { vaciado_drive_file_id: '' } }
    );
    await admin.from('documents').update({ vaciado_at: new Date().toISOString() }).eq('id', id);
    return res.status(200).json({ vaciado_resultado: resultado, real: false });
  } finally {
    await db.collection('document_data').updateOne({ document_id: id }, { $unset: { vaciado_en_progreso: '' } });
  }
});

// Hace el vaciamiento real: crea (o reutiliza) la subcarpeta con el código
// del documento, copia la plantilla dentro de ella y reemplaza las
// variables {{variable}} por los valores diligenciados. La plantilla
// original nunca se modifica, solo se copia.
//
// Si el documento ya se había vaciado antes (previousFileId), primero se
// genera y se rellena la copia NUEVA por completo, y solo cuando esa copia
// ya quedó lista se envía el archivo anterior a la papelera de Drive (no se
// borra permanentemente, se puede recuperar). Así nunca hay un momento en
// que no exista ningún archivo válido, y no se depende de reimportar
// contenido dentro del archivo anterior (el paso que resultaba frágil).
async function vaciarReal({
  document,
  project,
  values,
  templateFileId,
  folderId,
  previousFileId,
  previousPdfFileId,
  formato,
}) {
  const subfolderId = await findOrCreateSubfolder(folderId, document.codigo);
  const freshCopy = await copyFile(templateFileId, document.codigo, subfolderId);

  if (project.plantilla_tipo === 'slides') {
    await replaceVariablesInSlides(freshCopy.id, values);
  } else {
    await replaceVariablesInDoc(freshCopy.id, values);
  }

  // Trata de enviar a la papelera el/los archivo(s) del vaciamiento
  // anterior; si ya no existe o no es accesible (p. ej. lo borraron
  // manualmente en Drive), no bloquea el vaciamiento nuevo.
  const trashIfExists = async (fileId) => {
    if (!fileId) return;
    try {
      await trashFile(fileId);
    } catch {
      // ignorar
    }
  };

  let googleFile = null;
  let pdfFile = null;

  if (formato === 'google' || formato === 'ambos') {
    await trashIfExists(previousFileId);
    googleFile = await getFile(freshCopy.id);
  }

  if (formato === 'pdf' || formato === 'ambos') {
    const pdfBuffer = await exportAsPdf(freshCopy.id);
    await trashIfExists(previousPdfFileId);
    pdfFile = await uploadPdf(`${document.codigo}.pdf`, pdfBuffer, subfolderId);
  }

  if (formato === 'pdf') {
    // La copia en Google Docs/Slides fue solo un paso intermedio para
    // generar el PDF; si el proyecto solo quiere PDF, no se deja como
    // resultado final.
    await trashIfExists(freshCopy.id);
  }

  return { googleFile, pdfFile };
}
