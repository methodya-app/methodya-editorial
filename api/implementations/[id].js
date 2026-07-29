import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, isProjectImplementationLeader, hasImplementationRole } from '../_lib/auth.js';
import { getDb, toObjectId } from '../_lib/mongo.js';

// Carga una tarea de implementación con acceso: asignada a mí, disponible
// para tomar (tengo algún rol de implementación en ese proyecto), o Líder
// de implementación/Admin del proyecto.
export async function loadImplementationWithAccess(auth, id) {
  const db = await getDb();
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(400, 'id inválido');
  const implementation = await db.collection('document_implementations').findOne({ _id: oid });
  if (!implementation) throw new ApiError(404, 'No encontrado');

  const isLider = isProjectImplementationLeader(auth, implementation.project_id);
  const isMine = implementation.assigned_user_id === auth.profile.id;
  const hasRole = hasImplementationRole(auth, implementation.project_id);
  const canClaim = !implementation.assigned_user_id && hasRole;

  if (!isLider && !isMine && !canClaim) {
    throw new ApiError(403, 'No tienes acceso a esta tarea');
  }

  return { db, implementation, isLider, isMine, canClaim };
}

export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { implementation, isLider, isMine, canClaim } = await loadImplementationWithAccess(auth, id);
  return res.status(200).json({
    implementation: { ...implementation, id: implementation._id.toString(), _id: undefined },
    is_lider: isLider,
    is_mine: isMine,
    can_claim: canClaim,
  });
});
