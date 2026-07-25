import { randomUUID } from 'node:crypto';
import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { loadAssignmentWithAccess } from '../[id].js';
import { renameFile, trashFile } from '../../_lib/googleDrive.js';

// Registra/renombra/elimina un recurso (archivo ya subido a Drive vía
// upload-session.js) sobre una tarea multimedia.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { db, assignment, isMine, isCoordinator } = await loadAssignmentWithAccess(auth, id);

  if (!isMine && !isCoordinator) {
    throw new ApiError(403, 'Solo quien tiene la tarea asignada puede administrar sus recursos');
  }

  if (req.method === 'POST') {
    const { drive_file_id, nombre, url, mime_type, size } = req.body || {};
    if (!drive_file_id || !nombre || !url) {
      throw new ApiError(400, 'drive_file_id, nombre y url son obligatorios');
    }
    const recurso = {
      id: randomUUID(),
      drive_file_id,
      nombre,
      url,
      mime_type: mime_type || null,
      size: size || null,
      uploaded_by: auth.profile.id,
      uploaded_at: new Date(),
    };
    await db
      .collection('subform_assignments')
      .updateOne({ _id: assignment._id }, { $push: { recursos: recurso }, $set: { updated_at: new Date() } });
    return res.status(201).json({ recurso });
  }

  if (req.method === 'PUT') {
    const { resource_id, nombre } = req.body || {};
    if (!resource_id || !nombre) throw new ApiError(400, 'resource_id y nombre son obligatorios');
    const recurso = (assignment.recursos || []).find((r) => r.id === resource_id);
    if (!recurso) throw new ApiError(404, 'Recurso no encontrado');

    await renameFile(recurso.drive_file_id, nombre);
    await db.collection('subform_assignments').updateOne(
      { _id: assignment._id, 'recursos.id': resource_id },
      { $set: { 'recursos.$.nombre': nombre, updated_at: new Date() } }
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { resource_id } = req.body || {};
    if (!resource_id) throw new ApiError(400, 'resource_id es obligatorio');
    const recurso = (assignment.recursos || []).find((r) => r.id === resource_id);
    if (!recurso) throw new ApiError(404, 'Recurso no encontrado');

    try {
      await trashFile(recurso.drive_file_id);
    } catch {
      // el archivo ya no existe o no es accesible: igual se quita del registro
    }
    await db
      .collection('subform_assignments')
      .updateOne({ _id: assignment._id }, { $pull: { recursos: { id: resource_id } }, $set: { updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
