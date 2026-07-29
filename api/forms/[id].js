import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin, roleInProject } from '../_lib/auth.js';
import { getDb, toObjectId } from '../_lib/mongo.js';
import {
  findFieldsMissingCustomMessage,
  findDuplicateVariables,
  findFieldsMissingInstrucciones,
  findInvalidTableFields,
  findTableColumnsMissingCustomMessage,
  findInvalidSubformLimits,
} from '../_lib/validation.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const db = await getDb();
  const oid = toObjectId(req.query.id);
  if (!oid) throw new ApiError(400, 'id inválido');

  if (req.method === 'GET') {
    const form = await db.collection('forms').findOne({ _id: oid });
    if (!form) throw new ApiError(404, 'Formulario no encontrado');
    if (!roleInProject(auth, form.project_id)) throw new ApiError(403, 'Sin acceso al proyecto');
    return res.status(200).json({ form });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const { titulo, descripcion, document_type_id, sections, eliminado, limites_subformularios } = req.body || {};
    const updates = { updated_at: new Date() };
    if (titulo !== undefined) updates.titulo = titulo;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (document_type_id !== undefined) updates.document_type_id = document_type_id;
    if (eliminado !== undefined) updates.eliminado = eliminado;
    if (limites_subformularios !== undefined) {
      const invalidLimits = findInvalidSubformLimits(limites_subformularios);
      if (invalidLimits.length > 0) {
        throw new ApiError(422, 'Falta el tipo de subformulario o el máximo en alguno de los límites configurados.');
      }
      updates.limites_subformularios = limites_subformularios;
    }
    if (sections !== undefined) {
      const allFields = sections.flatMap((s) => s.fields || []);
      const missing = findFieldsMissingCustomMessage(allFields);
      if (missing.length > 0) {
        throw new ApiError(
          422,
          `Falta el mensaje de error personalizado en: ${missing.map((f) => f.label).join(', ')}`
        );
      }
      const missingColumnMessage = findTableColumnsMissingCustomMessage(allFields);
      if (missingColumnMessage.length > 0) {
        throw new ApiError(
          422,
          `Falta el mensaje de error personalizado en una columna de: ${missingColumnMessage.map((f) => f.label).join(', ')}`
        );
      }
      const duplicates = findDuplicateVariables(allFields);
      if (duplicates.length > 0) {
        throw new ApiError(422, `Hay variables repetidas en el formulario: ${duplicates.join(', ')}`);
      }
      const missingInstrucciones = findFieldsMissingInstrucciones(allFields);
      if (missingInstrucciones.length > 0) {
        throw new ApiError(
          422,
          `Falta indicar instrucciones de diligenciamiento en: ${missingInstrucciones.map((f) => f.label).join(', ')}`
        );
      }
      const invalidTables = findInvalidTableFields(allFields);
      if (invalidTables.length > 0) {
        throw new ApiError(
          422,
          `Falta configurar las columnas de la tabla dinámica en: ${invalidTables.map((f) => f.label).join(', ')}`
        );
      }
      updates.sections = sections;
    }

    await db.collection('forms').updateOne({ _id: oid }, { $set: updates });
    const form = await db.collection('forms').findOne({ _id: oid });
    return res.status(200).json({ form });
  }

  if (req.method === 'DELETE') {
    requireAdmin(auth);
    // Eliminación lógica: se envía a la papelera, no se borra físicamente
    // (los documentos ya creados con este formulario siguen funcionando).
    await db.collection('forms').updateOne({ _id: oid }, { $set: { eliminado: true, updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
