import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const STATUS_BADGE = {
  Nuevo: 'bg-cognitiveTeal-light text-cognitiveTeal-deep',
  Respondido: 'bg-warmAmber/20 text-warmAmber-hover',
  Cerrado: 'bg-slate-200 text-slate-500',
};

const uniqueOptions = (items, key) =>
  [...new Set(items.map((i) => i[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [view, setView] = useState('activas'); // 'activas' | 'papelera'
  const [filter, setFilter] = useState('todas'); // 'todas' | 'no_leidas'
  const [projectFilter, setProjectFilter] = useState('');
  const [documentFilter, setDocumentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async (nextView = view) => {
    setLoading(true);
    const data = await api.get(nextView === 'papelera' ? '/notifications?trashed=1' : '/notifications');
    setNotifications(data.notifications || []);
    setLoading(false);
  };

  useEffect(() => {
    load(view);
    setProjectFilter('');
    setDocumentFilter('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const markAllRead = async () => {
    await api.put('/notifications', { mark_all_read: true });
    load();
  };

  const handleClick = async (n) => {
    if (view === 'activas' && !n.read) {
      await api.put('/notifications', { id: n.id });
      load();
    }
    if (n.link) navigate(n.link);
  };

  const handleTrash = async (e, n) => {
    e.stopPropagation();
    await api.put('/notifications', { id: n.id, trash: true });
    load();
  };

  const handleRestore = async (e, n) => {
    e.stopPropagation();
    await api.put('/notifications', { id: n.id, restore: true });
    load();
  };

  const projectOptions = useMemo(() => uniqueOptions(notifications, 'project_nombre'), [notifications]);
  const documentOptions = useMemo(() => {
    const pool = projectFilter ? notifications.filter((n) => n.project_nombre === projectFilter) : notifications;
    return uniqueOptions(pool, 'document_codigo');
  }, [notifications, projectFilter]);

  const visible = notifications.filter((n) => {
    if (view === 'activas' && filter === 'no_leidas' && n.read) return false;
    if (projectFilter && n.project_nombre !== projectFilter) return false;
    if (documentFilter && n.document_codigo !== documentFilter) return false;
    return true;
  });

  const isComment = (n) => n.type === 'comment_mention' || n.type === 'comment_reply';

  if (loading) return <p className="text-center text-slate-400 py-10">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-deepViolet">Notificaciones</h2>
        {view === 'activas' && (
          <button onClick={markAllRead} className="text-xs font-semibold text-cognitiveTeal hover:underline">
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { key: 'activas', label: 'Notificaciones' },
          { key: 'papelera', label: '🗑️ Papelera' },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              view === v.key ? 'bg-deepViolet text-white' : 'bg-white text-deepViolet border border-deepViolet/15'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {view === 'activas' &&
          [
            { key: 'todas', label: 'Todas' },
            { key: 'no_leidas', label: 'No leídas' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                filter === f.key ? 'bg-cognitiveTeal text-white' : 'bg-white text-deepViolet border border-deepViolet/15'
              }`}
            >
              {f.label}
            </button>
          ))}

        <select
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value);
            setDocumentFilter('');
          }}
          className="border border-deepViolet/20 rounded-lg p-1.5 text-sm text-deepViolet"
        >
          <option value="">Todos los proyectos</option>
          {projectOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={documentFilter}
          onChange={(e) => setDocumentFilter(e.target.value)}
          className="border border-deepViolet/20 rounded-lg p-1.5 text-sm text-deepViolet"
        >
          <option value="">Todos los documentos</option>
          {documentOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="paper-card rounded-xl divide-y divide-deepViolet/10">
        {visible.map((n) => (
          <div
            key={n.id}
            onClick={() => handleClick(n)}
            className={`w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-deepViolet/5 cursor-pointer ${
              view === 'activas' && !n.read ? 'bg-cognitiveTeal-light/30' : ''
            }`}
          >
            <div className="min-w-0">
              <p className={`text-sm ${view === 'activas' && !n.read ? 'text-deepViolet font-semibold' : 'text-slate-600'}`}>
                {n.title}
              </p>
              {n.body && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.body}</p>}
              {isComment(n) && n.document_codigo && (
                <p className="text-[11px] text-cognitiveTeal-deep mt-1">
                  📄 {n.document_codigo}{n.project_nombre ? ` · ${n.project_nombre}` : ''}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('es-CO')}</p>
            </div>
            <div className="shrink-0 flex items-start gap-2">
              {n.comment_status && (
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[n.comment_status] || ''}`}>
                  {n.comment_status}
                </span>
              )}
              {view === 'activas' ? (
                <button
                  onClick={(e) => handleTrash(e, n)}
                  title="Eliminar"
                  className="text-slate-400 hover:text-red-500 text-sm"
                >
                  🗑️
                </button>
              ) : (
                <button
                  onClick={(e) => handleRestore(e, n)}
                  className="text-xs font-semibold text-cognitiveTeal hover:underline"
                >
                  ♻️ Restaurar
                </button>
              )}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="p-6 text-center text-slate-400 text-sm">
            {view === 'papelera'
              ? 'La papelera está vacía.'
              : filter === 'no_leidas'
                ? 'No tienes notificaciones sin leer.'
                : 'No tienes notificaciones.'}
          </p>
        )}
      </div>
    </div>
  );
}
