import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { getDb, toObjectId } from '../../_lib/mongo.js';

// Cualquier persona con el rol correspondiente puede tomar una tarea
// multimedia disponible (sin asignar). Siempre disponible como respaldo,
// sin importar el modo configurado (manual/carga/aleatoria).
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const db = await getDb();
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(400, 'id inválido');

  const assignment = await db.collection('subform_assignments').findOne({ _id: oid });
  if (!assignment) throw new ApiError(404, 'No encontrado');
  if (assignment.estado === 'Eliminado') throw new ApiError(423, 'Esta tarea está en la papelera');
  if (assignment.assigned_user_id) throw new ApiError(409, 'Esta tarea ya tiene a alguien asignado');

  const hasRole = auth.multimediaRoles.some(
    (mr) => mr.project_id === assignment.project_id && mr.multimedia_role_id === assignment.multimedia_role_id
  );
  if (!hasRole && !auth.isAdmin) throw new ApiError(403, 'No tienes ese rol multimedia en este proyecto');

  await db
    .collection('subform_assignments')
    .updateOne({ _id: oid }, { $set: { assigned_user_id: auth.profile.id, updated_at: new Date() } });

  return res.status(200).json({ ok: true });
});
