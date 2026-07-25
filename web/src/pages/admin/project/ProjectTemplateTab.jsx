import { useState } from 'react';
import { api } from '../../../lib/api.js';

// Módulo de Selección de plantilla y carpeta (punto 2.1.2). Si hay una
// cuenta de Google conectada en Parámetros, "Vaciar" hace el reemplazo real
// sobre una copia de esta plantilla en Google Docs/Slides; si no, cae
// automáticamente al modo simulado (texto de abajo).
export default function ProjectTemplateTab({ project, onSaved, readOnly }) {
  const [tipo, setTipo] = useState(project.plantilla_tipo || 'docs');
  const [url, setUrl] = useState(project.plantilla_url || '');
  const [folder, setFolder] = useState(project.drive_folder_url || '');
  const [texto, setTexto] = useState(project.plantilla_texto_simulado || '');
  const [formato, setFormato] = useState(project.vaciado_formato || 'google');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkError, setCheckError] = useState('');

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/projects/${project.id}`, {
        plantilla_tipo: tipo,
        plantilla_url: url,
        drive_folder_url: folder,
        plantilla_texto_simulado: texto,
        vaciado_formato: formato,
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const checkAccess = async () => {
    setChecking(true);
    setCheckResult(null);
    setCheckError('');
    try {
      const result = await api.post(`/projects/${project.id}/check-drive-access`, {});
      setCheckResult(result);
    } catch (err) {
      setCheckError(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="paper-card rounded-xl p-5 space-y-4 max-w-2xl">
      <div className="bg-warmAmber-light text-warmAmber-hover text-xs rounded-lg p-3">
        Si en Parámetros del servidor hay una cuenta de Google conectada, "Vaciar" copia esta
        plantilla y reemplaza <code>{'{{variable}}'}</code> directamente en Google Docs/Slides (la
        plantilla original nunca se modifica). Si la carpeta destino y la plantilla son tuyas (de
        esa misma cuenta), no hace falta compartir nada. Si no hay cuenta conectada, se usa el modo
        simulado con el texto de abajo.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de plantilla</label>
          <select
            disabled={readOnly}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          >
            <option value="docs">Google Docs</option>
            <option value="slides">Google Slides</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">URL de la plantilla</label>
          <input
            disabled={readOnly}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            placeholder="https://docs.google.com/..."
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Carpeta de Google Drive destino</label>
        <input
          disabled={readOnly}
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          placeholder="https://drive.google.com/drive/folders/..."
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Formato de exportación al vaciar</label>
        <select
          disabled={readOnly}
          value={formato}
          onChange={(e) => setFormato(e.target.value)}
          className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
        >
          <option value="google">Solo Google Docs/Slides</option>
          <option value="pdf">Solo PDF</option>
          <option value="ambos">Ambos (Google Docs/Slides y PDF)</option>
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Solo aplica al vaciamiento real en Google Drive; el PDF se genera con la exportación
          nativa de Google a partir de la copia ya rellenada.
        </p>
      </div>

      {!readOnly && (
        <div>
          <button
            type="button"
            onClick={checkAccess}
            disabled={checking}
            className="text-xs font-semibold text-deepViolet hover:underline disabled:opacity-50"
          >
            {checking ? 'Probando...' : '🔎 Probar conexión y permisos'}
          </button>

          {checkError && (
            <p className="mt-1.5 text-xs text-red-600 bg-red-50 rounded-lg p-2">{checkError}</p>
          )}

          {checkResult && (
            <div className="mt-1.5 text-xs rounded-lg p-2.5 bg-deepViolet/5 space-y-1">
              <p className="text-slate-500">
                Cuenta conectada: <span className="font-mono">{checkResult.connected_email || '—'}</span>
              </p>
              <p className={checkResult.folder?.ok ? 'text-emerald-600' : 'text-red-600'}>
                {checkResult.folder?.ok
                  ? `✓ Puede escribir en la carpeta "${checkResult.folder.name}".`
                  : `✗ Sin permiso de escritura en la carpeta. Compártela con "${checkResult.connected_email}" como Editor (o verifica que sea de esa misma cuenta). ${
                      checkResult.folder?.error || ''
                    }`}
              </p>
              {checkResult.template && (
                <p className={checkResult.template.ok ? 'text-emerald-600' : 'text-red-600'}>
                  {checkResult.template.ok
                    ? `✓ Puede leer la plantilla "${checkResult.template.name}".`
                    : `✗ No puede leer la plantilla. Compártela con "${checkResult.connected_email}" (al menos como Lector). ${checkResult.template.error || ''}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Texto base para el modo simulado (usa {'{{variable}}'} igual que las variables de los
          campos del formulario)
        </label>
        <textarea
          disabled={readOnly}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm font-mono"
          placeholder={'Ej: Clase: {{titulo}}\nDescripción: {{descripcion}}'}
        />
      </div>

      {!readOnly && (
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar plantilla'}
        </button>
      )}
    </div>
  );
}
