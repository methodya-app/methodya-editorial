import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import StateBadge from '../../components/StateBadge.jsx';
import CommentsPanel from '../../components/CommentsPanel.jsx';
import FormRenderer from '../../components/form/FormRenderer.jsx';

// Tarea de Implementación: el documento completo en solo lectura (mismo
// FormRenderer que usa el editor/DocumentPreviewModal, con readOnly) más
// comentarios y transición de estado. A diferencia de
// MultimediaSubformDetail.jsx no hay subida de recursos ni exportación —
// acá no se produce nada, solo se revisa e implementa.
export default function ImplementationDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [subformsLibrary, setSubformsLibrary] = useState([]);
  const [toast, setToast] = useState('');

  const load = async () => {
    const res = await api.get(`/implementations/${id}`);
    setData(res);
    const [previewData, subforms] = await Promise.all([
      api.get(`/implementations/${id}/document-preview`),
      api.get('/subforms'),
    ]);
    setPreview(previewData);
    setSubformsLibrary(subforms.subforms);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <p className="text-slate-500">Cargando...</p>;
  const { implementation, is_mine, is_lider, can_claim } = data;

  const claim = async () => {
    try {
      await api.post(`/implementations/${id}/claim`);
      load();
    } catch (err) {
      setToast(err.message);
    }
  };

  const transition = async (action) => {
    try {
      await api.post(`/implementations/${id}/transition`, { action });
      load();
    } catch (err) {
      setToast(err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div>
        <Link to={`/implementacion/${implementation.project_id}`} className="text-xs text-cognitiveTeal hover:underline">
          ← Volver
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="font-display font-bold text-xl text-deepViolet font-mono">{implementation.document_codigo}</h2>
          <StateBadge estado={implementation.estado} />
        </div>
      </div>

      {toast && <div className="text-sm bg-warmAmber-light text-warmAmber-hover rounded-lg p-2.5">{toast}</div>}

      {can_claim && !is_mine && (
        <div className="paper-card rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">Esta tarea está disponible.</p>
          <button onClick={claim} className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold">
            Tomar esta tarea
          </button>
        </div>
      )}

      <div className="paper-card rounded-xl p-5">
        <h3 className="font-display font-bold text-deepViolet mb-3">Documento completo (solo lectura)</h3>
        {preview?.form ? (
          <FormRenderer
            form={preview.form}
            values={preview.values}
            onChange={() => {}}
            readOnly
            subformsLibrary={subformsLibrary}
            projectPoblaciones={preview.project_poblaciones}
            projectTemas={preview.project_temas}
            projectDotacionReferencias={preview.project_dotacion_referencias}
          />
        ) : (
          <p className="text-sm text-slate-400">Este documento aún no tiene contenido diligenciado.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(is_mine || is_lider) && implementation.estado === 'Pendiente' && (
          <button
            onClick={() => transition('start')}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            Marcar en proceso
          </button>
        )}
        {(is_mine || is_lider) && implementation.estado === 'En proceso' && (
          <>
            <button
              onClick={() => transition('stop')}
              className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-semibold"
            >
              Detener
            </button>
            <button
              onClick={() => transition('finish')}
              className="px-4 py-2 rounded-lg bg-activeMint text-emerald-900 text-sm font-semibold"
            >
              ✓ Marcar como implementado
            </button>
          </>
        )}
        {(is_mine || is_lider) && implementation.estado === 'Detenido' && (
          <button
            onClick={() => transition('resume')}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            Reanudar
          </button>
        )}
      </div>

      <div className="paper-card rounded-xl p-4">
        <h3 className="font-display font-bold text-deepViolet mb-2">Comentarios</h3>
        <CommentsPanel
          apiBase={`/implementations/${id}`}
          comments={implementation.comments}
          projectUsers={[]}
          canComment={is_mine || is_lider}
          canResolve={is_lider}
          onChange={load}
        />
      </div>
    </div>
  );
}
