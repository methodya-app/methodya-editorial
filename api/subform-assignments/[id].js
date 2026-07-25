import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, isProjectMultimediaCoordinator } from '../_lib/auth.js';
import { getDb, toObjectId } from '../_lib/mongo.js';

// Carga una tarea multimedia con acceso: asignada a mí, disponible para mi
// rol (aún sin tomar), o Coordinador Multimedia/Admin del proyecto.
export async function loadAssignmentWithAccess(auth, id) {
  const db = await getDb();
  const oid = toObjectId(id);
  if (!oid) throw new ApiError(400, 'id inválido');
  const assignment = await db.collection('subform_assignments').findOne({ _id: oid });
  if (!assignment) throw new ApiError(404, 'No encontrado');

  const isCoordinator = isProjectMultimediaCoordinator(auth, assignment.project_id);
  const isMine = assignment.assigned_user_id === auth.profile.id;
  const hasRole = auth.multimediaRoles.some(
    (mr) => mr.project_id === assignment.project_id && mr.multimedia_role_id === assignment.multimedia_role_id
  );
  const canClaim = !assignment.assigned_user_id && hasRole;

  if (!isCoordinator && !isMine && !canClaim) {
    throw new ApiError(403, 'No tienes acceso a esta tarea');
  }

  return { db, assignment, isCoordinator, isMine, canClaim };
}

export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { assignment, isCoordinator, isMine, canClaim } = await loadAssignmentWithAccess(auth, id);
  return res.status(200).json({
    assignment: { ...assignment, id: assignment._id.toString(), _id: undefined },
    is_coordinator: isCoordinator,
    is_mine: isMine,
    can_claim: canClaim,
  });
});
