import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../_lib/mongo.js';

const COLLECTION_BY_SOURCE = {
  document: 'document_data',
  subform_assignment: 'subform_assignments',
  implementation: 'document_implementations',
};

// Encuentra el comentario (o respuesta) referenciado por una notificación
// dentro de su colección de Mongo, para calcular su estado vigente en el
// momento de la consulta (nunca se guarda "congelado" en la notificación).
async function resolveCommentStatus(db, { source_type, source_id, comment_id }) {
  const collectionName = COLLECTION_BY_SOURCE[source_type];
  if (!collectionName || !comment_id) return null;

  const filter =
    source_type === 'document' ? { document_id: source_id } : { _id: toObjectId(source_id) };
  if (!filter._id && source_type !== 'document') return null;

  const doc = await db.collection(collectionName).findOne(filter);
  const comments = doc?.comments || [];

  const top = comments.find((c) => c.id === comment_id);
  if (top) return top.resolved ? 'Cerrado' : (top.replies?.length > 0 ? 'Respondido' : 'Nuevo');

  const parent = comments.find((c) => (c.replies || []).some((r) => r.id === comment_id));
  if (parent) return parent.resolved ? 'Cerrado' : 'Respondido';

  return null; // el comentario ya no existe (documento/tarea eliminado, etc.)
}

// Resuelve, para cada notificación, a qué documento y proyecto pertenece su
// source_type/source_id (documento en Postgres, o subformulario/
// implementación en Mongo) — con consultas agrupadas por tipo en vez de una
// por notificación, para no hacer N+1 con hasta 100 filas.
async function resolveRelatedDocuments(admin, db, notifications) {
  const documentIds = [...new Set(notifications.filter((n) => n.source_type === 'document').map((n) => n.source_id))];
  const subformIds = [...new Set(notifications.filter((n) => n.source_type === 'subform_assignment').map((n) => n.source_id))];
  const implementationIds = [...new Set(notifications.filter((n) => n.source_type === 'implementation').map((n) => n.source_id))];

  const related = new Map(); // `${source_type}:${source_id}` -> { document_codigo, project_id }

  const [documentsResult, subformDocs, implementationDocs] = await Promise.all([
    documentIds.length > 0
      ? admin.from('documents').select('id, codigo, project_id').in('id', documentIds)
      : Promise.resolve({ data: [] }),
    subformIds.length > 0
      ? db
          .collection('subform_assignments')
          .find({ _id: { $in: subformIds.map(toObjectId).filter(Boolean) } })
          .project({ document_codigo: 1, project_id: 1 })
          .toArray()
      : Promise.resolve([]),
    implementationIds.length > 0
      ? db
          .collection('document_implementations')
          .find({ _id: { $in: implementationIds.map(toObjectId).filter(Boolean) } })
          .project({ document_codigo: 1, project_id: 1 })
          .toArray()
      : Promise.resolve([]),
  ]);

  for (const d of documentsResult.data || []) {
    related.set(`document:${d.id}`, { document_codigo: d.codigo, project_id: d.project_id });
  }
  for (const d of subformDocs) {
    related.set(`subform_assignment:${d._id.toString()}`, { document_codigo: d.document_codigo, project_id: d.project_id });
  }
  for (const d of implementationDocs) {
    related.set(`implementation:${d._id.toString()}`, { document_codigo: d.document_codigo, project_id: d.project_id });
  }

  const projectIds = [...new Set([...related.values()].map((r) => r.project_id).filter(Boolean))];
  const { data: projects } =
    projectIds.length > 0 ? await admin.from('projects').select('id, nombre').in('id', projectIds) : { data: [] };
  const projectNameById = new Map((projects || []).map((p) => [p.id, p.nombre]));

  return notifications.map((n) => {
    const info = related.get(`${n.source_type}:${n.source_id}`);
    if (!info) return n;
    return {
      ...n,
      document_codigo: info.document_codigo || null,
      project_id: info.project_id || null,
      project_nombre: projectNameById.get(info.project_id) || null,
    };
  });
}

// Centro de notificaciones del usuario autenticado (comentarios que lo
// mencionan o le responden, y asignaciones de tareas).
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  if (req.method === 'GET') {
    const trashed = req.query.trashed === '1' || req.query.trashed === 'true';

    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .eq('user_id', auth.profile.id)
      .eq('deleted', trashed)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new ApiError(500, error.message);

    const db = await getDb();
    const withRelated = await resolveRelatedDocuments(admin, db, data || []);
    const notifications = await Promise.all(
      withRelated.map(async (n) => ({
        ...n,
        comment_status: n.comment_id ? await resolveCommentStatus(db, n) : null,
      }))
    );

    const unread_count = trashed ? 0 : notifications.filter((n) => !n.read).length;
    return res.status(200).json({ notifications, unread_count });
  }

  if (req.method === 'PUT') {
    const { id, mark_all_read, trash, restore } = req.body || {};

    if (mark_all_read) {
      const { error } = await admin
        .from('notifications')
        .update({ read: true })
        .eq('user_id', auth.profile.id)
        .eq('read', false);
      if (error) throw new ApiError(500, error.message);
      return res.status(200).json({ ok: true });
    }

    if (!id) throw new ApiError(400, 'id es obligatorio');
    const updates = trash ? { deleted: true } : restore ? { deleted: false } : { read: true };

    const { error } = await admin
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.profile.id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
