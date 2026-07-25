import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { toObjectId } from '../../_lib/mongo.js';
import { loadAssignmentWithAccess } from '../[id].js';
import { extractDriveId, findOrCreateSubfolder, createFile, trashFile, exportAsPdf } from '../../_lib/googleDrive.js';
import { insertTextInDoc } from '../../_lib/googleDocsSlides.js';

// Genera un Google Doc con las etiquetas/valores de esta instancia de
// subformulario (no hay una plantilla que rellenar, a diferencia del
// vaciamiento del documento completo) y lo descarga como Doc o como PDF —
// es una descarga de referencia para el diseñador, no el entregable final.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const formato = req.query.formato === 'pdf' ? 'pdf' : 'doc';
  const { db, assignment } = await loadAssignmentWithAccess(auth, id);

  const admin = supabaseAdmin();
  const { data: project } = await admin
    .from('projects')
    .select('drive_folder_url')
    .eq('id', assignment.project_id)
    .single();
  const folderId = extractDriveId(project?.drive_folder_url);
  if (!folderId) throw new ApiError(400, 'El proyecto no tiene carpeta de Drive configurada');

  const subform = await db.collection('subforms').findOne({ _id: toObjectId(assignment.subform_id) });
  const docData = await db.collection('document_data').findOne({ document_id: assignment.document_id });
  const instance = docData?.values?.[assignment.field_variable]?.instances?.find(
    (i) => i.id === assignment.instance_id
  );
  const values = instance?.values || {};

  const lines = (subform?.fields || []).map((f) => {
    const v = values[f.variable];
    const text = Array.isArray(v) ? v.join(', ') : v ?? '';
    return `${f.label}: ${text}`;
  });
  const text = `${assignment.subform_nombre} — ${assignment.document_codigo}\n\n${lines.join('\n')}`;

  const subfolderId = await findOrCreateSubfolder(folderId, assignment.document_codigo);
  const resourcesFolderId = await findOrCreateSubfolder(subfolderId, 'recursos multimedia');
  const typeFolderId = await findOrCreateSubfolder(resourcesFolderId, assignment.subform_nombre);

  const doc = await createFile(
    `${assignment.subform_nombre} - ${assignment.document_codigo}`,
    'application/vnd.google-apps.document',
    typeFolderId
  );
  await insertTextInDoc(doc.id, text);

  if (formato === 'doc') {
    return res.status(200).json({ url: doc.webViewLink });
  }

  const pdfBuffer = await exportAsPdf(doc.id);
  try {
    await trashFile(doc.id); // solo era un paso intermedio para generar el PDF
  } catch {
    // no crítico
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${assignment.subform_nombre}-${assignment.document_codigo}.pdf"`
  );
  res.end(pdfBuffer);
});
