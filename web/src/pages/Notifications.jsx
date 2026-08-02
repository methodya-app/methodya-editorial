import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const STATUS_BADGE = {
  Nuevo: 'bg-cognitiveTeal-light text-cognitiveTeal-deep',
  Respondido: 'bg-warmAmber/20 text-warmAmber-hover',
  Cerrado: 'bg-slate-200 text-slate-500',
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('todas'); // 'todas' | 'no_leidas'
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    const data = await api.get('/notifications');
    setNotifications(data.notifications || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const markAllRead = async () => {
    await api.put('/notifications', { mark_all_read: true });
    load();
  };

  const handleClick = async (n) => {
    if (!n.read) {
      await api.put('/notifications', { id: n.id });
      load();
    }
    if (n.link) navigate(n.link);
  };

  const visible = notifications.filter((n) => filter === 'todas' || !n.read);

  if (loading) return <p className="text-center text-slate-400 py-10">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-deepViolet">Notificaciones</h2>
        <button onClick={markAllRead} className="text-xs font-semibold text-cognitiveTeal hover:underline">
          Marcar todas como leídas
        </button>
      </div>

      <div className="flex gap-2">
        {[
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
      </div>

      <div className="paper-card rounded-xl divide-y divide-deepViolet/10">
        {visible.map((n) => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={`w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-deepViolet/5 ${
              n.read ? '' : 'bg-cognitiveTeal-light/30'
            }`}
          >
            <div className="min-w-0">
              <p className={`text-sm ${n.read ? 'text-slate-600' : 'text-deepViolet font-semibold'}`}>{n.title}</p>
              {n.body && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.body}</p>}
              <p className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('es-CO')}</p>
            </div>
            {n.comment_status && (
              <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[n.comment_status] || ''}`}>
                {n.comment_status}
              </span>
            )}
          </button>
        ))}
        {visible.length === 0 && (
          <p className="p-6 text-center text-slate-400 text-sm">
            {filter === 'no_leidas' ? 'No tienes notificaciones sin leer.' : 'No tienes notificaciones.'}
          </p>
        )}
      </div>
    </div>
  );
}
