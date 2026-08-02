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

// Centro de notificaciones del usuario autenticado (comentarios que lo
// mencionan o le responden, y asignaciones de tareas).
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .eq('user_id', auth.profile.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new ApiError(500, error.message);

    const db = await getDb();
    const notifications = await Promise.all(
      (data || []).map(async (n) => ({
        ...n,
        comment_status: n.comment_id ? await resolveCommentStatus(db, n) : null,
      }))
    );

    const unread_count = notifications.filter((n) => !n.read).length;
    return res.status(200).json({ notifications, unread_count });
  }

  if (req.method === 'PUT') {
    const { id, mark_all_read } = req.body || {};

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
    const { error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', auth.profile.id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
