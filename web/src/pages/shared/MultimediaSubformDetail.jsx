import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, apiUrl, authHeaders } from '../../lib/api.js';
import StateBadge from '../../components/StateBadge.jsx';
import CommentsPanel from '../../components/CommentsPanel.jsx';
import DocumentPreviewModal from '../../components/DocumentPreviewModal.jsx';
import { FieldInput } from '../../components/form/FormRenderer.jsx';

export default function MultimediaSubformDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [subform, setSubform] = useState(null);
  const [instanceValues, setInstanceValues] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef(null);

  const load = async () => {
    const res = await api.get(`/subform-assignments/${id}`);
    setData(res);
    const [sf, preview] = await Promise.all([
      api.get(`/subforms/${res.assignment.subform_id}`),
      api.get(`/subform-assignments/${id}/document-preview`),
    ]);
    setSubform(sf.subform);
    const inst = preview.values?.[res.assignment.field_variable]?.instances?.find(
      (i) => i.id === res.assignment.instance_id
    );
    setInstanceValues(inst?.values || {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <p className="text-slate-500">Cargando...</p>;
  const { assignment, is_mine, is_coordinator, can_claim } = data;

  const claim = async () => {
    try {
      await api.post(`/subform-assignments/${id}/claim`);
      load();
    } catch (err) {
      setToast(err.message);
    }
  };

  const transition = async (action) => {
    try {
      await api.post(`/subform-assignments/${id}/transition`, { action });
      load();
    } catch (err) {
      setToast(err.message);
    }
  };

  const downloadDoc = async () => {
    try {
      const result = await api.get(`/subform-assignments/${id}/export?formato=doc`);
      window.open(result.url, '_blank');
    } catch (err) {
      setToast('No se pudo generar el Google Doc: ' + err.message);
    }
  };

  const downloadPdf = async () => {
    try {
      const resp = await fetch(apiUrl(`/subform-assignments/${id}/export?formato=pdf`), {
        headers: authHeaders(),
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${assignment.subform_nombre}-${assignment.document_codigo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast('No se pudo generar el PDF: ' + err.message);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setToast('');
    try {
      const session = await api.post(`/subform-assignments/${id}/upload-session`, {
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });
      // Content-Range es obligatorio para que Drive acepte la subida
      // completa en una sola petición (si no, exige múltiplos de 256KB
      // salvo que se marque explícitamente como el tramo final).
      const uploadResp = await fetch(session.upload_url, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes 0-${file.size - 1}/${file.size}` },
        body: file,
      });
      if (!uploadResp.ok) throw new Error(`Google Drive respondió con error ${uploadResp.status}`);
      const uploaded = await uploadResp.json();
      await api.post(`/subform-assignments/${id}/resources`, {
        drive_file_id: uploaded.id,
        nombre: uploaded.name,
        url: uploaded.webViewLink,
        mime_type: uploaded.mimeType,
        size: file.size,
      });
      await load();
      setToast('Archivo cargado ✓');
    } catch (err) {
      setToast('No se pudo cargar el archivo: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRename = (recurso) => {
    setRenamingId(recurso.id);
    setRenameValue(recurso.nombre);
  };

  const saveRename = async () => {
    try {
      await api.put(`/subform-assignments/${id}/resources`, { resource_id: renamingId, nombre: renameValue });
      setRenamingId(null);
      load();
    } catch (err) {
      setToast('No se pudo renombrar: ' + err.message);
    }
  };

  const deleteResource = async (resourceId) => {
    if (!window.confirm('¿Eliminar este recurso de Drive?')) return;
    try {
      await api.del(`/subform-assignments/${id}/resources`, { resource_id: resourceId });
      load();
    } catch (err) {
      setToast('No se pudo eliminar: ' + err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div>
        <Link to={`/multimedia/${assignment.project_id}`} className="text-xs text-cognitiveTeal hover:underline">
          ← Volver
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="font-display font-bold text-xl text-deepViolet">{assignment.subform_nombre}</h2>
          <StateBadge estado={assignment.estado} />
        </div>
        <p className="text-sm text-slate-500 font-mono">{assignment.document_codigo}</p>
        <button
          onClick={() => setPreviewOpen(true)}
          className="mt-2 text-xs font-semibold text-cognitiveTeal hover:underline"
        >
          📄 Ver documento completo
        </button>
      </div>

      {toast && (
        <div className="text-sm bg-warmAmber-light text-warmAmber-hover rounded-lg p-2.5">{toast}</div>
      )}

      {can_claim && !is_mine && (
        <div className="paper-card rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">Esta tarea está disponible.</p>
          <button onClick={claim} className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold">
            Tomar esta tarea
          </button>
        </div>
      )}

      <div className="paper-card rounded-xl p-5 space-y-4">
        <h3 className="font-display font-bold text-deepViolet">Contenido del subformulario (solo lectura)</h3>
        {(subform?.fields || []).map((f) => (
          <div key={f.id}>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{f.label}</label>
            <FieldInput field={f} value={instanceValues[f.variable]} onChange={() => {}} readOnly subformsLibrary={[]} openPicker={() => {}} />
          </div>
        ))}
        {(!subform?.fields || subform.fields.length === 0) && (
          <p className="text-sm text-slate-400">Este subformulario no tiene campos.</p>
        )}
      </div>

      <div className="paper-card rounded-xl p-5 space-y-3">
        <h3 className="font-display font-bold text-deepViolet">Descargar para referencia</h3>
        <div className="flex gap-3">
          <button onClick={downloadDoc} className="text-sm font-semibold text-cognitiveTeal hover:underline">
            Descargar Google Doc
          </button>
          <button onClick={downloadPdf} className="text-sm font-semibold text-cognitiveTeal hover:underline">
            Descargar PDF
          </button>
        </div>
      </div>

      <div className="paper-card rounded-xl p-5 space-y-3">
        <h3 className="font-display font-bold text-deepViolet">Recurso resultante</h3>
        <div className="space-y-2">
          {(assignment.recursos || []).map((r) => (
            <div key={r.id} className="flex items-center justify-between border border-deepViolet/10 rounded-lg p-2.5">
              {renamingId === r.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 border border-deepViolet/20 rounded-lg p-1.5 text-sm"
                  />
                  <button onClick={saveRename} className="text-xs font-semibold text-cognitiveTeal hover:underline">
                    Guardar
                  </button>
                  <button onClick={() => setRenamingId(null)} className="text-xs text-slate-400 hover:underline">
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-cognitiveTeal hover:underline break-all">
                    {r.nombre} ↗
                  </a>
                  {(is_mine || is_coordinator) && (
                    <div className="flex gap-2 shrink-0 ml-2">
                      <button onClick={() => startRename(r)} className="text-xs font-semibold text-deepViolet hover:underline">
                        Renombrar
                      </button>
                      <button onClick={() => deleteResource(r.id)} className="text-xs text-red-500 hover:underline">
                        Eliminar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {(assignment.recursos || []).length === 0 && (
            <p className="text-sm text-slate-400">Aún no se ha cargado ningún recurso.</p>
          )}
        </div>

        {(is_mine || is_coordinator) && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => uploadFile(e.target.files?.[0])}
              disabled={uploading}
              className="text-sm"
            />
            {uploading && <p className="text-xs text-cognitiveTeal mt-1">Cargando a Google Drive...</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {is_mine && assignment.estado === 'Asignado' && (
          <button
            onClick={() => transition('start')}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            Marcar en proceso
          </button>
        )}
        {is_mine && assignment.estado === 'En proceso' && (
          <button
            onClick={() => transition('finish')}
            className="px-4 py-2 rounded-lg bg-activeMint text-emerald-900 text-sm font-semibold"
          >
            ✓ Marcar como finalizado
          </button>
        )}
        {is_coordinator && assignment.estado !== 'Eliminado' && (
          <button
            onClick={() => transition('trash')}
            className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-semibold"
          >
            Enviar a la papelera
          </button>
        )}
        {is_coordinator && assignment.estado === 'Eliminado' && (
          <button
            onClick={() => transition('restore')}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            ♻️ Restaurar
          </button>
        )}
      </div>

      <div className="paper-card rounded-xl p-4">
        <h3 className="font-display font-bold text-deepViolet mb-2">Comentarios</h3>
        <CommentsPanel
          apiBase={`/subform-assignments/${id}`}
          comments={assignment.comments}
          projectUsers={[]}
          canComment={is_mine || is_coordinator}
          canResolve={is_coordinator}
          onChange={load}
        />
      </div>

      <DocumentPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} assignmentId={id} />
    </div>
  );
}
