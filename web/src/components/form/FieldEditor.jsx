import { useState } from 'react';
import { api } from '../../lib/api.js';
import { showAlert } from '../../lib/alertModal.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto corto' },
  { value: 'textarea', label: 'Párrafo (texto largo)' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Lista desplegable' },
  { value: 'checkbox', label: 'Casillas de verificación' },
  { value: 'predefined_paragraph', label: 'Párrafo predefinido' },
  { value: 'subform', label: 'Sub-formulario' },
  { value: 'tabla_dinamica', label: 'Tabla dinámica' },
  { value: 'poblacion_objetivo', label: 'Población objetivo (del proyecto)' },
  { value: 'temas_focos', label: 'Temas y Focos (del proyecto)' },
  { value: 'dotacion', label: 'Dotación (del proyecto)' },
];

// Tipos cuyas opciones NO se digitan a mano: se toman en vivo de la
// Parametrización del proyecto (población objetivo seleccionada, temas y
// focos, dotación seleccionada), igual para todos los documentos de ese
// proyecto que usen este formulario.
const PROJECT_DRIVEN_TYPES = ['poblacion_objetivo', 'temas_focos', 'dotacion'];

export default function FieldEditor({ field, onUpdate, onRemove, subformsLibrary = [], duplicateVariable = false }) {
  const [aiRule, setAiRule] = useState(field.validation?.description || '');
  const [generating, setGenerating] = useState(false);
  const [optionsText, setOptionsText] = useState((field.options || []).join('\n'));
  const [tagsText, setTagsText] = useState((field.paragraph_tags || []).join('\n'));

  const patch = (patch) => onUpdate({ ...field, ...patch });
  const patchValidation = (patch) =>
    onUpdate({ ...field, validation: { ...field.validation, ...patch } });

  const addColumn = () => {
    const n = (field.columnas || []).length + 1;
    patch({
      columnas: [
        ...(field.columnas || []),
        { id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, etiqueta: '', variable: `columna_${n}`, tipo: 'text' },
      ],
    });
  };
  const updateColumn = (idx, updatedColumn) => {
    const columnas = [...(field.columnas || [])];
    columnas[idx] = updatedColumn;
    patch({ columnas });
  };
  const removeColumn = (idx) => patch({ columnas: (field.columnas || []).filter((_, i) => i !== idx) });

  const generateRegex = async () => {
    if (!aiRule.trim()) return;
    setGenerating(true);
    try {
      const result = await api.post('/ai/generate-regex', { description: aiRule });
      patchValidation({
        enabled: true,
        description: aiRule,
        pattern: result.pattern,
        generated_by_ai: result.source === 'gemini',
        mode: field.validation?.mode || 'must_match',
      });
    } catch (err) {
      showAlert('No se pudo generar la expresión regular: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border border-deepViolet/15 rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-0.5">Etiqueta</label>
            <input
              className="w-full border border-deepViolet/20 rounded-md p-1.5 text-sm"
              value={field.label}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-0.5">
              Variable ({'{{'}
              {field.variable || 'variable'}
              {'}}'}
              )
            </label>
            <input
              className={`w-full border rounded-md p-1.5 text-sm font-mono ${
                duplicateVariable ? 'border-red-400' : 'border-deepViolet/20'
              }`}
              value={field.variable}
              onChange={(e) => patch({ variable: e.target.value.replace(/\s+/g, '_') })}
            />
            {duplicateVariable && (
              <p className="text-xs text-red-500 mt-0.5">
                Esta variable ya se usa en otro campo del formulario.
              </p>
            )}
          </div>
        </div>
        <button onClick={onRemove} className="text-red-500 text-xs font-semibold mt-5 hover:underline">
          Eliminar
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-0.5">
          Instrucciones de diligenciamiento
          <span className="text-red-500"> *</span>
        </label>
        <textarea
          className={`w-full border rounded-md p-1.5 text-sm ${
            !field.instrucciones?.trim() ? 'border-red-400' : 'border-deepViolet/20'
          }`}
          rows={2}
          placeholder="Explica qué se espera diligenciar en este campo: quién lo lee es tanto un Creador Experto humano como un agente sintético."
          value={field.instrucciones || ''}
          onChange={(e) => patch({ instrucciones: e.target.value })}
        />
        {!field.instrucciones?.trim() && (
          <p className="text-xs text-red-500 mt-0.5">Obligatorio: guía a quien diligencia el campo.</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-0.5">Tipo de campo</label>
          <select
            className="w-full border border-deepViolet/20 rounded-md p-1.5 text-sm"
            value={field.type}
            onChange={(e) => patch({ type: e.target.value })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-0.5">Placeholder</label>
          <input
            className="w-full border border-deepViolet/20 rounded-md p-1.5 text-sm"
            value={field.placeholder || ''}
            onChange={(e) => patch({ placeholder: e.target.value })}
          />
        </div>
        <div className="flex items-end gap-2 pb-1.5">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={!!field.required} onChange={(e) => patch({ required: e.target.checked })} />
            Obligatorio
          </label>
        </div>
      </div>

      {(field.type === 'select' || field.type === 'checkbox') && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-0.5">Opciones (una por línea)</label>
          <textarea
            className="w-full border border-deepViolet/20 rounded-md p-1.5 text-sm"
            rows={3}
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value);
              patch({ options: e.target.value.split('\n').filter((v) => v.trim()) });
            }}
          />
        </div>
      )}

      {PROJECT_DRIVEN_TYPES.includes(field.type) && (
        <p className="text-xs text-slate-500 bg-deepViolet/5 rounded-md p-2">
          {field.type === 'poblacion_objetivo' &&
            'Selección única. Las opciones se toman automáticamente de las poblaciones objetivo seleccionadas en Parametrización → Población objetivo de cada proyecto.'}
          {field.type === 'temas_focos' &&
            'Selección múltiple. Las opciones se toman automáticamente de los temas configurados en Parametrización → Temas y Focos de cada proyecto.'}
          {field.type === 'dotacion' &&
            'Selección múltiple. Las opciones se toman automáticamente de la dotación seleccionada en Parametrización → Dotación de cada proyecto.'}
        </p>
      )}

      {field.type === 'predefined_paragraph' && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-500 mb-0.5">
            Tags a filtrar en el modal (una por línea, vacío = todas)
          </label>
          <textarea
            className="w-full border border-deepViolet/20 rounded-md p-1.5 text-sm"
            rows={2}
            value={tagsText}
            onChange={(e) => {
              setTagsText(e.target.value);
              patch({ paragraph_tags: e.target.value.split('\n').filter((v) => v.trim()) });
            }}
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={!!field.paragraph_lock_to_selection}
              onChange={(e) => patch({ paragraph_lock_to_selection: e.target.checked })}
            />
            Solo permitir elegir el párrafo predefinido (no permitir agregar o editar texto adicional)
          </label>
        </div>
      )}

      {field.type === 'subform' && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-500 mb-0.5">Subformularios permitidos</label>
          <div className="flex flex-wrap gap-2">
            {subformsLibrary.map((sf) => {
              const checked = (field.subform_ids || []).includes(sf._id);
              return (
                <label key={sf._id} className="flex items-center gap-1 text-xs border rounded-full px-2 py-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const cur = field.subform_ids || [];
                      patch({
                        subform_ids: e.target.checked ? [...cur, sf._id] : cur.filter((id) => id !== sf._id),
                      });
                    }}
                  />
                  {sf.nombre}
                </label>
              );
            })}
            {subformsLibrary.length === 0 && (
              <span className="text-xs text-slate-400">
                No hay subformularios creados aún (Biblioteca de subformularios).
              </span>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-sm mt-1">
            <input
              type="checkbox"
              checked={!!field.allow_multiple_instances}
              onChange={(e) => patch({ allow_multiple_instances: e.target.checked })}
            />
            Permitir múltiples instancias
          </label>
        </div>
      )}

      {field.type === 'tabla_dinamica' && (
        <div className="space-y-2 border-t border-deepViolet/10 pt-3">
          <p className="text-xs font-bold text-deepViolet">
            Columnas de la tabla
            {(field.columnas || []).length === 0 && <span className="text-red-500"> *</span>}
          </p>
          <p className="text-xs text-slate-500">
            Para diligenciar, se podrán agregar filas libremente (una por cada fila/idea/escena); cada columna
            definida aquí es un dato de esa fila.
          </p>
          {(field.columnas || []).map((col, idx) => (
            <TableColumnEditor
              key={col.id}
              column={col}
              onUpdate={(updated) => updateColumn(idx, updated)}
              onRemove={() => removeColumn(idx)}
            />
          ))}
          {(field.columnas || []).length === 0 && (
            <p className="text-xs text-red-500">Agrega al menos una columna.</p>
          )}
          <button onClick={addColumn} className="text-xs font-semibold text-cognitiveTeal hover:underline">
            + Agregar columna
          </button>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-0.5">
              Máximo de filas (opcional, vacío = sin límite)
            </label>
            <input
              type="number"
              min="1"
              className="w-32 border border-deepViolet/20 rounded-md p-1.5 text-sm"
              value={field.max_filas || ''}
              onChange={(e) => patch({ max_filas: e.target.value })}
            />
          </div>
        </div>
      )}

      {(field.type === 'text' || field.type === 'textarea' || field.type === 'number') && (
        <div className="border-t border-deepViolet/10 pt-3">
          <p className="text-xs font-bold text-deepViolet mb-1.5">
            Configuración de Validación (IA / Expresión regular)
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-deepViolet/20 rounded-md p-1.5 text-sm"
              placeholder="Describe la regla en lenguaje natural (ej: 'debe ser un correo institucional')"
              value={aiRule}
              onChange={(e) => setAiRule(e.target.value)}
            />
            <button
              onClick={generateRegex}
              disabled={generating}
              className="px-3 py-1.5 rounded-md bg-deepViolet text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {generating ? 'Generando...' : '✨ Generar con IA'}
            </button>
          </div>
          <div className="mt-2 flex gap-2 items-center">
            <input
              className="flex-1 border border-deepViolet/20 rounded-md p-1.5 text-xs font-mono"
              placeholder="Expresión regular (editable manualmente)"
              value={field.validation?.pattern || ''}
              onChange={(e) => patchValidation({ enabled: true, pattern: e.target.value })}
            />
            <select
              className="border border-deepViolet/20 rounded-md p-1.5 text-xs"
              value={field.validation?.mode || 'must_match'}
              onChange={(e) => patchValidation({ mode: e.target.value })}
            >
              <option value="must_match">Debe cumplir</option>
              <option value="must_not_match">No debe cumplir</option>
            </select>
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <input
                type="checkbox"
                checked={!!field.validation?.enabled}
                onChange={(e) => patchValidation({ enabled: e.target.checked })}
              />
              Activa
            </label>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              className="w-1/2 border border-deepViolet/20 rounded-md p-1.5 text-xs"
              placeholder="Longitud mínima"
              value={field.validation?.min_length || ''}
              onChange={(e) => patchValidation({ min_length: e.target.value })}
            />
            <input
              type="number"
              className="w-1/2 border border-deepViolet/20 rounded-md p-1.5 text-xs"
              placeholder="Longitud máxima"
              value={field.validation?.max_length || ''}
              onChange={(e) => patchValidation({ max_length: e.target.value })}
            />
          </div>
          <div className="mt-2">
            <label className="block text-xs font-semibold text-slate-500 mb-0.5">
              Mensaje de error personalizado
              {field.validation?.enabled && <span className="text-red-500"> *</span>}
            </label>
            <input
              className={`w-full border rounded-md p-1.5 text-xs ${
                field.validation?.enabled && !field.validation?.custom_message?.trim()
                  ? 'border-red-400'
                  : 'border-deepViolet/20'
              }`}
              placeholder="Mensaje que verá el usuario si el campo no cumple la regla"
              value={field.validation?.custom_message || ''}
              onChange={(e) => patchValidation({ custom_message: e.target.value })}
            />
            {field.validation?.enabled && !field.validation?.custom_message?.trim() && (
              <p className="text-xs text-red-500 mt-0.5">
                Obligatorio mientras la validación esté activa.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Una columna de "Tabla dinámica" puede tener su propia validación (misma
// forma y motor que la de un campo normal), aplicada a cada celda de esa
// columna en todas las filas.
function TableColumnEditor({ column, onUpdate, onRemove }) {
  const [aiRule, setAiRule] = useState(column.validation?.description || '');
  const [generating, setGenerating] = useState(false);
  const [showValidation, setShowValidation] = useState(!!column.validation?.enabled);

  const patch = (p) => onUpdate({ ...column, ...p });
  const patchValidation = (p) => onUpdate({ ...column, validation: { ...column.validation, ...p } });

  const generateRegex = async () => {
    if (!aiRule.trim()) return;
    setGenerating(true);
    try {
      const result = await api.post('/ai/generate-regex', { description: aiRule });
      patchValidation({
        enabled: true,
        description: aiRule,
        pattern: result.pattern,
        generated_by_ai: result.source === 'gemini',
        mode: column.validation?.mode || 'must_match',
      });
    } catch (err) {
      showAlert('No se pudo generar la expresión regular: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-deepViolet/5 rounded-md p-2 space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            className={`w-full border rounded-md p-1.5 text-sm ${
              !column.etiqueta?.trim() ? 'border-red-400' : 'border-deepViolet/20'
            }`}
            placeholder="Etiqueta de la columna (ej: Audio / Narración)"
            value={column.etiqueta}
            onChange={(e) => patch({ etiqueta: e.target.value })}
          />
        </div>
        <div className="w-40">
          <input
            className={`w-full border rounded-md p-1.5 text-xs font-mono ${
              !column.variable?.trim() ? 'border-red-400' : 'border-deepViolet/20'
            }`}
            placeholder="variable"
            value={column.variable}
            onChange={(e) => patch({ variable: e.target.value.replace(/\s+/g, '_') })}
          />
        </div>
        <select
          className="border border-deepViolet/20 rounded-md p-1.5 text-sm"
          value={column.tipo}
          onChange={(e) => patch({ tipo: e.target.value })}
        >
          <option value="text">Texto corto</option>
          <option value="textarea">Párrafo</option>
        </select>
        <button onClick={onRemove} className="text-red-500 text-xs hover:underline mt-2 whitespace-nowrap">
          Eliminar
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowValidation((s) => !s)}
        className="text-xs font-semibold text-cognitiveTeal hover:underline"
      >
        {showValidation ? '▾' : '▸'} Validación (IA / expresión regular){column.validation?.enabled && ' — activa'}
      </button>

      {showValidation && (
        <div className="border-t border-deepViolet/10 pt-2 space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 border border-deepViolet/20 rounded-md p-1.5 text-xs"
              placeholder="Describe la regla en lenguaje natural (ej: 'formato mm:ss')"
              value={aiRule}
              onChange={(e) => setAiRule(e.target.value)}
            />
            <button
              onClick={generateRegex}
              disabled={generating}
              className="px-2 py-1 rounded-md bg-deepViolet text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {generating ? 'Generando...' : '✨ Generar con IA'}
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              className="flex-1 border border-deepViolet/20 rounded-md p-1.5 text-xs font-mono"
              placeholder="Expresión regular (editable manualmente)"
              value={column.validation?.pattern || ''}
              onChange={(e) => patchValidation({ enabled: true, pattern: e.target.value })}
            />
            <select
              className="border border-deepViolet/20 rounded-md p-1.5 text-xs"
              value={column.validation?.mode || 'must_match'}
              onChange={(e) => patchValidation({ mode: e.target.value })}
            >
              <option value="must_match">Debe cumplir</option>
              <option value="must_not_match">No debe cumplir</option>
            </select>
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <input
                type="checkbox"
                checked={!!column.validation?.enabled}
                onChange={(e) => patchValidation({ enabled: e.target.checked })}
              />
              Activa
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="w-1/2 border border-deepViolet/20 rounded-md p-1.5 text-xs"
              placeholder="Longitud mínima"
              value={column.validation?.min_length || ''}
              onChange={(e) => patchValidation({ min_length: e.target.value })}
            />
            <input
              type="number"
              className="w-1/2 border border-deepViolet/20 rounded-md p-1.5 text-xs"
              placeholder="Longitud máxima"
              value={column.validation?.max_length || ''}
              onChange={(e) => patchValidation({ max_length: e.target.value })}
            />
          </div>
          <div>
            <input
              className={`w-full border rounded-md p-1.5 text-xs ${
                column.validation?.enabled && !column.validation?.custom_message?.trim()
                  ? 'border-red-400'
                  : 'border-deepViolet/20'
              }`}
              placeholder="Mensaje de error personalizado que verá quien diligencia"
              value={column.validation?.custom_message || ''}
              onChange={(e) => patchValidation({ custom_message: e.target.value })}
            />
            {column.validation?.enabled && !column.validation?.custom_message?.trim() && (
              <p className="text-xs text-red-500 mt-0.5">Obligatorio mientras la validación esté activa.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
