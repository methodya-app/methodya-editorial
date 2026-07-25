import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { loadAssignmentWithAccess } from '../[id].js';

// Estados del proceso de un subformulario multimedia:
//  Asignado -> En proceso -> Finalizado (exige al menos un recurso cargado)
//  Cualquiera -> Eliminado (papelera, solo Coordinador/Admin) -> Asignado (restaurar)
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { action } = req.body || {};

  const { db, assignment, isCoordinator, isMine } = await loadAssignmentWithAccess(auth, id);

  if (action === 'start') {
    if (!isMine && !isCoordinator) throw new ApiError(403, 'Solo quien tiene la tarea asignada puede iniciarla');
    if (assignment.estado !== 'Asignado') throw new ApiError(409, `No se puede iniciar desde "${assignment.estado}"`);
    await db
      .collection('subform_assignments')
      .updateOne({ _id: assignment._id }, { $set: { estado: 'En proceso', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  if (action === 'finish') {
    if (!isMine && !isCoordinator) throw new ApiError(403, 'Solo quien tiene la tarea asignada puede finalizarla');
    if (assignment.estado !== 'En proceso') {
      throw new ApiError(409, `No se puede finalizar desde "${assignment.estado}"`);
    }
    if (!assignment.recursos || assignment.recursos.length === 0) {
      throw new ApiError(422, 'No se puede finalizar sin haber cargado el recurso resultante');
    }
    await db
      .collection('subform_assignments')
      .updateOne({ _id: assignment._id }, { $set: { estado: 'Finalizado', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  if (action === 'trash') {
    if (!isCoordinator) throw new ApiError(403, 'Requiere ser Coordinador Multimedia o Administrador');
    await db
      .collection('subform_assignments')
      .updateOne({ _id: assignment._id }, { $set: { estado: 'Eliminado', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  if (action === 'restore') {
    if (!isCoordinator) throw new ApiError(403, 'Requiere ser Coordinador Multimedia o Administrador');
    await db
      .collection('subform_assignments')
      .updateOne({ _id: assignment._id }, { $set: { estado: 'Asignado', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(400, `Acción no reconocida: ${action}`);
});
