import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

const CONTEXT_FILE_ACCEPT = '.pdf,.txt,.md';
const CONTEXT_MIME_BY_EXTENSION = { pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown' };

function specsObjectToPairs(obj) {
  return Object.entries(obj || {}).map(([key, value]) => ({ key, value: String(value) }));
}

function specsPairsToObject(pairs) {
  const obj = {};
  for (const { key, value } of pairs) {
    if (key.trim()) obj[key.trim()] = value;
  }
  return obj;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function KeyValueEditor({ pairs, onChange }) {
  const updatePair = (idx, field, value) => {
    const next = [...pairs];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };
  const removePair = (idx) => onChange(pairs.filter((_, i) => i !== idx));
  const addPair = () => onChange([...pairs, { key: '', value: '' }]);

  return (
    <div className="space-y-2">
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            value={pair.key}
            onChange={(e) => updatePair(idx, 'key', e.target.value)}
            placeholder="Clave (ej: sensores)"
            className="w-1/3 border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          <input
            value={pair.value}
            onChange={(e) => updatePair(idx, 'value', e.target.value)}
            placeholder="Valor"
            className="flex-1 border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          <button type="button" onClick={() => removePair(idx)} className="text-xs text-red-500 hover:underline px-2">
            ×
          </button>
        </div>
      ))}
      {pairs.length === 0 && <p className="text-xs text-slate-400">Sin especificaciones aún.</p>}
      <button type="button" onClick={addPair} className="text-xs font-semibold text-cognitiveTeal hover:underline">
        + Agregar especificación
      </button>
    </div>
  );
}

