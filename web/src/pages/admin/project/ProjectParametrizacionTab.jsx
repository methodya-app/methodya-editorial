import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api.js';
import { useAuth } from '../../../lib/auth.jsx';
import ProjectValidationsTab from './ProjectValidationsTab.jsx';
import ProjectTemplateTab from './ProjectTemplateTab.jsx';

const EMPTY = {
  estilo: { tono: '', nivel_formalidad: '', terminologia_preferida: '', terminologia_evitar: '' },
  pedagogia: { enfoque: '', lineamientos: '', enfoques_narrativos_excluidos: [] },
  temas_focos: { temas: [], descripcion: '' },
  poblacion_objetivo: { poblacion_ids: [], region_contexto: '', idiomas: [] },
  dotacion: { referencia_ids: [] },
};

const SUBTABS = [
  { key: 'estilo_pedagogia', label: 'Estilo y Pedagogía' },
  { key: 'temas_focos', label: 'Temas y Focos' },
  { key: 'poblacion_objetivo', label: 'Población objetivo' },
  { key: 'dotacion', label: 'Dotación' },
  { key: 'validaciones', label: 'Validaciones globales' },
  { key: 'plantilla', label: 'Plantilla y vaciamiento' },
];

// Sub-pestañas cuyo contenido es el objeto parametrizacion (comparten
// historial y el botón Guardar); Validaciones globales y Plantilla y
// vaciamiento son módulos propios con su propio guardado.
const PARAMETRIZACION_FIELDS = ['estilo_pedagogia', 'temas_focos', 'poblacion_objetivo', 'dotacion'];

