import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import StateBadge from './StateBadge.jsx';
import FormRenderer from './form/FormRenderer.jsx';

// Vista de solo lectura del documento completo. Sirve para dos casos: dar
// contexto de una tarea multimedia (assignmentId) o ver un documento
// directamente desde cualquier listado administrativo (documentId) — cada
// uno usa su propio endpoint de vista previa, pero el mismo modal.
export default function DocumentPreviewModal({ open, onClose, assignmentId, documentId }) {
  const [data, setData] = useState(null);
  const [subformsLibrary, setSubformsLibrary] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || (!assignmentId && !documentId)) return;
    setLoading(true);
    setData(null);
    const endpoint = assignmentId
      ? `/subform-assignments/${assignmentId}/document-preview`
      : `/documents/${documentId}/preview`;
    Promise.all([api.get(endpoint), api.get('/subforms')])
      .then(([preview, subforms]) => {
        setData(preview);
        setSubformsLibrary(subforms.subforms);
      })
      .finally(() => setLoading(false));
  }, [open, assignmentId, documentId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-deepViolet/10 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-deepViolet">
              Documento completo {data?.document && <span className="font-mono text-sm">— {data.document.codigo}</span>}
            </h3>
            {data?.document && <StateBadge estado={data.document.estado} />}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="overflow-y-auto custom-scrollbar p-4 flex-1 bg-empatheticLinen/40">
          {loading && <p className="text-sm text-slate-500">Cargando documento...</p>}
          {data?.form && (
            <FormRenderer
              form={data.form}
              values={data.values}
              onChange={() => {}}
              readOnly
              subformsLibrary={subformsLibrary}
              projectPoblaciones={data.project_poblaciones}
              projectTemas={data.project_temas}
              projectDotacionReferencias={data.project_dotacion_referencias}
            />
          )}
        </div>
      </div>
    </div>
  );
}
