import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { getDb, toObjectId } from '../_lib/mongo.js';
import {
  findFieldsMissingCustomMessage,
  findDuplicateVariables,
  findFieldsMissingInstrucciones,
  findInvalidTableFields,
  findTableColumnsMissingCustomMessage,
} from '../_lib/validation.js';
import { ensureTituloField, normalizePrefijo } from '../_lib/subformDefaults.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const db = await getDb();
  const oid = toObjectId(req.query.id);
  if (!oid) throw new ApiError(400, 'id inválido');

  if (req.method === 'GET') {
    const subform = await db.collection('subforms').findOne({ _id: oid });
    if (!subform) throw new ApiError(404, 'Subformulario no encontrado');
    return res.status(200).json({ subform });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const { nombre, descripcion, prefijo, fields } = req.body || {};
    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (descripcion !== undefined) updates.descripcion = descripcion;
    if (prefijo !== undefined) {
      const normalizedPrefijo = normalizePrefijo(prefijo);
      if (!normalizedPrefijo) {
        throw new ApiError(400, 'prefijo inválido: máximo 5 caracteres, solo letras, números, "-" o "_"');
      }
      updates.prefijo = normalizedPrefijo;
    }
    if (fields !== undefined) {
      const withTitulo = ensureTituloField(fields);
      const missing = findFieldsMissingCustomMessage(withTitulo);
      if (missing.length > 0) {
        throw new ApiError(
          422,
          `Falta el mensaje de error personalizado en: ${missing.map((f) => f.label).join(', ')}`
        );
      }
      const missingColumnMessage = findTableColumnsMissingCustomMessage(withTitulo);
      if (missingColumnMessage.length > 0) {
        throw new ApiError(
          422,
          `Falta el mensaje de error personalizado en una columna de: ${missingColumnMessage.map((f) => f.label).join(', ')}`
        );
      }
      const duplicates = findDuplicateVariables(withTitulo);
      if (duplicates.length > 0) {
        throw new ApiError(422, `Hay variables repetidas en el subformulario: ${duplicates.join(', ')}`);
      }
      const missingInstrucciones = findFieldsMissingInstrucciones(withTitulo);
      if (missingInstrucciones.length > 0) {
        throw new ApiError(
          422,
          `Falta indicar instrucciones de diligenciamiento en: ${missingInstrucciones.map((f) => f.label).join(', ')}`
        );
      }
      const invalidTables = findInvalidTableFields(withTitulo);
      if (invalidTables.length > 0) {
        throw new ApiError(
          422,
          `Falta configurar las columnas de la tabla dinámica en: ${invalidTables.map((f) => f.label).join(', ')}`
        );
      }
      updates.fields = withTitulo;
    }
    await db.collection('subforms').updateOne({ _id: oid }, { $set: updates });
    const subform = await db.collection('subforms').findOne({ _id: oid });
    return res.status(200).json({ subform });
  }

  if (req.method === 'DELETE') {
    requireAdmin(auth);
    await db.collection('subforms').deleteOne({ _id: oid });
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