// Formatos que el backend puede analizar con Gemini para resumir el
// contexto (comprensión de documentos nativa, sin librería propia de
// extracción de PDF/DOCX).
const CONTEXT_FILE_ACCEPT = '.pdf,.txt,.md';
const CONTEXT_MIME_BY_EXTENSION = { pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown' };

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

function CreatePoblacionModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ nombre: '', edad_min: '', edad_max: '', nivel_lector: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/poblaciones-objetivo', {
        nombre: form.nombre,
        edad_min: Number(form.edad_min),
        edad_max: Number(form.edad_max),
        nivel_lector: form.nivel_lector,
      });
      setForm({ nombre: '', edad_min: '', edad_max: '', nivel_lector: '' });
      onCreated(result.poblacion_objetivo);
    } catch (err) {
      alert('No se pudo crear: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-deepViolet/10 flex items-center justify-between">
          <h3 className="font-display font-bold text-deepViolet">Nueva población objetivo</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre *</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Edad mínima *</label>
              <input
                required
                type="number"
                value={form.edad_min}
                onChange={(e) => setForm({ ...form, edad_min: e.target.value })}
                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Edad máxima *</label>
              <input
                required
                type="number"
                value={form.edad_max}
                onChange={(e) => setForm({ ...form, edad_max: e.target.value })}
                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nivel lector *</label>
            <input
              required
              value={form.nivel_lector}
              onChange={(e) => setForm({ ...form, nivel_lector: e.target.value })}
              placeholder="Ej: Básico-medio (Flesch ~60)"
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <p className="text-xs text-slate-400">
            Podrás completar Desarrollo cognitivo, Pensamiento lógico/STEAM y Socioemocional desde{' '}
            <a
              href="#/admin/poblaciones-objetivo"
              target="_blank"
              rel="noreferrer"
              className="text-cognitiveTeal underline"
            >
              Configuración → Poblaciones Objetivo ↗
            </a>
            .
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:underline">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Parametrización del proyecto: contexto/guía editorial y pedagógica (NO son
// reglas duras como Validaciones Globales, que bloquean con regex). Se usa
// como contexto humano y, a futuro, como contexto para prompts de IA.
export default function ProjectParametrizacionTab({ projectId, project, onSaved, readOnly }) {
  const { isAdmin } = useAuth();
  const [subTab, setSubTab] = useState('estilo_pedagogia');
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [createPoblacionOpen, setCreatePoblacionOpen] = useState(false);
  const [allPopulations, setAllPopulations] = useState([]);
  const [allDotacionReferencias, setAllDotacionReferencias] = useState([]);
  const [allEnfoquesNarrativos, setAllEnfoquesNarrativos] = useState([]);
  const [summarizing, setSummarizing] = useState(false);
  const fileInputRef = useRef(null);

  const canEdit = isAdmin && !readOnly;
  const isParametrizacionField = PARAMETRIZACION_FIELDS.includes(subTab);

  const load = async () => {
    setLoading(true);
    const [data, populationsData, dotacionData, enfoquesData] = await Promise.all([
      api.get(`/projects/${projectId}/parametrizacion`),
      api.get('/poblaciones-objetivo'),
      api.get('/dotacion-referencias'),
      api.get('/enfoques-narrativos'),
    ]);
    const p = data.parametrizacion || {};
    setForm({
      estilo: { ...EMPTY.estilo, ...(p.estilo || {}) },
      pedagogia: { ...EMPTY.pedagogia, ...(p.pedagogia || {}) },
      temas_focos: { ...EMPTY.temas_focos, ...(p.temas_focos || {}) },
      poblacion_objetivo: { ...EMPTY.poblacion_objetivo, ...(p.poblacion_objetivo || {}) },
      dotacion: { ...EMPTY.dotacion, ...(p.dotacion || {}) },
    });
    setAllPopulations(populationsData.poblaciones_objetivo);
    setAllDotacionReferencias(dotacionData.dotacion_referencias);
    setAllEnfoquesNarrativos(enfoquesData.enfoques_narrativos);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const update = (section, field, value) =>
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));

  const addPoblacion = (id) => {
    if (!id || form.poblacion_objetivo.poblacion_ids.includes(id)) return;
    update('poblacion_objetivo', 'poblacion_ids', [...form.poblacion_objetivo.poblacion_ids, id]);
  };

  const removePoblacion = (id) =>
    update('poblacion_objetivo', 'poblacion_ids', form.poblacion_objetivo.poblacion_ids.filter((x) => x !== id));

  const onPoblacionCreated = (poblacion) => {
    setAllPopulations((prev) => [...prev, poblacion].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    addPoblacion(poblacion.id);
    setCreatePoblacionOpen(false);
  };

  // Los enfoques narrativos son al revés de poblaciones/dotación: por
  // defecto TODOS los del catálogo aplican a este proyecto, así que lo que
  // se guarda es la lista de excepciones (los que el proyecto excluyó), no
  // una lista de inclusión.
  const toggleEnfoqueNarrativo = (id, incluido) => {
    const excluidos = form.pedagogia.enfoques_narrativos_excluidos;
    update(
      'pedagogia',
      'enfoques_narrativos_excluidos',
      incluido ? excluidos.filter((x) => x !== id) : [...excluidos, id]
    );
  };

  const addDotacionReferencia = (id) => {
    if (!id || form.dotacion.referencia_ids.includes(id)) return;
    update('dotacion', 'referencia_ids', [...form.dotacion.referencia_ids, id]);
  };

  const removeDotacionReferencia = (id) =>
    update('dotacion', 'referencia_ids', form.dotacion.referencia_ids.filter((x) => x !== id));

  const handleImportContext = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type || CONTEXT_MIME_BY_EXTENSION[ext];
    if (!Object.values(CONTEXT_MIME_BY_EXTENSION).includes(mimeType)) {
      alert('Formato no soportado. Usa PDF, TXT o Markdown.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSummarizing(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await api.post('/ai/summarize-context', { file_base64: base64, mime_type: mimeType });
      update('poblacion_objetivo', 'region_contexto', result.summary);
    } catch (err) {
      alert('No se pudo analizar el documento: ' + err.message);
    } finally {
      setSummarizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      await api.put(`/projects/${projectId}/parametrizacion`, form);
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

  const availablePopulations = allPopulations.filter(
    (p) => !form.poblacion_objetivo.poblacion_ids.includes(p.id)
  );
  const availableDotacionReferencias = allDotacionReferencias.filter(
    (r) => !form.dotacion.referencia_ids.includes(r.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SubTabs tabs={SUBTABS} active={subTab} onChange={setSubTab} />
        {isParametrizacionField && (
          <button
            onClick={() => setHistorialOpen(true)}
            className="text-xs font-semibold text-cognitiveTeal hover:underline whitespace-nowrap"
          >
            🕘 Ver historial de cambios
          </button>
        )}
      </div>

      {subTab === 'validaciones' ? (
        <ProjectValidationsTab projectId={projectId} readOnly={readOnly} />
      ) : subTab === 'plantilla' ? (
        <ProjectTemplateTab project={project} onSaved={onSaved} readOnly={readOnly} />
      ) : (
        <>
          <div className="paper-card rounded-xl p-5 space-y-4">
            {subTab === 'estilo_pedagogia' && (
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
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Enfoques narrativos</label>
                  <p className="text-xs text-slate-400 mb-2">
                    El agente sintético elige uno al azar en cada generación, para que documentos distintos
                    sobre un mismo tema no salgan siempre con la misma estructura. Desmarca los que no
                    quieras usar en este proyecto (el catálogo completo se administra en Configuración &gt;
                    Enfoques narrativos).
                  </p>
                  <div className="space-y-1.5">
                    {allEnfoquesNarrativos.map((e) => {
                      const incluido = !form.pedagogia.enfoques_narrativos_excluidos.includes(e.id);
                      return (
                        <label key={e.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={!canEdit}
                            checked={incluido}
                            onChange={() => toggleEnfoqueNarrativo(e.id, incluido)}
                          />
                          {e.texto}
                        </label>
                      );
                    })}
                    {allEnfoquesNarrativos.length === 0 && (
                      <p className="text-sm text-slate-400">
                        No hay enfoques narrativos en el catálogo aún (Configuración &gt; Enfoques narrativos).
                      </p>
                    )}
                  </div>
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
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Poblaciones objetivo</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.poblacion_objetivo.poblacion_ids.map((id) => {
                      const p = allPopulations.find((x) => x.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 bg-cognitiveTeal-light text-cognitiveTeal-deep text-xs font-semibold px-2 py-1 rounded-full"
                        >
                          {p ? `${p.nombre} (${p.edad_min}-${p.edad_max} años)` : 'Población no disponible'}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => removePoblacion(id)}
                              className="hover:text-red-600"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      );
                    })}
                    {form.poblacion_objetivo.poblacion_ids.length === 0 && (
                      <span className="text-xs text-slate-400">Ninguna seleccionada.</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value=""
                        onChange={(e) => addPoblacion(e.target.value)}
                        className="border border-deepViolet/20 rounded-lg p-2 text-sm"
                      >
                        <option value="">+ Agregar población objetivo...</option>
                        {availablePopulations.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} ({p.edad_min}-{p.edad_max} años)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setCreatePoblacionOpen(true)}
                        className="text-xs font-semibold text-cognitiveTeal hover:underline"
                      >
                        + Crear nueva
                      </button>
                    </div>
                  )}
                  {allPopulations.length === 0 && (
                    <p className="text-xs text-warmAmber-hover mt-1.5 bg-warmAmber-light rounded-lg p-2">
                      Aún no hay poblaciones objetivo creadas.{' '}
                      <a
                        href="#/admin/poblaciones-objetivo"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-semibold"
                      >
                        Créalas aquí ↗
                      </a>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Región/contexto</label>
                  <textarea
                    disabled={!canEdit}
                    rows={6}
                    value={form.poblacion_objetivo.region_contexto}
                    onChange={(e) => update('poblacion_objetivo', 'region_contexto', e.target.value)}
                    placeholder="Ej: zona rural andina, Caribe insular..."
                    className={inputCls}
                  />
                  {canEdit && (
                    <div className="mt-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={CONTEXT_FILE_ACCEPT}
                        disabled={summarizing}
                        onChange={(e) => handleImportContext(e.target.files?.[0])}
                        className="text-xs"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        {summarizing
                          ? 'Analizando documento con IA...'
                          : 'Al elegir un archivo (PDF, TXT o Markdown), la IA configurada lo analiza y coloca un resumen aquí.'}
                      </p>
                    </div>
                  )}
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
              </>
            )}

            {subTab === 'dotacion' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Dotación (equipos usados en las lecciones)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.dotacion.referencia_ids.map((id) => {
                    const r = allDotacionReferencias.find((x) => x.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 bg-cognitiveTeal-light text-cognitiveTeal-deep text-xs font-semibold px-2 py-1 rounded-full"
                      >
                        {r
                          ? `${r.dotacion_tipos?.nombre ? `${r.dotacion_tipos.nombre} — ` : ''}${r.nombre} (${r.referencia})`
                          : 'Referencia no disponible'}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeDotacionReferencia(id)}
                            className="hover:text-red-600"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {form.dotacion.referencia_ids.length === 0 && (
                    <span className="text-xs text-slate-400">Ninguna seleccionada.</span>
                  )}
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value=""
                      onChange={(e) => addDotacionReferencia(e.target.value)}
                      className="border border-deepViolet/20 rounded-lg p-2 text-sm"
                    >
                      <option value="">+ Agregar dotación...</option>
                      {availableDotacionReferencias.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.dotacion_tipos?.nombre ? `${r.dotacion_tipos.nombre} — ` : ''}
                          {r.nombre} ({r.referencia})
                        </option>
                      ))}
                    </select>
                    <a
                      href="#/admin/dotacion"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-cognitiveTeal hover:underline"
                    >
                      + Crear nueva ↗
                    </a>
                  </div>
                )}
                {allDotacionReferencias.length === 0 && (
                  <p className="text-xs text-warmAmber-hover mt-1.5 bg-warmAmber-light rounded-lg p-2">
                    Aún no hay dotación creada en el catálogo.{' '}
                    <a
                      href="#/admin/dotacion"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-semibold"
                    >
                      Créala aquí ↗
                    </a>
                  </p>
                )}
              </div>
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
        </>
      )}

      <HistorialModal open={historialOpen} onClose={() => setHistorialOpen(false)} projectId={projectId} />
      <CreatePoblacionModal
        open={createPoblacionOpen}
        onClose={() => setCreatePoblacionOpen(false)}
        onCreated={onPoblacionCreated}
      />
    </div>
  );
}
