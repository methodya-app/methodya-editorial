import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { toObjectId } from '../../_lib/mongo.js';
import { loadImplementationWithAccess } from '../[id].js';

// Vista de solo lectura del documento completo asociado a una tarea de
// implementación. No usa loadDocumentWithAccess (exige ser creador/revisor
// asignado del documento) — el acceso ya se autorizó vía la tarea de
// implementación.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { db, implementation } = await loadImplementationWithAccess(auth, id);

  const admin = supabaseAdmin();
  const { data: document, error } = await admin
    .from('documents')
    .select('id, codigo, estado, project_id, projects(parametrizacion)')
    .eq('id', implementation.document_id)
    .single();
  if (error || !document) throw new ApiError(404, 'Documento no encontrado');

  const docData = await db.collection('document_data').findOne({ document_id: implementation.document_id });
  const form = docData ? await db.collection('forms').findOne({ _id: toObjectId(docData.form_id) }) : null;

  const parametrizacion = document.projects?.parametrizacion || {};
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
    document,
    form,
    values: docData?.values || {},
    project_poblaciones: poblacionesData || [],
    project_temas: parametrizacion.temas_focos?.temas || [],
    project_dotacion_referencias: dotacionData || [],
  });
});
