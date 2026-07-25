import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api.js';

export default function ProjectFormsTab({ projectId, readOnly }) {
  const [tab, setTab] = useState('formularios'); // 'formularios' | 'papelera'
  const [forms, setForms] = useState([]);
  const [trashedForms, setTrashedForms] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(null);

  const load = async () => {
    setLoading(true);
    const [formsData, trashData, typesData] = await Promise.all([
      api.get(`/forms?project_id=${projectId}`),
      api.get(`/forms?project_id=${projectId}&trashed=1`),
      api.get('/document-types'),
    ]);
    setForms(formsData.forms);
    setTrashedForms(trashData.forms);
    setDocTypes(typesData.document_types);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const createForm = async (e) => {
    e.preventDefault();
    await api.post('/forms', {
      project_id: projectId,
      titulo,
      document_type_id: documentTypeId || null,
      sections: [{ id: `sec_${Date.now()}`, titulo: 'Información general', fields: [] }],
    });
    setTitulo('');
    setDocumentTypeId('');
    setShowForm(false);
    load();
  };

  const startEdit = (f) => {
    setEditingId(f._id);
    setEditValues({ titulo: f.titulo, document_type_id: f.document_type_id || '' });
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/forms/${id}`, {
        titulo: editValues.titulo,
        document_type_id: editValues.document_type_id || null,
      });
      setEditingId(null);
      setEditValues(null);
      load();
    } catch (err) {
      alert('No se pudo guardar: ' + err.message);
    }
  };

  const deleteForm = async (f) => {
    if (!window.confirm(`¿Enviar el formulario "${f.titulo}" a la papelera? Podrás restaurarlo luego.`)) {
      return;
    }
    try {
      await api.del(`/forms/${f._id}`);
      load();
    } catch (err) {
      alert('No se pudo eliminar: ' + err.message);
    }
  };

  const restoreForm = async (id) => {
    try {
      await api.put(`/forms/${id}`, { eliminado: false });
      load();
    } catch (err) {
      alert('No se pudo restaurar: ' + err.message);
    }
  };

  const docTypeName = (id) => docTypes.find((t) => t.id === id)?.nombre || '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('formularios')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'formularios' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            Formularios
          </button>
          <button
            onClick={() => setTab('papelera')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'papelera' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            🗑️ Papelera {trashedForms.length > 0 && `(${trashedForms.length})`}
          </button>
        </div>

        {!readOnly && tab === 'formularios' && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            + Nuevo formulario
          </button>
        )}
      </div>

      {showForm && tab === 'formularios' && (
        <form onSubmit={createForm} className="paper-card rounded-xl p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Título del formulario</label>
            <input
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de documento</label>
            <select
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              <option value="">Sin especificar</option>
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold">
            Crear
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : tab === 'formularios' ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {forms.map((f) => (
            <div key={f._id} className="paper-card rounded-xl p-4 space-y-2">
              {editingId === f._id ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Título</label>
                    <input
                      value={editValues.titulo}
                      onChange={(e) => setEditValues({ ...editValues, titulo: e.target.value })}
                      className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de documento</label>
                    <select
                      value={editValues.document_type_id}
                      onChange={(e) => setEditValues({ ...editValues, document_type_id: e.target.value })}
                      className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                    >
                      <option value="">Sin especificar</option>
                      {docTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => saveEdit(f._id)}
                      className="px-3 py-1.5 rounded-lg bg-deepViolet text-white text-xs font-semibold"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditValues(null);
                      }}
                      className="text-xs font-semibold text-slate-400 hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link to={`/admin/formularios/${f._id}`} className="block hover:opacity-80 transition">
                    <p className="font-semibold text-deepViolet">{f.titulo}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {docTypeName(f.document_type_id)} · {f.sections?.length || 0} sección(es) ·{' '}
                      {f.sections?.reduce((acc, s) => acc + s.fields.length, 0) || 0} campo(s)
                    </p>
                  </Link>
                  {!readOnly && (
                    <div className="flex gap-3 pt-1 border-t border-deepViolet/10 mt-2">
                      <button
                        onClick={() => startEdit(f)}
                        className="text-xs font-semibold text-deepViolet hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteForm(f)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {forms.length === 0 && <p className="text-slate-400 text-sm">Aún no hay formularios en este proyecto.</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {trashedForms.map((f) => (
            <div key={f._id} className="paper-card rounded-xl p-4 space-y-2">
              <p className="font-semibold text-deepViolet">{f.titulo}</p>
              <p className="text-xs text-slate-500">
                {docTypeName(f.document_type_id)} · {f.sections?.length || 0} sección(es) ·{' '}
                {f.sections?.reduce((acc, s) => acc + s.fields.length, 0) || 0} campo(s)
              </p>
              {!readOnly && (
                <button
                  onClick={() => restoreForm(f._id)}
                  className="text-xs font-semibold text-cognitiveTeal hover:underline"
                >
                  ♻️ Restaurar
                </button>
              )}
            </div>
          ))}
          {trashedForms.length === 0 && <p className="text-slate-400 text-sm">La papelera está vacía.</p>}
        </div>
      )}
    </div>
  );
}
