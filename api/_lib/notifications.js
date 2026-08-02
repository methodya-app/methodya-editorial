import { sendEmail } from './email.js';

// URL pública del FRONTEND (distinta de PUBLIC_BACKEND_URL, que es la del
// backend usada por QStash) — arma el link absoluto dentro del correo.
// La app usa HashRouter, por eso "#" antes de la ruta.
function absoluteLink(link) {
  if (!link) return null;
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!base) {
    console.warn('FRONTEND_URL no está configurado: el correo se enviará sin link.');
    return null;
  }
  return `${base}/#${link}`;
}

function emailHtml({ title, body, link }) {
  const url = absoluteLink(link);
  return (
    `<div style="font-family: sans-serif; color: #211B36; max-width: 480px;">` +
    `<p style="font-size: 16px; font-weight: 600; margin: 0 0 12px;">${title}</p>` +
    (body ? `<p style="font-size: 14px; color: #5B6472; white-space: pre-line; margin: 0 0 16px;">${body}</p>` : '') +
    (url
      ? `<a href="${url}" style="display:inline-block; background:#4C1D95; color:#fff; text-decoration:none; ` +
        `padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600;">Ver en METHODYA</a>`
      : '') +
    `</div>`
  );
}

// Crea una notificación en la app para cada destinatario (excluye agentes
// sintéticos y al propio actor) y, si tiene el correo activado, le envía un
// email. Nunca lanza: un fallo acá no debe tumbar la acción que lo disparó.
export async function notifyUsers({
  admin,
  userIds,
  actorId,
  type,
  title,
  body,
  link,
  sourceType,
  sourceId,
  commentId,
}) {
  try {
    const uniqueIds = [...new Set((userIds || []).filter(Boolean))].filter((id) => id !== actorId);
    if (uniqueIds.length === 0) return;

    const { data: recipients, error: profilesError } = await admin
      .from('profiles')
      .select('id, email, is_synthetic, email_notifications_enabled')
      .in('id', uniqueIds);
    if (profilesError) throw profilesError;

    const realRecipients = (recipients || []).filter((p) => !p.is_synthetic);
    if (realRecipients.length === 0) return;

    const rows = realRecipients.map((p) => ({
      user_id: p.id,
      actor_id: actorId || null,
      type,
      title,
      body: body || null,
      link: link || null,
      source_type: sourceType || null,
      source_id: sourceId || null,
      comment_id: commentId || null,
    }));

    const { data: inserted, error: insertError } = await admin
      .from('notifications')
      .insert(rows)
      .select('id, user_id');
    if (insertError) throw insertError;

    await Promise.all(
      realRecipients
        .filter((p) => p.email_notifications_enabled && p.email)
        .map(async (p) => {
          const result = await sendEmail({ to: p.email, subject: title, html: emailHtml({ title, body, link }) });
          if (result.ok) {
            const row = (inserted || []).find((r) => r.user_id === p.id);
            if (row) await admin.from('notifications').update({ email_sent: true }).eq('id', row.id);
          } else {
            console.error(`No se pudo enviar correo a ${p.email}: ${result.error}`);
          }
        })
    );
  } catch (err) {
    console.error('notifyUsers error:', err.message);
  }
}

// Notifica menciones en un comentario nuevo y, si es una respuesta, al
// autor del comentario original (si no está ya entre los mencionados).
// `comment` es el objeto del comentario o de la respuesta recién creada
// (mismo shape en los 3 sistemas: documents/subform-assignments/implementations).
export async function notifyComment({
  admin,
  comment,
  actorId,
  actorNombre,
  threadAuthorId,
  sourceType,
  sourceId,
  link,
}) {
  const mentionIds = Array.isArray(comment.mentions) ? comment.mentions : [];

  if (mentionIds.length > 0) {
    await notifyUsers({
      admin,
      userIds: mentionIds,
      actorId,
      type: 'comment_mention',
      title: `${actorNombre} te mencionó en un comentario`,
      body: comment.text,
      link,
      sourceType,
      sourceId,
      commentId: comment.id,
    });
  }

  if (threadAuthorId && !mentionIds.includes(threadAuthorId)) {
    await notifyUsers({
      admin,
      userIds: [threadAuthorId],
      actorId,
      type: 'comment_reply',
      title: `${actorNombre} respondió tu comentario`,
      body: comment.text,
      link,
      sourceType,
      sourceId,
      commentId: comment.id,
    });
  }
}

// Notifica que a alguien le asignaron una tarea (documento, subformulario o
// implementación), sea por asignación manual o automática.
export async function notifyAssignment({ admin, userId, actorId, roleLabel, codigo, link, sourceType, sourceId }) {
  if (!userId) return;
  await notifyUsers({
    admin,
    userIds: [userId],
    actorId,
    type: 'assignment',
    title: `Te asignaron como ${roleLabel} en ${codigo}`,
    body: `Te asignaron como ${roleLabel} en "${codigo}".`,
    link,
    sourceType,
    sourceId,
    commentId: null,
  });
}
