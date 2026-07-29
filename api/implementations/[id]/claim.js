import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, hasImplementationRole } from '../../_lib/auth.js';
import { getDb, toObjectId } from '../../_lib/mongo.js';

// Cualquier persona con un rol de implementación en el proyecto puede tomar
// una tarea disponible (sin asignar). Siempre disponible como respaldo, sin
// importar el modo configurado (manual/carga/aleatoria).
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const db = await getDb();
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(400, 'id inválido');

  const implementation = await db.collection('document_implementations').findOne({ _id: oid });
  if (!implementation) throw new ApiError(404, 'No encontrado');
  if (implementation.assigned_user_id) throw new ApiError(409, 'Esta tarea ya tiene a alguien asignado');

  const hasRole = hasImplementationRole(auth, implementation.project_id);
  if (!hasRole && !auth.isAdmin) throw new ApiError(403, 'No tienes un rol de implementación en este proyecto');

  await db
    .collection('document_implementations')
    .updateOne({ _id: oid }, { $set: { assigned_user_id: auth.profile.id, updated_at: new Date() } });

  return res.status(200).json({ ok: true });
});
