import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { loadImplementationWithAccess } from '../[id].js';

// Estados de una tarea de Implementación:
//  Pendiente -> En proceso -> Implementado
//  En proceso <-> Detenido (pausar/reanudar)
// A diferencia de subform_assignments, "finish" no exige ningún recurso
// cargado (acá no hay subida de archivos, es solo lectura + comentarios).
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { action } = req.body || {};

  const { db, implementation, isLider, isMine } = await loadImplementationWithAccess(auth, id);
  const puedeActuar = isMine || isLider;

  if (action === 'start') {
    if (!puedeActuar) throw new ApiError(403, 'Solo quien tiene la tarea asignada puede iniciarla');
    if (implementation.estado !== 'Pendiente') {
      throw new ApiError(409, `No se puede iniciar desde "${implementation.estado}"`);
    }
    await db
      .collection('document_implementations')
      .updateOne({ _id: implementation._id }, { $set: { estado: 'En proceso', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  if (action === 'stop') {
    if (!puedeActuar) throw new ApiError(403, 'Solo quien tiene la tarea asignada puede detenerla');
    if (implementation.estado !== 'En proceso') {
      throw new ApiError(409, `No se puede detener desde "${implementation.estado}"`);
    }
    await db
      .collection('document_implementations')
      .updateOne({ _id: implementation._id }, { $set: { estado: 'Detenido', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  if (action === 'resume') {
    if (!puedeActuar) throw new ApiError(403, 'Solo quien tiene la tarea asignada puede reanudarla');
    if (implementation.estado !== 'Detenido') {
      throw new ApiError(409, `No se puede reanudar desde "${implementation.estado}"`);
    }
    await db
      .collection('document_implementations')
      .updateOne({ _id: implementation._id }, { $set: { estado: 'En proceso', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  if (action === 'finish') {
    if (!puedeActuar) throw new ApiError(403, 'Solo quien tiene la tarea asignada puede finalizarla');
    if (implementation.estado !== 'En proceso') {
      throw new ApiError(409, `No se puede marcar como implementado desde "${implementation.estado}"`);
    }
    await db
      .collection('document_implementations')
      .updateOne({ _id: implementation._id }, { $set: { estado: 'Implementado', updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(400, `Acción no reconocida: ${action}`);
});
