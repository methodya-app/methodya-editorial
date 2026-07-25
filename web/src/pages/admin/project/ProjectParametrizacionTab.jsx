import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { useAuth } from '../../../lib/auth.jsx';

const EMPTY = {
  estilo: { tono: '', nivel_formalidad: '', terminologia_preferida: '', terminologia_evitar: '' },
  pedagogia: { enfoque: '', lineamientos: '' },
  temas_focos: { temas: [], descripcion: '' },
  poblacion_objetivo: { edad_min: '', edad_max: '', region_contexto: '', idiomas: [], nivel_lector: '' },
};

const SUBTABS = [
  { key: 'estilo', label: 'Estilo' },
  { key: 'pedagogia', label: 'Pedagogía' },
  { key: 'temas_focos', label: 'Temas y Focos' },
  { key: 'poblacion_objetivo', label: 'Población objetivo' },
];

function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            active === t.key ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function TagsInput({ value, onChange, placeholder, readOnly }) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-cognitiveTeal-light text-cognitiveTeal-deep text-xs font-semibold px-2 py-1 rounded-full"
          >
            {tag}
            {!readOnly && (
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="hover:text-red-600">
                ×
              </button>
            )}
          </span>
        ))}
        {value.length === 0 && <span className="text-xs text-slate-400">Ninguno agregado.</span>}
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={placeholder}
            className="flex-1 border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

