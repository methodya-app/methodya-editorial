import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, isProjectMultimediaCoordinator, multimediaRolesInProject } from '../_lib/auth.js';
import { getDb } from '../_lib/mongo.js';

function serialize(a) {
  return { ...a, id: a._id.toString(), _id: undefined };
}

// Tareas del equipo multimedia (instancias de subformulario liberadas) de un
// proyecto: por defecto, las asignadas al usuario + las disponibles para
// tomar en su(s) rol(es). Con ?all=1 o ?trashed=1 (solo Coordinador
// Multimedia/Admin), ve todas las del proyecto o la papelera.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { project_id } = req.query;
  if (!project_id) throw new ApiError(400, 'project_id es obligatorio');
  const db = await getDb();

  const trashed = req.query.trashed === '1';
  const all = req.query.all === '1';

  if ((trashed || all) && !isProjectMultimediaCoordinator(auth, project_id)) {
    throw new ApiError(403, 'Requiere ser Administrador o Coordinador Multimedia de este proyecto');
  }

  if (trashed) {
    const items = await db
      .collection('subform_assignments')
      .find({ project_id, estado: 'Eliminado' })
      .sort({ updated_at: -1 })
      .toArray();
    return res.status(200).json({ assignments: items.map(serialize) });
  }

  if (all) {
    const items = await db
      .collection('subform_assignments')
      .find({ project_id, estado: { $ne: 'Eliminado' } })
      .sort({ created_at: -1 })
      .toArray();
    return res.status(200).json({ assignments: items.map(serialize) });
  }

  const myRoles = multimediaRolesInProject(auth, project_id);
  const byId = new Map();
  for (const role of myRoles) {
    const assigned = await db
      .collection('subform_assignments')
      .find({
        project_id,
        multimedia_role_id: role.id,
        assigned_user_id: auth.profile.id,
        estado: { $ne: 'Eliminado' },
      })
      .toArray();
    for (const a of assigned) {
      byId.set(a._id.toString(), { ...serialize(a), assigned_to_me: true, can_claim: false });
    }

    const claimable = await db
      .collection('subform_assignments')
      .find({ project_id, multimedia_role_id: role.id, assigned_user_id: null, estado: { $ne: 'Eliminado' } })
      .toArray();
    for (const a of claimable) {
      const key = a._id.toString();
      if (!byId.has(key)) byId.set(key, { ...serialize(a), assigned_to_me: false, can_claim: true });
    }
  }

  const assignments = [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return res.status(200).json({ assignments });
});
