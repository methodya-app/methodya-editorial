import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';

// Vista de solo lectura del documento completo, pensada para mostrarse en
// un modal sin salir de la pantalla actual (ej. desde la lista de
// Analítica). Mismo shape que subform-assignments/[id]/document-preview.js,
// pero el acceso se resuelve con loadDocumentWithAccess (Administrador o
// creador/revisor asignado) en vez de a través de una tarea multimedia.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const access = await loadDocumentWithAccess(auth, id);

  const admin = supabaseAdmin();
  const db = await getDb();
  const docData = await db.collection('document_data').findOne({ document_id: id });
  // El formulario se busca por el form_id del documento (siempre presente
  // desde su creación), no por el de document_data: un documento sin nada
  // diligenciado aún no tiene fila en document_data, pero igual debe
  // mostrar la estructura del formulario vacía, no un modal en blanco.
  const form = await db.collection('forms').findOne({ _id: toObjectId(access.document.form_id) });

  const parametrizacion = access.document.projects?.parametrizacion || {};
  const allowedPoblacionIds = parametrizacion.poblacion_objetivo?.poblacion_ids || [];
  const allowedDotacionIds = parametrizacion.dotacion?.referencia_ids || [];

  const [{ data: poblacionesData }, { data: dotacionData }] = await Promise.all([
    allowedPoblacionIds.length > 0
      ? admin.from('poblaciones_objetivo').select('*').in('id', allowedPoblacionIds)
      : Promise.resolve({ data: [] }),
    allowedDotacionIds.length > 0
      ? admin.from('dotacion_referencias').select('*, dotacion_tipos(nombre)').in('id', allowedDotacionIds)
      : Promise.resolve({ data: [] }),
  ]);

  return res.status(200).json({
    document: access.document,
    form,
    values: docData?.values || {},
    project_poblaciones: poblacionesData || [],
    project_temas: parametrizacion.temas_focos?.temas || [],
    project_dotacion_referencias: dotacionData || [],
  });
});