function HistorialModal({ open, onClose, projectId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get(`/projects/${projectId}/parametrizacion/historial`)
      .then((data) => setEntries(data.historial))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-deepViolet/10 flex items-center justify-between">
          <h3 className="font-display font-bold text-deepViolet">Historial de cambios</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar p-4 flex-1 space-y-3">
          {loading && <p className="text-sm text-slate-500">Cargando...</p>}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-slate-400">Aún no hay cambios registrados.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="border border-deepViolet/10 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span className="font-semibold">
                  {e.actor ? `${e.actor.nombre} ${e.actor.apellido}` : 'Usuario desconocido'}
                </span>
                <span>{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-400 mb-1">Estado anterior al cambio:</p>
              <pre className="text-xs bg-deepViolet/5 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(e.snapshot, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Parametrización del proyecto: contexto/guía editorial y pedagógica (NO son
// reglas duras como Validaciones Globales, que bloquean con regex). Se usa
// como contexto humano y, a futuro, como contexto para prompts de IA.
export default function ProjectParametrizacionTab({ projectId, readOnly }) {
  const { isAdmin } = useAuth();
  const [subTab, setSubTab] = useState('estilo');
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [historialOpen, setHistorialOpen] = useState(false);

  const canEdit = isAdmin && !readOnly;

  const load = async () => {
    setLoading(true);
    const data = await api.get(`/projects/${projectId}/parametrizacion`);
    const p = data.parametrizacion || {};
    setForm({
      estilo: { ...EMPTY.estilo, ...(p.estilo || {}) },
      pedagogia: { ...EMPTY.pedagogia, ...(p.pedagogia || {}) },
      temas_focos: { ...EMPTY.temas_focos, ...(p.temas_focos || {}) },
      poblacion_objetivo: {
        ...EMPTY.poblacion_objetivo,
        ...(p.poblacion_objetivo || {}),
        edad_min: p.poblacion_objetivo?.edad_min ?? '',
        edad_max: p.poblacion_objetivo?.edad_max ?? '',
      },
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const update = (section, field, value) =>
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));

  const save = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      const payload = {
        estilo: form.estilo,
        pedagogia: form.pedagogia,
        temas_focos: form.temas_focos,
        poblacion_objetivo: {
          ...form.poblacion_objetivo,
          edad_min: form.poblacion_objetivo.edad_min === '' ? null : Number(form.poblacion_objetivo.edad_min),
          edad_max: form.poblacion_objetivo.edad_max === '' ? null : Number(form.poblacion_objetivo.edad_max),
        },
      };
      await api.put(`/projects/${projectId}/parametrizacion`, payload);
      setSavedAt(new Date());
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500 text-sm">Cargando...</p>;

  const inputCls =
    'w-full border border-deepViolet/20 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cognitiveTeal disabled:bg-slate-100 disabled:text-slate-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SubTabs tabs={SUBTABS} active={subTab} onChange={setSubTab} />
        <button
          onClick={() => setHistorialOpen(true)}
          className="text-xs font-semibold text-cognitiveTeal hover:underline whitespace-nowrap"
        >
          🕘 Ver historial de cambios
        </button>
      </div>

      <div className="paper-card rounded-xl p-5 space-y-4">
        {subTab === 'estilo' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tono</label>
              <input
                disabled={!canEdit}
                value={form.estilo.tono}
                onChange={(e) => update('estilo', 'tono', e.target.value)}
                placeholder="Ej: cercano, motivador, riguroso..."
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nivel de formalidad</label>
              <input
                disabled={!canEdit}
                value={form.estilo.nivel_formalidad}
                onChange={(e) => update('estilo', 'nivel_formalidad', e.target.value)}
                placeholder="Ej: informal, neutral, formal"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Terminología preferida</label>
              <textarea
                disabled={!canEdit}
                rows={3}
                value={form.estilo.terminologia_preferida}
                onChange={(e) => update('estilo', 'terminologia_preferida', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Terminología a evitar</label>
              <textarea
                disabled={!canEdit}
                rows={3}
                value={form.estilo.terminologia_evitar}
                onChange={(e) => update('estilo', 'terminologia_evitar', e.target.value)}
                placeholder="Guía para humanos, no bloquea nada (para bloquear, usa Validaciones globales)"
                className={inputCls}
              />
            </div>
          </>
        )}

        {subTab === 'pedagogia' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Enfoque pedagógico</label>
              <input
                disabled={!canEdit}
                value={form.pedagogia.enfoque}
                onChange={(e) => update('pedagogia', 'enfoque', e.target.value)}
                placeholder="Ej: STEAM, ABP, Design Thinking, Mixto, Otro"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Lineamientos</label>
              <textarea
                disabled={!canEdit}
                rows={5}
                value={form.pedagogia.lineamientos}
                onChange={(e) => update('pedagogia', 'lineamientos', e.target.value)}
                placeholder="Objetivos, secuencia didáctica esperada..."
                className={inputCls}
              />
            </div>
          </>
        )}

        {subTab === 'temas_focos' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Temas</label>
              <TagsInput
                readOnly={!canEdit}
                value={form.temas_focos.temas}
                onChange={(v) => update('temas_focos', 'temas', v)}
                placeholder="Escribe un tema y presiona Enter"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
              <textarea
                disabled={!canEdit}
                rows={4}
                value={form.temas_focos.descripcion}
                onChange={(e) => update('temas_focos', 'descripcion', e.target.value)}
                className={inputCls}
              />
            </div>
          </>
        )}

        {subTab === 'poblacion_objetivo' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Edad mínima</label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={form.poblacion_objetivo.edad_min}
                  onChange={(e) => update('poblacion_objetivo', 'edad_min', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Edad máxima</label>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={form.poblacion_objetivo.edad_max}
                  onChange={(e) => update('poblacion_objetivo', 'edad_max', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Región/contexto</label>
              <input
                disabled={!canEdit}
                value={form.poblacion_objetivo.region_contexto}
                onChange={(e) => update('poblacion_objetivo', 'region_contexto', e.target.value)}
                placeholder="Ej: zona rural andina, Caribe insular..."
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Idiomas</label>
              <TagsInput
                readOnly={!canEdit}
                value={form.poblacion_objetivo.idiomas}
                onChange={(v) => update('poblacion_objetivo', 'idiomas', v)}
                placeholder="Ej: Español, Quechua, Creole de San Andrés..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nivel lector</label>
              <input
                disabled={!canEdit}
                value={form.poblacion_objetivo.nivel_lector}
                onChange={(e) => update('poblacion_objetivo', 'nivel_lector', e.target.value)}
                placeholder="Ej: Básico-medio (Flesch ~60)"
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {savedAt && <span className="text-xs text-emerald-600">Guardado ✓</span>}
        </div>
      )}

      <HistorialModal open={historialOpen} onClose={() => setHistorialOpen(false)} projectId={projectId} />
    </div>
  );
}
