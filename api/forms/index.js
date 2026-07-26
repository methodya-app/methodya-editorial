import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin, roleInProject } from '../_lib/auth.js';
import { getDb } from '../_lib/mongo.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const db = await getDb();

  if (req.method === 'GET') {
    const { project_id } = req.query;
    if (!project_id) throw new ApiError(400, 'project_id es requerido');
    if (!roleInProject(auth, project_id)) throw new ApiError(403, 'Sin acceso al proyecto');

    const trashed = req.query.trashed === '1';
    const forms = await db
      .collection('forms')
      .find({ project_id, eliminado: trashed ? true : { $ne: true } })
      .sort({ created_at: -1 })
      .toArray();
    return res.status(200).json({ forms });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const { project_id, titulo, descripcion, document_type_id, sections } = req.body || {};
    if (!project_id || !titulo) throw new ApiError(400, 'project_id y titulo son obligatorios');

    const doc = {
      project_id,
      titulo,
      descripcion: descripcion || '',
      document_type_id: document_type_id || null,
      sections: sections || [],
      created_by: auth.profile.id,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await db.collection('forms').insertOne(doc);
    return res.status(201).json({ form: { ...doc, _id: result.insertedId } });
  }

  throw new ApiError(405, 'Método no permitido');
});
