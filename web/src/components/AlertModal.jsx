import { useEffect, useState } from 'react';
import { registerAlertModal } from '../lib/alertModal.js';

const STYLES = {
  info: { icon: 'i', color: 'text-deepViolet', bg: 'bg-deepViolet/10' },
  exito: { icon: '✓', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  revision: { icon: '⚠', color: 'text-amber-600', bg: 'bg-amber-50' },
  error: { icon: '✕', color: 'text-red-600', bg: 'bg-red-50' },
};

// Se monta una sola vez en App.jsx; showAlert() (lib/alertModal.js) es el
// reemplazo de window.alert() que usa el resto de la app.
export default function AlertModal() {
  const [state, setState] = useState(null);

  useEffect(() => {
    registerAlertModal(setState);
  }, []);

  if (!state) return null;
  const style = STYLES[state.tipo] || STYLES.info;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-start gap-3">
          <span className={`w-8 h-8 rounded-full ${style.bg} ${style.color} flex items-center justify-center font-bold shrink-0`}>
            {style.icon}
          </span>
          <p className="text-sm text-slate-700 pt-1 whitespace-pre-line">{state.mensaje}</p>
        </div>
        <button
          onClick={() => setState(null)}
          className="w-full px-3 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
