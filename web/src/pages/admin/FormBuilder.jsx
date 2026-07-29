import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import FieldEditor from '../../components/form/FieldEditor.jsx';

function newField() {
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: 'Nuevo campo',
    variable: `campo_${Date.now().toString().slice(-4)}`,
    type: 'text',
    required: false,
    placeholder: '',
    instrucciones: '',
    options: [],
    paragraph_tags: [],
    subform_ids: [],
    allow_multiple_instances: false,
    validation: {
      enabled: false,
      description: '',
      pattern: '',
      mode: 'must_match',
      min_length: '',
      max_length: '',
      custom_message: '',
    },
  };
}

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [subformsLibrary, setSubformsLibrary] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    api.get(`/forms/${id}`).then((d) => setForm(d.form));
    api.get('/subforms').then((d) => setSubformsLibrary(d.subforms));
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/forms/${id}`, {
        titulo: form.titulo,
        descripcion: form.descripcion,
        sections: form.sections,
        limites_subformularios: form.limites_subformularios || [],
      });
      setSavedAt(new Date());
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addSection = () => {
    setForm({
      ...form,
      sections: [...form.sections, { id: `sec_${Date.now()}`, titulo: 'Nueva sección', fields: [] }],
    });
  };

  const removeSection = (secId) => {
    setForm({ ...form, sections: form.sections.filter((s) => s.id !== secId) });
  };

  const updateSectionTitle = (secId, titulo) => {
    setForm({
      ...form,
      sections: form.sections.map((s) => (s.id === secId ? { ...s, titulo } : s)),
    });
  };

  const addField = (secId) => {
    setForm({
      ...form,
      sections: form.sections.map((s) => (s.id === secId ? { ...s, fields: [...s.fields, newField()] } : s)),
    });
  };

  const updateField = (secId, fieldId, updated) => {
    setForm({
      ...form,
      sections: form.sections.map((s) =>
        s.id === secId ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? updated : f)) } : s
      ),
    });
  };

  const removeField = (secId, fieldId) => {
    setForm({
      ...form,
      sections: form.sections.map((s) =>
        s.id === secId ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s
      ),
    });
  };

  const addLimit = () => {
    setForm({
      ...form,
      limites_subformularios: [
        ...(form.limites_subformularios || []),
        { id: `limit_${Date.now()}`, subform_id: '', subform_nombre: '', alcance: 'formulario', maximo: '' },
      ],
    });
  };

  const updateLimit = (idx, patch) => {
    const limites = [...(form.limites_subformularios || [])];
    limites[idx] = { ...limites[idx], ...patch };
    setForm({ ...form, limites_subformularios: limites });
  };

  const removeLimit = (idx) => {
    setForm({
      ...form,
      limites_subformularios: (form.limites_subformularios || []).filter((_, i) => i !== idx),
    });
  };

  if (!form) return <p className="text-slate-500">Cargando formulario...</p>;

  const variableCounts = form.sections
    .flatMap((s) => s.fields)
    .reduce((acc, f) => {
      if (f.variable) acc[f.variable] = (acc[f.variable] || 0) + 1;
      return acc;
    }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs text-cognitiveTeal hover:underline">
            ← Volver
          </button>
          <input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="block text-xl font-display font-bold text-deepViolet border-b border-transparent hover:border-deepViolet/20 focus:border-deepViolet focus:outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-emerald-600">Guardado ✓</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar formulario'}
          </button>
        </div>
      </div>

      <textarea
        value={form.descripcion || ''}
        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        placeholder="Descripción del formulario..."
        className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
        rows={2}
      />

      <div className="paper-card rounded-xl p-4 space-y-2">
        <p className="text-sm font-display font-bold text-deepViolet">Límites de subformularios</p>
        <p className="text-xs text-slate-500">
          Opcional: limita cuántas instancias de un tipo de subformulario (ej: "Video") se pueden agregar — en
          todo el formulario, o por sección. Sin ninguna regla aquí, no hay límite.
        </p>
        {(form.limites_subformularios || []).map((limit, idx) => (
          <div key={limit.id} className="flex flex-wrap gap-2 items-center bg-deepViolet/5 rounded-md p-2">
            <select
              className={`border rounded-md p-1.5 text-sm ${
                !limit.subform_id ? 'border-red-400' : 'border-deepViolet/20'
              }`}
              value={limit.subform_id}
              onChange={(e) => {
                const sf = subformsLibrary.find((s) => s._id === e.target.value);
                updateLimit(idx, { subform_id: e.target.value, subform_nombre: sf?.nombre || '' });
              }}
            >
              <option value="">Selecciona un subformulario...</option>
              {subformsLibrary.map((sf) => (
                <option key={sf._id} value={sf._id}>
                  {sf.nombre}
                </option>
              ))}
            </select>
            <select
              className="border border-deepViolet/20 rounded-md p-1.5 text-sm"
              value={limit.alcance}
              onChange={(e) => updateLimit(idx, { alcance: e.target.value })}
            >
              <option value="formulario">Total en todo el formulario</option>
              <option value="seccion">Por sección</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              Máximo
              <input
                type="number"
                min="1"
                className={`w-20 border rounded-md p-1.5 text-sm ${
                  !limit.maximo ? 'border-red-400' : 'border-deepViolet/20'
                }`}
                value={limit.maximo}
                onChange={(e) => updateLimit(idx, { maximo: e.target.value })}
              />
            </label>
            <button onClick={() => removeLimit(idx)} className="text-red-500 text-xs hover:underline ml-auto">
              Eliminar
            </button>
          </div>
        ))}
        <button onClick={addLimit} className="text-xs font-semibold text-cognitiveTeal hover:underline">
          + Agregar límite
        </button>
        {subformsLibrary.length === 0 && (
          <p className="text-xs text-slate-400">No hay subformularios creados aún (Biblioteca de subformularios).</p>
        )}
      </div>

      {form.sections.map((section) => (
        <div key={section.id} className="paper-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <input
              value={section.titulo}
              onChange={(e) => updateSectionTitle(section.id, e.target.value)}
              className="font-display font-bold text-deepViolet bg-transparent border-b border-transparent hover:border-deepViolet/20 focus:border-deepViolet focus:outline-none flex-1"
            />
            <button onClick={() => removeSection(section.id)} className="text-xs text-red-500 hover:underline">
              Eliminar sección
            </button>
          </div>

          <div className="space-y-3">
            {section.fields.map((field) => (
              <FieldEditor
                key={field.id}
                field={field}
                subformsLibrary={subformsLibrary}
                duplicateVariable={variableCounts[field.variable] > 1}
                onUpdate={(updated) => updateField(section.id, field.id, updated)}
                onRemove={() => removeField(section.id, field.id)}
              />
            ))}
          </div>

          <button
            onClick={() => addField(section.id)}
            className="text-sm font-semibold text-cognitiveTeal hover:underline"
          >
            + Agregar campo
          </button>
        </div>
      ))}

      <button
        onClick={addSection}
        className="w-full border-2 border-dashed border-deepViolet/20 rounded-xl py-3 text-sm font-semibold text-deepViolet/60 hover:text-deepViolet hover:border-deepViolet/40"
      >
        + Agregar sección
      </button>
    </div>
  );
}
