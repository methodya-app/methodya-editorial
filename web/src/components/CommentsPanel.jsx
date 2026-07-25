import { useState } from 'react';
import { api } from '../lib/api.js';

// Panel de observaciones/comentarios, similar a los comentarios de
// Word/Google Docs. Se usa dentro de FormRenderer (comentarios por campo de
// un documento) y en las tareas del equipo multimedia (comentarios sobre
// toda la tarea, sin campo específico). `apiBase` es la ruta base del
// recurso (ej. `/documents/:id` o `/subform-assignments/:id`); si no se pasa
// `fieldId`, no se filtra por campo (se muestran/crean todos los
// comentarios del recurso).
export default function CommentsPanel({ apiBase, fieldId, comments, projectUsers, canComment, canResolve, onChange }) {
  const [text, setText] = useState('');
  const [mentionId, setMentionId] = useState('');
  const [sending, setSending] = useState(false);

  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyMentions, setReplyMentions] = useState([]);
  const [replyResolves, setReplyResolves] = useState(false);
  const [replySending, setReplySending] = useState(false);

  const fieldComments = fieldId ? (comments || []).filter((c) => c.field_id === fieldId) : comments || [];

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`${apiBase}/comments`, {
        field_id: fieldId,
        text,
        mentions: mentionId ? [mentionId] : [],
      });
      setText('');
      setMentionId('');
      onChange?.();
    } finally {
      setSending(false);
    }
  };

  const resolve = async (commentId, resolved) => {
    await api.put(`${apiBase}/comments`, { comment_id: commentId, resolved });
    onChange?.();
  };

  const startReply = (c) => {
    setReplyingId(c.id);
    setReplyText('');
    // Por defecto se etiqueta a quien generó el comentario original.
    setReplyMentions(c.author_id ? [c.author_id] : []);
    setReplyResolves(false);
  };

  const cancelReply = () => {
    setReplyingId(null);
    setReplyText('');
    setReplyMentions([]);
    setReplyResolves(false);
  };

  const toggleReplyMention = (userId) => {
    setReplyMentions((cur) => (cur.includes(userId) ? cur.filter((id) => id !== userId) : [...cur, userId]));
  };

  const sendReply = async (commentId) => {
    if (!replyText.trim()) return;
    setReplySending(true);
    try {
      await api.post(`${apiBase}/comments`, {
        reply_to: commentId,
        text: replyText,
        mentions: replyMentions,
        resolves: replyResolves,
      });
      cancelReply();
      onChange?.();
    } finally {
      setReplySending(false);
    }
  };

  if (!canComment && fieldComments.length === 0) return null;

  return (
    <div className="mt-2 border border-deepViolet/10 rounded-lg bg-white/60 p-2 text-xs space-y-2">
      {fieldComments.map((c) => (
        <div key={c.id} className={`p-2 rounded-md ${c.resolved ? 'bg-activeMint/10' : 'bg-warmAmber-light'}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-deepViolet">{c.author_nombre}</span>
            {canResolve && (
              <button
                onClick={() => resolve(c.id, !c.resolved)}
                className="text-[10px] font-semibold underline text-cognitiveTeal"
              >
                {c.resolved ? 'Reabrir' : 'Marcar resuelto'}
              </button>
            )}
          </div>
          <p className="text-slate-700 mt-0.5">{c.text}</p>
          {c.resolved && <span className="text-emerald-700 font-semibold">Resuelto</span>}

          {(c.replies || []).length > 0 && (
            <div className="mt-2 ml-3 pl-2 border-l-2 border-deepViolet/15 space-y-1.5">
              {c.replies.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-deepViolet">{r.author_nombre}</span>
                    {r.resolves && <span className="text-emerald-700 font-semibold text-[10px]">Resolvió el comentario</span>}
                  </div>
                  <p className="text-slate-700 mt-0.5">{r.text}</p>
                </div>
              ))}
            </div>
          )}

          {replyingId === c.id ? (
            <div className="mt-2 ml-3 pl-2 border-l-2 border-deepViolet/15 flex flex-col gap-1.5">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escribe una respuesta..."
                className="w-full border border-deepViolet/20 rounded-md p-1.5 text-xs"
                rows={2}
              />
              {projectUsers?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {projectUsers.map((u) => (
                    <label key={u.profiles.id} className="flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={replyMentions.includes(u.profiles.id)}
                        onChange={() => toggleReplyMention(u.profiles.id)}
                      />
                      {u.profiles.nombre} {u.profiles.apellido}
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-deepViolet">
                <input
                  type="checkbox"
                  checked={replyResolves}
                  onChange={(e) => setReplyResolves(e.target.checked)}
                />
                Esta respuesta resuelve el comentario
              </label>
              <div className="flex gap-2 items-center">
                <button
                  onClick={cancelReply}
                  className="text-[11px] font-semibold text-slate-400 hover:underline"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => sendReply(c.id)}
                  disabled={replySending}
                  className="ml-auto px-2.5 py-1 rounded-md bg-deepViolet text-white font-semibold disabled:opacity-50"
                >
                  Enviar respuesta
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => startReply(c)}
              className="mt-1.5 text-[11px] font-semibold text-cognitiveTeal hover:underline"
            >
              Responder
            </button>
          )}
        </div>
      ))}

      {canComment && (
        <div className="flex flex-col gap-1 pt-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Añadir observación..."
            className="w-full border border-deepViolet/20 rounded-md p-1.5 text-xs"
            rows={2}
          />
          <div className="flex gap-2 items-center">
            {projectUsers?.length > 0 && (
              <select
                value={mentionId}
                onChange={(e) => setMentionId(e.target.value)}
                className="border border-deepViolet/20 rounded-md text-xs p-1"
              >
                <option value="">Etiquetar a...</option>
                {projectUsers.map((u) => (
                  <option key={u.profiles.id} value={u.profiles.id}>
                    {u.profiles.nombre} {u.profiles.apellido}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={send}
              disabled={sending}
              className="ml-auto px-2.5 py-1 rounded-md bg-deepViolet text-white font-semibold disabled:opacity-50"
            >
              Comentar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
