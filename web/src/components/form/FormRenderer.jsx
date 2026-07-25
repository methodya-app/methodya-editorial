import { useState } from 'react';
import ParagraphPickerModal from './ParagraphPickerModal.jsx';
import CommentsPanel from '../CommentsPanel.jsx';
import { validateFieldClient } from '../../lib/validateField.js';
import { api } from '../../lib/api.js';

// Tipos de campo de texto libre en los que tiene sentido ofrecer el botón
// "Revisar ortografía" (los demás son selección/estructurados).
const SPELLCHECKABLE_TYPES = ['text', 'textarea', 'predefined_paragraph'];

// Motor de ejecución de formularios: dado un `form` (secciones/campos) y un
// objeto `values`, renderiza cada campo según su tipo. Se usa tanto para que
// el Creador Experto diligencie el documento como para que los revisores lo
// editen y comenten (modo "review").
export default function FormRenderer({
  form,
  values,
  onChange,
  errors = {},
  onErrorsChange,
  readOnly = false,
  subformsLibrary = [],
  paragraphsLibrary = [],
  globalValidations = [],
  languagetoolConfigured = false,
  reviewMode = false,
  documentId,
  comments = [],
  projectUsers = [],
  onCommentsChange,
  canReleaseToMultimedia = false,
  subformReleaseStatus = {},
  onReleaseInstance,
}) {
  const setValue = (variable, val) => onChange({ ...values, [variable]: val });

  const handleBlur = (field) => {
    if (!onErrorsChange) return;
    const fieldErrors = validateFieldClient(field, values[field.variable], globalValidations);
    const next = { ...errors };
    if (fieldErrors.length) next[field.variable] = fieldErrors;
    else delete next[field.variable];
    onErrorsChange(next);
  };

  return (
    <div className="space-y-8">
      {form.sections.map((section) => (
        <div key={section.id} className="paper-card rounded-xl p-5">
          <h3 className="font-display font-bold text-deepViolet mb-4">{section.titulo}</h3>
          <div className="space-y-5">
            {section.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.variable]}
                onChange={(v) => setValue(field.variable, v)}
                onBlur={() => handleBlur(field)}
                error={errors[field.variable]}
                readOnly={readOnly}
                subformsLibrary={subformsLibrary}
                paragraphsLibrary={paragraphsLibrary}
                languagetoolConfigured={languagetoolConfigured}
                reviewMode={reviewMode}
                documentId={documentId}
                comments={comments}
                projectUsers={projectUsers}
                onCommentsChange={onCommentsChange}
                canReleaseToMultimedia={canReleaseToMultimedia}
                subformReleaseStatus={subformReleaseStatus}
                onReleaseInstance={onReleaseInstance}
              />
            ))}
            {section.fields.length === 0 && (
              <p className="text-sm text-slate-400">Esta sección no tiene campos.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  onBlur,
  error,
  readOnly,
  subformsLibrary,
  paragraphsLibrary,
  languagetoolConfigured,
  reviewMode,
  documentId,
  comments,
  projectUsers,
  onCommentsChange,
  canReleaseToMultimedia,
  subformReleaseStatus,
  onReleaseInstance,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [spellIssues, setSpellIssues] = useState(null);
  const [spellChecking, setSpellChecking] = useState(false);
  const [spellError, setSpellError] = useState('');

  const spellCheckable = SPELLCHECKABLE_TYPES.includes(field.type) && languagetoolConfigured;

  const runSpellCheck = async () => {
    setSpellChecking(true);
    setSpellError('');
    try {
      const result = await api.post('/ai/check-spelling', { text: value || '' });
      setSpellIssues(result.issues);
    } catch (err) {
      setSpellError('No se pudo revisar la ortografía: ' + err.message);
    } finally {
      setSpellChecking(false);
    }
  };

  const applySuggestion = (issue, suggestion) => {
    const text = value || '';
    const next = text.slice(0, issue.offset) + suggestion + text.slice(issue.offset + issue.length);
    onChange(next);
    // Los offsets del resto de incidencias quedan desactualizados tras el
    // reemplazo; se pide revisar de nuevo en vez de arriesgar posiciones mal calculadas.
    setSpellIssues(null);
  };

  return (
    <div id={`field-${field.variable}`}>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>

      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={readOnly}
        subformsLibrary={subformsLibrary}
        openPicker={() => setPickerOpen(true)}
        canReleaseToMultimedia={canReleaseToMultimedia}
        subformReleaseStatus={subformReleaseStatus}
        onReleaseInstance={onReleaseInstance}
      />

      {error?.length > 0 && (
        <ul className="mt-1 text-xs text-red-600 space-y-0.5">
          {error.map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
        </ul>
      )}

      {spellCheckable && !readOnly && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={runSpellCheck}
            disabled={spellChecking}
            className="text-xs font-semibold text-cognitiveTeal hover:underline disabled:opacity-50"
          >
            {spellChecking ? 'Revisando ortografía...' : '🔤 Revisar ortografía'}
          </button>

          {spellError && <p className="mt-1 text-xs text-red-500">{spellError}</p>}

          {spellIssues && spellIssues.length === 0 && (
            <p className="mt-1 text-xs text-emerald-600">Sin errores ortográficos encontrados ✓</p>
          )}

          {spellIssues && spellIssues.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {spellIssues.map((issue, i) => (
                <li key={i} className="text-xs bg-warmAmber-light text-warmAmber-hover rounded-md p-1.5">
                  {issue.message}
                  {issue.suggestions?.length > 0 && (
                    <span className="ml-1">
                      {issue.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => applySuggestion(issue, s)}
                          className="ml-1 underline font-semibold"
                        >
                          {s}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {documentId && (
        <CommentsPanel
          apiBase={`/documents/${documentId}`}
          fieldId={field.id}
          comments={comments}
          projectUsers={projectUsers}
          canComment={reviewMode}
          canResolve={!reviewMode}
          onChange={onCommentsChange}
        />
      )}

      {field.type === 'predefined_paragraph' && (
        <ParagraphPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          paragraphs={paragraphsLibrary}
          allowedTags={field.paragraph_tags}
          onSelect={onChange}
        />
      )}
    </div>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
  onBlur,
  readOnly,
  subformsLibrary,
  openPicker,
  canReleaseToMultimedia,
  subformReleaseStatus,
  onReleaseInstance,
}) {
  const base =
    'w-full border border-deepViolet/20 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cognitiveTeal disabled:bg-slate-100 disabled:text-slate-500';

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className={base}
          rows={4}
          value={value || ''}
          placeholder={field.placeholder}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          spellCheck="true"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          className={base}
          value={value ?? ''}
          placeholder={field.placeholder}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );

    case 'select':
      return (
        <select
          className={base}
          value={value || ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        >
          <option value="">{field.placeholder || 'Seleccione una opción'}</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'checkbox':
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((opt) => {
            const checked = Array.isArray(value) && value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={readOnly}
                  onChange={(e) => {
                    const cur = Array.isArray(value) ? value : [];
                    onChange(e.target.checked ? [...cur, opt] : cur.filter((v) => v !== opt));
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );

    case 'predefined_paragraph': {
      const lockedToSelection = !!field.paragraph_lock_to_selection;
      return (
        <div>
          <textarea
            className={base}
            rows={4}
            value={value || ''}
            disabled={readOnly || lockedToSelection}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            spellCheck="true"
            placeholder={
              lockedToSelection
                ? 'Usa el botón para elegir un párrafo predefinido...'
                : 'Selecciona un párrafo predefinido o escribe libremente...'
            }
          />
          {!readOnly && (
            <button
              type="button"
              onClick={openPicker}
              className="mt-1.5 text-xs font-semibold text-cognitiveTeal hover:underline"
            >
              📋 Elegir párrafo predefinido...
            </button>
          )}
        </div>
      );
    }

    case 'subform':
      return (
        <SubformField
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          subformsLibrary={subformsLibrary}
          canReleaseToMultimedia={canReleaseToMultimedia}
          subformReleaseStatus={subformReleaseStatus}
          onReleaseInstance={onReleaseInstance}
        />
      );

    default:
      return (
        <input
          type="text"
          className={base}
          value={value || ''}
          placeholder={field.placeholder}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          spellCheck="true"
        />
      );
  }
}

function SubformField({
  field,
  value,
  onChange,
  readOnly,
  subformsLibrary,
  canReleaseToMultimedia,
  subformReleaseStatus,
  onReleaseInstance,
}) {
  const allowed = (subformsLibrary || []).filter((sf) => (field.subform_ids || []).includes(sf._id));
  const current = value && typeof value === 'object' ? value : { subform_id: allowed[0]?._id || '', instances: [] };

  const selectedSubform = allowed.find((sf) => sf._id === current.subform_id);

  const setSubformType = (subform_id) => onChange({ subform_id, instances: [] });

  const addInstance = () => {
    onChange({
      ...current,
      instances: [...(current.instances || []), { id: crypto.randomUUID(), values: {} }],
    });
  };

  const removeInstance = (idx) => {
    onChange({ ...current, instances: current.instances.filter((_, i) => i !== idx) });
  };

  const updateInstanceValue = (idx, variable, val) => {
    const instances = [...current.instances];
    // Conserva el resto de la instancia (como su "id") al actualizar un valor.
    instances[idx] = { ...instances[idx], values: { ...instances[idx].values, [variable]: val } };
    onChange({ ...current, instances });
  };

  if (allowed.length === 0) {
    return <p className="text-xs text-slate-400">No hay subformularios habilitados para este campo.</p>;
  }

  return (
    <div className="border border-deepViolet/15 rounded-lg p-3 bg-white/60 space-y-3">
      {allowed.length > 1 && (
        <select
          className="border border-deepViolet/20 rounded-lg p-2 text-sm"
          value={current.subform_id}
          disabled={readOnly}
          onChange={(e) => setSubformType(e.target.value)}
        >
          {allowed.map((sf) => (
            <option key={sf._id} value={sf._id}>
              {sf.nombre}
            </option>
          ))}
        </select>
      )}

      {(current.instances || []).map((inst, idx) => {
        const releaseStatus = inst.id ? subformReleaseStatus?.[inst.id] : null;
        return (
        <div key={idx} className="border border-deepViolet/10 rounded-lg p-3 space-y-2 bg-empatheticLinen/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-deepViolet">
              {selectedSubform?.nombre} {inst.codigo ? `(${inst.codigo})` : `#${idx + 1}`}
            </span>
            <div className="flex items-center gap-3">
              {releaseStatus ? (
                <span className="text-[11px] font-semibold text-cognitiveTeal">
                  🎬 En multimedia ({releaseStatus})
                </span>
              ) : (
                canReleaseToMultimedia &&
                inst.id && (
                  <button
                    onClick={() => onReleaseInstance?.(inst.id)}
                    className="text-[11px] font-semibold text-cognitiveTeal hover:underline"
                  >
                    Enviar a multimedia
                  </button>
                )
              )}
              {!readOnly && (
                <button onClick={() => removeInstance(idx)} className="text-xs text-red-500 hover:underline">
                  Quitar
                </button>
              )}
            </div>
          </div>
          {(selectedSubform?.fields || []).map((sf) => (
            <div key={sf.id}>
              <label className="block text-xs font-medium text-slate-600 mb-0.5">{sf.label}</label>
              <FieldInput
                field={sf}
                value={inst.values?.[sf.variable]}
                onChange={(v) => updateInstanceValue(idx, sf.variable, v)}
                readOnly={readOnly}
                subformsLibrary={[]}
                openPicker={() => {}}
              />
            </div>
          ))}
        </div>
        );
      })}

      {!readOnly && (field.allow_multiple_instances || (current.instances || []).length === 0) && (
        <button
          type="button"
          onClick={addInstance}
          className="text-xs font-semibold text-cognitiveTeal hover:underline"
        >
          + Agregar {selectedSubform?.nombre || 'instancia'}
        </button>
      )}
    </div>
  );
}
