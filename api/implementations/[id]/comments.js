import { randomUUID } from 'node:crypto';
import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { loadImplementationWithAccess } from '../[id].js';

// Comentarios sobre una tarea de implementación completa (el documento
// entero, no hay campos separados) — mismo formato que
// api/subform-assignments/[id]/comments.js.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const { id } = req.query;
  const { db, implementation } = await loadImplementationWithAccess(auth, id);

  if (req.method === 'GET') {
    return res.status(200).json({ comments: implementation.comments || [] });
  }

  if (req.method === 'POST') {
    const { text, mentions, reply_to, resolves } = req.body || {};

    if (reply_to) {
      if (!text) throw new ApiError(400, 'text es obligatorio');
      const reply = {
        id: randomUUID(),
        author_id: auth.profile.id,
        author_nombre: `${auth.profile.nombre} ${auth.profile.apellido}`,
        text,
        mentions: Array.isArray(mentions) ? mentions : [],
        resolves: !!resolves,
        created_at: new Date(),
      };
      const update = { $push: { 'comments.$.replies': reply } };
      if (resolves) update.$set = { 'comments.$.resolved': true };

      const result = await db
        .collection('document_implementations')
        .updateOne({ _id: implementation._id, 'comments.id': reply_to }, update);
      if (result.matchedCount === 0) throw new ApiError(404, 'Comentario no encontrado');
      return res.status(201).json({ reply });
    }

    if (!text) throw new ApiError(400, 'text es obligatorio');
    const comment = {
      id: randomUUID(),
      author_id: auth.profile.id,
      author_nombre: `${auth.profile.nombre} ${auth.profile.apellido}`,
      text,
      mentions: Array.isArray(mentions) ? mentions : [],
      resolved: false,
      replies: [],
      created_at: new Date(),
    };
    await db
      .collection('document_implementations')
      .updateOne({ _id: implementation._id }, { $push: { comments: comment } });
    return res.status(201).json({ comment });
  }

  if (req.method === 'PUT') {
    const { comment_id, resolved } = req.body || {};
    if (!comment_id) throw new ApiError(400, 'comment_id es obligatorio');
    await db
      .collection('document_implementations')
      .updateOne(
        { _id: implementation._id, 'comments.id': comment_id },
        { $set: { 'comments.$.resolved': !!resolved } }
      );
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
