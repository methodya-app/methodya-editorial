import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

// Catálogo global de enfoques narrativos: el agente sintético elige uno al
// azar en cada generación (ver api/documents/[id]/generate.js) para que
// documentos distintos sobre el mismo tema no salgan siempre con la misma
// estructura. Por defecto todos aplican a todo proyecto; cada proyecto
// puede excluir algunos desde su Parametrización > Estilo y Pedagogía.
export default function NarrativeApproaches() {
  const [approaches, setApproaches] = useState([]);
  const [texto, setTexto] = useState('');

  const load = async () => {
    const data = await api.get('/enfoques-narrativos');
    setApproaches(data.enfoques_narrativos);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    await api.post('/enfoques-narrativos', { texto });
    setTexto('');
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('¿Retirar este enfoque narrativo? Dejará de estar disponible para generar contenido.')) {
      return;
    }
    await api.del(`/enfoques-narrativos/${id}`);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="font-display font-bold text-xl text-deepViolet">Enfoques narrativos</h2>
      <p className="text-sm text-slate-500">
        Ángulos que el agente sintético puede elegir al azar al generar un documento (ej: "a través de una
        historia", "a través de un experimento"), para que documentos distintos sobre un mismo tema no salgan
        siempre con la misma estructura. Por defecto aplican a todos los proyectos; cada proyecto puede
        excluir alguno desde su Parametrización &gt; Estilo y Pedagogía.
      </p>

      <form onSubmit={add} className="flex gap-2">
        <input
          required
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder='Ej: "A través de una historia o relato corto"'
          className="flex-1 border border-deepViolet/20 rounded-lg p-2 text-sm"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold">
          Agregar
        </button>
      </form>

      <div className="paper-card rounded-xl divide-y divide-deepViolet/10">
        {approaches.map((a) => (
          <div key={a.id} className="p-3 flex items-center justify-between gap-2">
            <span className="text-sm">{a.texto}</span>
            <button onClick={() => remove(a.id)} className="text-xs text-red-500 hover:underline shrink-0">
              Retirar
            </button>
          </div>
        ))}
        {approaches.length === 0 && (
          <p className="p-4 text-center text-slate-400 text-sm">No hay enfoques narrativos activos.</p>
        )}
      </div>
    </div>
  );
}