// Catálogo global de dotación (equipos usados en las lecciones), en dos
// niveles: Tipo de dotación (ej. "KIT STEAM") y, dentro de cada tipo, sus
// Referencias/modelos concretos — dos kits del mismo tipo pueden traer
// sensores o componentes distintos según la referencia. La ficha técnica de
// cada referencia se extrae UNA sola vez (a mano, o subiendo un manual/guía
// para que la IA la analice) y queda guardada, para no releer el manual
// completo en cada ejecución.
export default function DotacionCatalog() {
  const [tipos, setTipos] = useState([]);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [referencias, setReferencias] = useState([]);
  const [selectedReferencia, setSelectedReferencia] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);

  const [newTipoForm, setNewTipoForm] = useState({ nombre: '', descripcion: '' });
  const [newRefForm, setNewRefForm] = useState({ referencia: '', nombre: '', descripcion: '' });
  const [importing, setImporting] = useState(false);
  const [pendingSpecs, setPendingSpecs] = useState(null);
  const fileInputRef = useRef(null);

  const loadTipos = async () => {
    const data = await api.get('/dotacion-tipos');
    setTipos(data.dotacion_tipos);
  };

  useEffect(() => {
    loadTipos();
  }, []);

  const loadReferencias = async (tipoId) => {
    const data = await api.get(`/dotacion-tipos/${tipoId}/referencias`);
    setReferencias(data.dotacion_referencias);
  };

  const selectTipo = async (tipo) => {
    setSelectedTipo(tipo);
    setSelectedReferencia(null);
    setEditValues(null);
    await loadReferencias(tipo.id);
  };

  const createTipo = async (e) => {
    e.preventDefault();
    try {
      const result = await api.post('/dotacion-tipos', newTipoForm);
      setNewTipoForm({ nombre: '', descripcion: '' });
      await loadTipos();
      selectTipo(result.dotacion_tipo);
    } catch (err) {
      alert('No se pudo crear: ' + err.message);
    }
  };

  const removeTipo = async (tipo) => {
    if (!window.confirm(`¿Retirar el tipo "${tipo.nombre}"? Sus referencias dejarán de estar disponibles.`)) return;
    try {
      await api.del(`/dotacion-tipos/${tipo.id}`);
      if (selectedTipo?.id === tipo.id) {
        setSelectedTipo(null);
        setReferencias([]);
        setSelectedReferencia(null);
        setEditValues(null);
      }
      loadTipos();
    } catch (err) {
      alert('No se pudo retirar: ' + err.message);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type || CONTEXT_MIME_BY_EXTENSION[ext];
    if (!Object.values(CONTEXT_MIME_BY_EXTENSION).includes(mimeType)) {
      alert('Formato no soportado. Usa PDF, TXT o Markdown.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setImporting(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await api.post('/ai/extract-dotacion-specs', { file_base64: base64, mime_type: mimeType });
      setPendingSpecs(result);
    } catch (err) {
      alert('No se pudo analizar el documento: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const createReferencia = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newRefForm };
      if (pendingSpecs) {
        payload.especificaciones = pendingSpecs.especificaciones;
        payload.resumen = pendingSpecs.resumen;
        payload.fuente = 'ia_archivo';
      }
      const result = await api.post(`/dotacion-tipos/${selectedTipo.id}/referencias`, payload);
      setNewRefForm({ referencia: '', nombre: '', descripcion: '' });
      setPendingSpecs(null);
      await loadReferencias(selectedTipo.id);
      selectReferencia(result.dotacion_referencia);
    } catch (err) {
      alert('No se pudo crear: ' + err.message);
    }
  };

  const selectReferencia = (ref) => {
    setSelectedReferencia(ref);
    setEditValues({
      referencia: ref.referencia,
      nombre: ref.nombre,
      descripcion: ref.descripcion || '',
      specPairs: specsObjectToPairs(ref.especificaciones),
      resumen: ref.resumen || '',
    });
    setSavedAt(null);
  };

  const saveReferencia = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      await api.put(`/dotacion-referencias/${selectedReferencia.id}`, {
        referencia: editValues.referencia,
        nombre: editValues.nombre,
        descripcion: editValues.descripcion,
        especificaciones: specsPairsToObject(editValues.specPairs),
        resumen: editValues.resumen,
      });
      await loadReferencias(selectedTipo.id);
      setSavedAt(new Date());
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeReferencia = async (ref) => {
    if (!window.confirm(`¿Retirar la referencia "${ref.nombre}"?`)) return;
    try {
      await api.del(`/dotacion-referencias/${ref.id}`);
      if (selectedReferencia?.id === ref.id) {
        setSelectedReferencia(null);
        setEditValues(null);
      }
      loadReferencias(selectedTipo.id);
    } catch (err) {
      alert('No se pudo retirar: ' + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="font-display font-bold text-xl text-deepViolet">Dotación</h2>
        <p className="text-sm text-slate-500">
          Catálogo reutilizable de equipos usados en las lecciones (kits, pantallas, etc.). Cada tipo (ej.
          "KIT STEAM") puede tener varias referencias/modelos, ya que dos kits del mismo tipo pueden traer
          sensores o componentes distintos. Cárgalas a mano o sube un manual/ficha técnica para que la IA
          extraiga la información una sola vez.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-1 space-y-3">
          <form onSubmit={createTipo} className="paper-card rounded-xl p-3 space-y-2">
            <input
              required
              placeholder="Nombre del tipo (ej: KIT STEAM)"
              value={newTipoForm.nombre}
              onChange={(e) => setNewTipoForm({ ...newTipoForm, nombre: e.target.value })}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
            <textarea
              rows={2}
              placeholder="Descripción (opcional)"
              value={newTipoForm.descripcion}
              onChange={(e) => setNewTipoForm({ ...newTipoForm, descripcion: e.target.value })}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
            >
              + Nuevo tipo
            </button>
          </form>

          <div className="paper-card rounded-xl divide-y divide-deepViolet/10">
            {tipos.map((t) => (
              <div key={t.id} className={`p-3 ${selectedTipo?.id === t.id ? 'bg-cognitiveTeal-light/40' : ''}`}>
                <button
                  onClick={() => selectTipo(t)}
                  className="text-left w-full text-sm font-semibold text-deepViolet"
                >
                  {t.nombre}
                </button>
                {t.descripcion && <p className="text-xs text-slate-500 mt-0.5">{t.descripcion}</p>}
                <button onClick={() => removeTipo(t)} className="text-xs text-red-500 hover:underline mt-1">
                  Retirar
                </button>
              </div>
            ))}
            {tipos.length === 0 && <p className="p-3 text-sm text-slate-400">Sin tipos de dotación aún.</p>}
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          {!selectedTipo ? (
            <p className="text-slate-400 text-sm">Selecciona un tipo de dotación para ver sus referencias.</p>
          ) : (
            <>
              <h3 className="font-display font-bold text-deepViolet">{selectedTipo.nombre} — Referencias</h3>

              <form onSubmit={createReferencia} className="paper-card rounded-xl p-4 space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    required
                    placeholder="Referencia/SKU (ej: ST-200)"
                    value={newRefForm.referencia}
                    onChange={(e) => setNewRefForm({ ...newRefForm, referencia: e.target.value })}
                    className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                  />
                  <input
                    required
                    placeholder="Nombre comercial (ej: KIT STEAM Pro v2)"
                    value={newRefForm.nombre}
                    onChange={(e) => setNewRefForm({ ...newRefForm, nombre: e.target.value })}
                    className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                  />
                </div>
                <textarea
                  rows={2}
                  placeholder="Descripción (opcional)"
                  value={newRefForm.descripcion}
                  onChange={(e) => setNewRefForm({ ...newRefForm, descripcion: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />

                <div className="border-t border-deepViolet/10 pt-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Ficha técnica: complétala a mano después de crear, o sube un manual/guía (PDF, TXT o
                    Markdown) para que la IA la extraiga automáticamente antes de crear.
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={CONTEXT_FILE_ACCEPT}
                    disabled={importing}
                    onChange={(e) => handleImportFile(e.target.files?.[0])}
                    className="text-xs"
                  />
                  {importing && <p className="text-xs text-cognitiveTeal mt-1">Analizando documento con IA...</p>}
                  {pendingSpecs && (
                    <div className="mt-2 text-xs bg-emerald-50 text-emerald-700 rounded-lg p-2 space-y-1">
                      <p className="font-semibold">✓ Ficha técnica extraída, se guardará con esta referencia:</p>
                      <p className="whitespace-pre-wrap">{pendingSpecs.resumen}</p>
                    </div>
                  )}
                </div>

                <button type="submit" className="px-4 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold">
                  Crear referencia
                </button>
              </form>

              <div className="paper-card rounded-xl divide-y divide-deepViolet/10">
                {referencias.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectReferencia(r)}
                    className={`w-full text-left p-3 text-sm hover:bg-deepViolet/5 ${
                      selectedReferencia?.id === r.id ? 'bg-cognitiveTeal-light/40' : ''
                    }`}
                  >
                    <span className="font-semibold text-deepViolet">{r.nombre}</span>{' '}
                    <span className="text-xs text-slate-400 font-mono">({r.referencia})</span>
                    {r.fuente === 'ia_archivo' && <span className="ml-2 text-[10px] text-cognitiveTeal">✨ IA</span>}
                  </button>
                ))}
                {referencias.length === 0 && <p className="p-3 text-sm text-slate-400">Sin referencias aún.</p>}
              </div>

              {editValues && (
                <div className="paper-card rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-semibold text-deepViolet">Editar referencia</h4>
                    <div className="flex items-center gap-3">
                      {savedAt && <span className="text-xs text-emerald-600">Guardado ✓</span>}
                      <button
                        onClick={() => removeReferencia(selectedReferencia)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Retirar
                      </button>
                      <button
                        onClick={saveReferencia}
                        disabled={saving}
                        className="px-3 py-1.5 rounded-lg bg-deepViolet text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Referencia/SKU</label>
                      <input
                        value={editValues.referencia}
                        onChange={(e) => setEditValues({ ...editValues, referencia: e.target.value })}
                        className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre comercial</label>
                      <input
                        value={editValues.nombre}
                        onChange={(e) => setEditValues({ ...editValues, nombre: e.target.value })}
                        className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción</label>
                    <textarea
                      rows={2}
                      value={editValues.descripcion}
                      onChange={(e) => setEditValues({ ...editValues, descripcion: e.target.value })}
                      className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Especificaciones técnicas</label>
                    <KeyValueEditor
                      pairs={editValues.specPairs}
                      onChange={(pairs) => setEditValues({ ...editValues, specPairs: pairs })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Resumen</label>
                    <textarea
                      rows={4}
                      value={editValues.resumen}
                      onChange={(e) => setEditValues({ ...editValues, resumen: e.target.value })}
                      className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
