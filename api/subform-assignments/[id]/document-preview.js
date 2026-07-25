import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { toObjectId } from '../../_lib/mongo.js';
import { loadAssignmentWithAccess } from '../[id].js';

// Vista de solo lectura del documento completo asociado a una tarea
// multimedia, para dar contexto a quien va a crear el recurso. No usa
// loadDocumentWithAccess (exige ser creador/revisor asignado del
// documento) — el acceso ya se autorizó vía la tarea multimedia.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { db, assignment } = await loadAssignmentWithAccess(auth, id);

  const admin = supabaseAdmin();
  const { data: document, error } = await admin
    .from('documents')
    .select('id, codigo, estado, project_id')
    .eq('id', assignment.document_id)
    .single();
  if (error || !document) throw new ApiError(404, 'Documento no encontrado');

  const docData = await db.collection('document_data').findOne({ document_id: assignment.document_id });
  const form = docData ? await db.collection('forms').findOne({ _id: toObjectId(docData.form_id) }) : null;

  return res.status(200).json({ document, form, values: docData?.values || {} });
});
