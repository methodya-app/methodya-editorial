import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import StateBadge from './StateBadge.jsx';
import { FieldInput } from './form/FormRenderer.jsx';

// Vista de solo lectura del contenido de UNA instancia de subformulario (no
// el documento completo): mismos datos que ya carga MultimediaSubformDetail
// para su sección "Contenido del subformulario", pero en un modal liviano
// para abrir desde un listado sin navegar a la pantalla de gestión de la
// tarea.
export default function SubformPreviewModal({ open, onClose, assignmentId }) {
  const [assignment, setAssignment] = useState(null);
  const [subform, setSubform] = useState(null);
  const [instanceValues, setInstanceValues] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !assignmentId) return;
    setLoading(true);
    setAssignment(null);
    api
      .get(`/subform-assignments/${assignmentId}`)
      .then(async (res) => {
        setAssignment(res.assignment);
        const [sf, preview] = await Promise.all([
          api.get(`/subforms/${res.assignment.subform_id}`),
          api.get(`/subform-assignments/${assignmentId}/document-preview`),
        ]);
        setSubform(sf.subform);
        const inst = preview.values?.[res.assignment.field_variable]?.instances?.find(
          (i) => i.id === res.assignment.instance_id
        );
        setInstanceValues(inst?.values || {});
      })
      .finally(() => setLoading(false));
  }, [open, assignmentId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-deepViolet/10 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-deepViolet">
              {assignment?.subform_nombre || 'Subformulario'}
              {assignment?.subform_codigo && (
                <span className="font-mono text-sm"> — {assignment.subform_codigo}</span>
              )}
            </h3>
            {assignment && <StateBadge estado={assignment.estado} />}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="overflow-y-auto custom-scrollbar p-4 flex-1 bg-empatheticLinen/40 space-y-4">
          {loading && <p className="text-sm text-slate-500">Cargando subformulario...</p>}
          {!loading &&
            (subform?.fields || []).map((f) => (
              <div key={f.id}>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{f.label}</label>
                <FieldInput
                  field={f}
                  value={instanceValues[f.variable]}
                  onChange={() => {}}
                  readOnly
                  subformsLibrary={[]}
                  openPicker={() => {}}
                />
              </div>
            ))}
          {!loading && (!subform?.fields || subform.fields.length === 0) && (
            <p className="text-sm text-slate-400">Este subformulario no tiene campos.</p>
          )}
        </div>
      </div>
    </div>
  );
}
