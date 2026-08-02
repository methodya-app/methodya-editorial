import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const POLL_MS = 45000;

// Campana de notificaciones en el header: sondea el contador de no leídas y
// despliega las últimas al abrir. El centro completo vive en /notificaciones.
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await api.get('/notifications');
      setNotifications((data.notifications || []).slice(0, 8));
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silencioso: no debe interrumpir el resto de la app
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleClick = async (n) => {
    setOpen(false);
    if (!n.read) {
      await api.put('/notifications', { id: n.id });
      load();
    }
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-empatheticLinen/90 hover:bg-white/10"
        title="Notificaciones"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-warmAmber text-deepViolet text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 z-50 max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="p-4 text-center text-slate-400 text-sm">No tienes notificaciones.</p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-4 py-2 text-sm border-b border-deepViolet/5 hover:bg-deepViolet/5 ${
                n.read ? 'text-slate-500' : 'text-deepViolet font-medium'
              }`}
            >
              <p className="leading-snug">{n.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {new Date(n.created_at).toLocaleString('es-CO')}
              </p>
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              navigate('/notificaciones');
            }}
            className="w-full text-center px-4 py-2 text-xs font-semibold text-cognitiveTeal hover:bg-deepViolet/5"
          >
            Ver todas
          </button>
        </div>
      )}
    </div>
  );
}
