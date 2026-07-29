import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, isProjectImplementationLeader, hasImplementationRole } from '../_lib/auth.js';
import { getDb } from '../_lib/mongo.js';

function serialize(a) {
  return { ...a, id: a._id.toString(), _id: undefined };
}

// Tareas de Implementación (documentos liberados) de un proyecto: por
// defecto, las asignadas al usuario + las disponibles para tomar (si tiene
// algún rol de implementación en ese proyecto). Con ?all=1 (solo Líder de
// implementación/Admin), ve todas las del proyecto.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { project_id } = req.query;
  if (!project_id) throw new ApiError(400, 'project_id es obligatorio');
  const db = await getDb();

  const all = req.query.all === '1';

  if (all && !isProjectImplementationLeader(auth, project_id)) {
    throw new ApiError(403, 'Requiere ser Administrador o Líder de implementación de este proyecto');
  }

  if (all) {
    const items = await db
      .collection('document_implementations')
      .find({ project_id })
      .sort({ created_at: -1 })
      .toArray();
    return res.status(200).json({ implementations: items.map(serialize) });
  }

  const byId = new Map();

  if (hasImplementationRole(auth, project_id)) {
    const assigned = await db
      .collection('document_implementations')
      .find({ project_id, assigned_user_id: auth.profile.id })
      .toArray();
    for (const a of assigned) {
      byId.set(a._id.toString(), { ...serialize(a), assigned_to_me: true, can_claim: false });
    }

    const claimable = await db
      .collection('document_implementations')
      .find({ project_id, assigned_user_id: null })
      .toArray();
    for (const a of claimable) {
      const key = a._id.toString();
      if (!byId.has(key)) byId.set(key, { ...serialize(a), assigned_to_me: false, can_claim: true });
    }
  }

  const implementations = [...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return res.status(200).json({ implementations });
});
