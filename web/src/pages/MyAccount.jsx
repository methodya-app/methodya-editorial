import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { showAlert } from '../lib/alertModal.js';

export default function MyAccount() {
  const { profile, refresh } = useAuth();
  const [saving, setSaving] = useState(false);

  const toggleEmailNotifications = async () => {
    setSaving(true);
    try {
      await api.put('/me', { email_notifications_enabled: !profile.email_notifications_enabled });
      await refresh();
    } catch (err) {
      showAlert(err.message || 'No se pudo guardar el cambio.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h2 className="font-display font-bold text-xl text-deepViolet">Mi cuenta</h2>

      <div className="paper-card rounded-xl p-5 space-y-3">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Nombre</p>
          <p className="text-sm text-deepViolet font-medium">{profile.nombre} {profile.apellido}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Correo</p>
          <p className="text-sm text-deepViolet font-medium">{profile.email}</p>
        </div>
      </div>

      <div className="paper-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-deepViolet">Notificaciones por correo</p>
            <p className="text-xs text-slate-500 mt-1">
              Recibe un correo cuando te mencionen en un comentario, te respondan, o te asignen una tarea.
            </p>
          </div>
          <button
            onClick={toggleEmailNotifications}
            disabled={saving}
            className={`shrink-0 relative w-11 h-6 rounded-full transition ${
              profile.email_notifications_enabled ? 'bg-cognitiveTeal' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
                profile.email_notifications_enabled ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
