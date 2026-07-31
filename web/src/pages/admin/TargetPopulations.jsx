import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

const EMPTY_CREATE = { nombre: '', edad_min: '', edad_max: '', nivel_lector: '' };

// Catálogo global de poblaciones objetivo (punto 3 de Parametrización):
// edad, nivel lector y desarrollo esperado, definidos una sola vez y
// reutilizables desde la Parametrización de cualquier proyecto.
export default function TargetPopulations() {
  const [populations, setPopulations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    const data = await api.get('/poblaciones-objetivo');
    setPopulations(data.poblaciones_objetivo);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const result = await api.post('/poblaciones-objetivo', {
        nombre: createForm.nombre,
        edad_min: Number(createForm.edad_min),
        edad_max: Number(createForm.edad_max),
        nivel_lector: createForm.nivel_lector,
      });
      setCreateForm(EMPTY_CREATE);
      await load();
      setSelected(result.poblacion_objetivo);
    } catch (err) {
      alert('No se pudo crear: ' + err.message);
    }
  };

  // Importación en lote desde un archivo .json (un arreglo de objetos). Se
  // aceptan tanto los nombres internos de los campos como los encabezados
  // legibles del archivo ("Grado Escolar", "Edad mínima", etc.); el backend
  // los normaliza. Las que ya existen se omiten en vez de fallar, así que
  // se puede volver a subir el mismo archivo sin duplicar nada.
  const importar = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const texto = await file.text();
      const poblaciones = JSON.parse(texto);
      if (!Array.isArray(poblaciones)) {
        throw new Error('El archivo debe contener una lista (un arreglo JSON) de poblaciones.');
      }
      const { creadas, omitidas } = await api.post('/poblaciones-objetivo', { poblaciones });
      await load();
      const detalle = omitidas.length
        ? '\n\nNo se importaron:\n' + omitidas.map((o) => `• ${o.nombre}: ${o.motivo}`).join('\n')
        : '';
      alert(`${creadas.length} población(es) importada(s) ✓${detalle}`);
    } catch (err) {
      alert('No se pudo importar: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      await api.put(`/poblaciones-objetivo/${selected.id}`, {
        nombre: selected.nombre,
        edad_min: Number(selected.edad_min),
        edad_max: Number(selected.edad_max),
        nivel_lector: selected.nivel_lector,
        desarrollo_cognitivo: selected.desarrollo_cognitivo,
        pensamiento_logico_steam: selected.pensamiento_logico_steam,
        socioemocional_comunicacion: selected.socioemocional_comunicacion,
      });
      await load();
      setSavedAt(new Date());
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('¿Retirar esta población objetivo? Dejará de estar disponible para nuevos proyectos.')) {
      return;
    }
    try {
      await api.del(`/poblaciones-objetivo/${id}`);
      if (selected?.id === id) setSelected(null);
      load();
    } catch (err) {
      alert('No se pudo retirar: ' + err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
      <div className="md:col-span-1 space-y-3">
        <h2 className="font-display font-bold text-xl text-deepViolet">Poblaciones objetivo</h2>
        <p className="text-xs text-slate-500">
          Catálogo reutilizable: define una vez la edad, el nivel lector y el desarrollo esperado de
          cada población, y luego selecciónala desde la Parametrización de cualquier proyecto.
        </p>

        <form onSubmit={create} className="paper-card rounded-xl p-3 space-y-2">
          <input
            required
            placeholder="Nombre"
            value={createForm.nombre}
            onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              type="number"
              placeholder="Edad mín."
              value={createForm.edad_min}
              onChange={(e) => setCreateForm({ ...createForm, edad_min: e.target.value })}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
            <input
              required
              type="number"
              placeholder="Edad máx."
              value={createForm.edad_max}
              onChange={(e) => setCreateForm({ ...createForm, edad_max: e.target.value })}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <input
            required
            placeholder="Nivel lector (ej: Básico-medio, Flesch ~60)"
            value={createForm.nivel_lector}
            onChange={(e) => setCreateForm({ ...createForm, nivel_lector: e.target.value })}
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          <button
            type="submit"
            className="w-full px-3 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            + Crear
          </button>
        </form>

        <div className="paper-card rounded-xl p-3 space-y-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => importar(e.target.files?.[0])}
            disabled={importing}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full px-3 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold disabled:opacity-50"
          >
            {importing ? 'Importando...' : '⬆ Importar desde JSON'}
          </button>
          <p className="text-xs text-slate-400">
            Una lista JSON con las columnas Grado Escolar, Edad mínima, Edad máxima, Nivel Lector,
            Desarrollo Cognitivo, Pensamiento Lógico / STEAM y Socioemocional y Comunicación. Las que ya
            existan se omiten, así que puedes volver a subir el mismo archivo sin duplicar.
          </p>
        </div>

        <div className="paper-card rounded-xl divide-y divide-deepViolet/10">
          {populations.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p);
                setSavedAt(null);
              }}
              className={`w-full text-left p-3 text-sm hover:bg-deepViolet/5 ${
                selected?.id === p.id ? 'bg-cognitiveTeal-light/40' : ''
              }`}
            >
              {p.nombre}
              <span className="block text-xs text-slate-400">
                {p.edad_min}–{p.edad_max} años
              </span>
            </button>
          ))}
          {populations.length === 0 && <p className="p-3 text-sm text-slate-400">Sin poblaciones aún.</p>}
        </div>
      </div>

      <div className="md:col-span-2">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <input
                value={selected.nombre}
                onChange={(e) => setSelected({ ...selected, nombre: e.target.value })}
                className="font-display font-bold text-lg text-deepViolet bg-transparent border-b border-transparent hover:border-deepViolet/20 focus:border-deepViolet focus:outline-none flex-1"
              />
              <div className="flex items-center gap-2">
                {savedAt && <span className="text-xs text-emerald-600">Guardado ✓</span>}
                <button onClick={() => remove(selected.id)} className="text-xs text-red-500 hover:underline">
                  Retirar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-deepViolet text-white text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>

            <div className="paper-card rounded-xl p-4 grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Edad mínima *</label>
                <input
                  type="number"
                  value={selected.edad_min}
                  onChange={(e) => setSelected({ ...selected, edad_min: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Edad máxima *</label>
                <input
                  type="number"
                  value={selected.edad_max}
                  onChange={(e) => setSelected({ ...selected, edad_max: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nivel lector *</label>
                <input
                  value={selected.nivel_lector}
                  onChange={(e) => setSelected({ ...selected, nivel_lector: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Desarrollo cognitivo</label>
                <textarea
                  rows={3}
                  value={selected.desarrollo_cognitivo || ''}
                  onChange={(e) => setSelected({ ...selected, desarrollo_cognitivo: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Pensamiento lógico / STEAM
                </label>
                <textarea
                  rows={3}
                  value={selected.pensamiento_logico_steam || ''}
                  onChange={(e) => setSelected({ ...selected, pensamiento_logico_steam: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Socioemocional y comunicación
                </label>
                <textarea
                  rows={3}
                  value={selected.socioemocional_comunicacion || ''}
                  onChange={(e) => setSelected({ ...selected, socioemocional_comunicacion: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Selecciona una población objetivo para editarla.</p>
        )}
      </div>
    </div>
  );
}
