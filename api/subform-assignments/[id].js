import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, isProjectMultimediaCoordinator } from '../_lib/auth.js';
import { getDb, toObjectId } from '../_lib/mongo.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { notifyAssignment } from '../_lib/notifications.js';

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
  const auth = await requireAuth(req);
  const { id } = req.query;

  if (req.method === 'GET') {
    const { assignment, isCoordinator, isMine, canClaim } = await loadAssignmentWithAccess(auth, id);
    return res.status(200).json({
      assignment: { ...assignment, id: assignment._id.toString(), _id: undefined },
      is_coordinator: isCoordinator,
      is_mine: isMine,
      can_claim: canClaim,
    });
  }

  // Edición administrativa: título y reasignación de rol/persona, aparte
  // del ciclo normal de estados (transition.js) y de tomar la tarea
  // (claim.js). Solo el Coordinador Multimedia/Administrador del proyecto.
  if (req.method === 'PUT') {
    const { db, assignment, isCoordinator } = await loadAssignmentWithAccess(auth, id);
    if (!isCoordinator) throw new ApiError(403, 'Requiere ser Coordinador Multimedia o Administrador');

    const { titulo, multimedia_role_id, assigned_user_id } = req.body || {};
    const updates = { updated_at: new Date() };
    if (titulo !== undefined) updates.titulo = titulo || null;
    if (multimedia_role_id !== undefined) updates.multimedia_role_id = multimedia_role_id;
    if (assigned_user_id !== undefined) updates.assigned_user_id = assigned_user_id || null;

    await db.collection('subform_assignments').updateOne({ _id: assignment._id }, { $set: updates });
    const updated = await db.collection('subform_assignments').findOne({ _id: assignment._id });

    if (updates.assigned_user_id && updates.assigned_user_id !== assignment.assigned_user_id) {
      const admin = supabaseAdmin();
      const roleId = updates.multimedia_role_id || assignment.multimedia_role_id;
      const { data: role } = await admin.from('multimedia_roles').select('nombre').eq('id', roleId).maybeSingle();
      await notifyAssignment({
        admin,
        userId: updates.assigned_user_id,
        actorId: auth.profile.id,
        roleLabel: role?.nombre || 'multimedia',
        codigo: updated.subform_codigo || updated.document_codigo,
        link: `/multimedia/tarea/${id}`,
        sourceType: 'subform_assignment',
        sourceId: id,
      });
    }

    return res.status(200).json({ assignment: { ...updated, id: updated._id.toString(), _id: undefined } });
  }

  throw new ApiError(405, 'Método no permitido');
});
