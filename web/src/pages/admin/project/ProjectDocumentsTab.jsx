import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import StateBadge from '../../../components/StateBadge.jsx';
import ProcessingModal from '../../../components/ProcessingModal.jsx';
import ProjectSubformsTab from './ProjectSubformsTab.jsx';
import { showAlert } from '../../../lib/alertModal.js';

// Estados válidos para editar/restaurar un documento (todos menos
// "Eliminado", que se maneja aparte con el botón dedicado de la papelera).
const EDITABLE_STATES = [
  'Pendiente',
  'En proceso',
  'Devuelto',
  'Revisión Pedagógica',
  'Revisión Estilo',
  'Producción Multimedia',
  'Detenido',
  'Finalizado',
];

// Estados en los que el Creador Experto (humano o agente sintético) puede
// generar/editar contenido — mismo criterio que EDITABLE_STATES.creador en
// api/_lib/documentData.js. Fuera de estos, "Generar con IA" no debe
// mostrarse (el backend lo rechazaría igual, pero mostrarlo confunde).
const CREADOR_EDITABLE_STATES = ['Pendiente', 'En proceso', 'Devuelto'];

function usersByRole(projectUsers, role) {
  return projectUsers.filter((pu) => pu.role === role);
}

export default function ProjectDocumentsTab({ projectId, readOnly }) {
  const [tab, setTab] = useState('documentos'); // 'documentos' | 'subformularios' | 'papelera'
  const [documents, setDocuments] = useState([]);
  const [trashedDocuments, setTrashedDocuments] = useState([]);
  const [forms, setForms] = useState([]);
  const [projectUsers, setProjectUsers] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [formId, setFormId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [poblacionObjetivoId, setPoblacionObjetivoId] = useState('');
  const [projectPoblaciones, setProjectPoblaciones] = useState([]);
  const [creadorId, setCreadorId] = useState('');
  const [revisorPedagogicoId, setRevisorPedagogicoId] = useState('');
  const [revisorEstiloId, setRevisorEstiloId] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [restoreEstado, setRestoreEstado] = useState('Pendiente');
  const [vaciandoId, setVaciandoId] = useState(null);
  const [generandoId, setGenerandoId] = useState(null);

  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterCreador, setFilterCreador] = useState('');
  const [filterRevisorPedagogico, setFilterRevisorPedagogico] = useState('');
  const [filterRevisorEstilo, setFilterRevisorEstilo] = useState('');

  const hasActiveFilters =
    filterCodigo || filterTipo || filterEstado || filterCreador || filterRevisorPedagogico || filterRevisorEstilo;

  const clearFilters = () => {
    setFilterCodigo('');
    setFilterTipo('');
    setFilterEstado('');
    setFilterCreador('');
    setFilterRevisorPedagogico('');
    setFilterRevisorEstilo('');
  };

  const filteredDocuments = documents.filter((d) => {
    if (filterCodigo && !d.codigo.toLowerCase().includes(filterCodigo.toLowerCase())) return false;
    if (filterTipo && d.document_type_id !== filterTipo) return false;
    if (filterEstado && d.estado !== filterEstado) return false;
    if (filterCreador && d.creador_id !== filterCreador) return false;
    if (filterRevisorPedagogico && d.revisor_pedagogico_id !== filterRevisorPedagogico) return false;
    if (filterRevisorEstilo && d.revisor_estilo_id !== filterRevisorEstilo) return false;
    return true;
  });

  const load = async () => {
    setLoading(true);
    const [docsData, trashData, formsData, usersData, typesData, parametrizacionData, poblacionesData] =
      await Promise.all([
        api.get(`/projects/${projectId}/documents`),
        api.get(`/projects/${projectId}/documents?trashed=1`),
        api.get(`/forms?project_id=${projectId}`),
        api.get(`/projects/${projectId}/users`),
        api.get('/document-types'),
        api.get(`/projects/${projectId}/parametrizacion`),
        api.get('/poblaciones-objetivo'),
      ]);
    setDocuments(docsData.documents);
    setTrashedDocuments(trashData.documents);
    setForms(formsData.forms);
    setProjectUsers(usersData.project_users);
    setDocTypes(typesData.document_types);
    const allowedIds = parametrizacionData.parametrizacion?.poblacion_objetivo?.poblacion_ids || [];
    setProjectPoblaciones(poblacionesData.poblaciones_objetivo.filter((p) => allowedIds.includes(p.id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const createDocument = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/documents`, {
        codigo,
        form_id: formId,
        document_type_id: documentTypeId || null,
        poblacion_objetivo_id: poblacionObjetivoId,
        creador_id: creadorId || null,
        revisor_pedagogico_id: revisorPedagogicoId || null,
        revisor_estilo_id: revisorEstiloId || null,
      });
      setCodigo('');
      setPoblacionObjetivoId('');
      setShowForm(false);
      load();
    } catch (err) {
      showAlert('No se pudo crear: ' + err.message);
    }
  };

  const vaciar = async (id) => {
    if (vaciandoId) return; // ya hay un vaciamiento en curso, ignora el doble clic
    setVaciandoId(id);
    try {
      const result = await api.post(`/documents/${id}/vaciar`);
      showAlert(
        result.real
          ? 'Vaciamiento ejecutado en Google Drive. Puedes verlo en el detalle del documento.'
          : 'Vaciamiento simulado ejecutado. Puedes verlo en el detalle del documento.'
      );
      load();
    } catch (err) {
      showAlert(err.message);
    } finally {
      setVaciandoId(null);
    }
  };

  const generar = async (id) => {
    if (generandoId) return; // ya hay una generación en curso, ignora el doble clic
    setGenerandoId(id);
    try {
      const result = await api.post(`/documents/${id}/generate`);
      if (result.needs_human_review) {
        showAlert(
          'El agente generó un borrador pero no logró pasar la validación tras varios intentos. ' +
            'Quedó guardado como borrador: revísalo y corrígelo manualmente.',
          'revision'
        );
      } else {
        showAlert('Contenido generado y validado ✓. Puedes revisarlo en el detalle del documento.', 'exito');
      }
      load();
    } catch (err) {
      showAlert('No se pudo generar: ' + err.message, 'error');
    } finally {
      setGenerandoId(null);
    }
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setEditValues({
      estado: d.estado,
      poblacion_objetivo_id: d.poblacion_objetivo_id || '',
      creador_id: d.creador_id || '',
      revisor_pedagogico_id: d.revisor_pedagogico_id || '',
      revisor_estilo_id: d.revisor_estilo_id || '',
    });
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/documents/${id}`, {
        estado: editValues.estado,
        poblacion_objetivo_id: editValues.poblacion_objetivo_id,
        creador_id: editValues.creador_id || null,
        revisor_pedagogico_id: editValues.revisor_pedagogico_id || null,
        revisor_estilo_id: editValues.revisor_estilo_id || null,
      });
      setEditingId(null);
      setEditValues(null);
      load();
    } catch (err) {
      showAlert('No se pudo guardar: ' + err.message);
    }
  };

  const deleteDocument = async (d) => {
    if (!window.confirm(`¿Enviar el documento "${d.codigo}" a la papelera? Podrás restaurarlo luego.`)) {
      return;
    }
    try {
      await api.put(`/documents/${d.id}`, { estado: 'Eliminado' });
      load();
    } catch (err) {
      showAlert('No se pudo eliminar: ' + err.message);
    }
  };

  const startRestore = (d) => {
    setRestoringId(d.id);
    setRestoreEstado('Pendiente');
  };

  const confirmRestore = async (id) => {
    try {
      await api.put(`/documents/${id}`, { estado: restoreEstado });
      setRestoringId(null);
      load();
    } catch (err) {
      showAlert('No se pudo restaurar: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('documentos')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'documentos' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            Documentos
          </button>
          <button
            onClick={() => setTab('subformularios')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'subformularios' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            Subformularios
          </button>
          <button
            onClick={() => setTab('papelera')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'papelera' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            🗑️ Papelera {trashedDocuments.length > 0 && `(${trashedDocuments.length})`}
          </button>
        </div>

        {!readOnly && tab === 'documentos' && (
          <button
            onClick={() => setShowForm((s) => !s)}
            disabled={projectPoblaciones.length === 0}
            title={
              projectPoblaciones.length === 0
                ? 'Configura al menos una población objetivo en Parametrización antes de crear documentos'
                : undefined
            }
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Nuevo registro
          </button>
        )}
      </div>

      {!readOnly && tab === 'documentos' && projectPoblaciones.length === 0 && (
        <div className="text-sm text-warmAmber-hover bg-warmAmber-light rounded-lg p-3">
          Este proyecto no tiene poblaciones objetivo configuradas. Ve a la pestaña{' '}
          <strong>Parametrización → Población objetivo</strong> y selecciona al menos una antes de crear
          documentos: cada documento debe indicar a cuál va dirigido.
        </div>
      )}

      {showForm && tab === 'documentos' && (
        <form onSubmit={createDocument} className="paper-card rounded-xl p-4 grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Código</label>
            <input
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: CLAS-BIO-001"
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Formulario</label>
            <select
              required
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {forms.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.titulo}
                </option>
              ))}
            </select>
          </div>
          <div>
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
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Población objetivo</label>
            <select
              required
              value={poblacionObjetivoId}
              onChange={(e) => setPoblacionObjetivoId(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {projectPoblaciones.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.edad_min}-{p.edad_max} años)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Creador Experto</label>
            <select
              value={creadorId}
              onChange={(e) => setCreadorId(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {usersByRole(projectUsers, 'Creador Experto').map((pu) => (
                <option key={pu.profiles.id} value={pu.profiles.id}>
                  {pu.profiles.nombre} {pu.profiles.apellido}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Revisor Pedagógico</label>
            <select
              value={revisorPedagogicoId}
              onChange={(e) => setRevisorPedagogicoId(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {usersByRole(projectUsers, 'Revisor Pedagógico').map((pu) => (
                <option key={pu.profiles.id} value={pu.profiles.id}>
                  {pu.profiles.nombre} {pu.profiles.apellido}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Revisor de Estilo</label>
            <select
              value={revisorEstiloId}
              onChange={(e) => setRevisorEstiloId(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {usersByRole(projectUsers, 'Revisor de Estilo').map((pu) => (
                <option key={pu.profiles.id} value={pu.profiles.id}>
                  {pu.profiles.nombre} {pu.profiles.apellido}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <button type="submit" className="px-4 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold">
              Crear documento
            </button>
          </div>
        </form>
      )}

      {!loading && tab === 'documentos' && (
        <div className="paper-card rounded-xl p-3 grid sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Código</label>
            <input
              value={filterCodigo}
              onChange={(e) => setFilterCodigo(e.target.value)}
              placeholder="Buscar..."
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tipo de documento</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {docTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {EDITABLE_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Creador Experto</label>
            <select
              value={filterCreador}
              onChange={(e) => setFilterCreador(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {usersByRole(projectUsers, 'Creador Experto').map((pu) => (
                <option key={pu.profiles.id} value={pu.profiles.id}>
                  {pu.profiles.nombre} {pu.profiles.apellido}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Revisor Pedagógico</label>
            <select
              value={filterRevisorPedagogico}
              onChange={(e) => setFilterRevisorPedagogico(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {usersByRole(projectUsers, 'Revisor Pedagógico').map((pu) => (
                <option key={pu.profiles.id} value={pu.profiles.id}>
                  {pu.profiles.nombre} {pu.profiles.apellido}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Revisor de Estilo</label>
              <select
                value={filterRevisorEstilo}
                onChange={(e) => setFilterRevisorEstilo(e.target.value)}
                className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
              >
                <option value="">Todos</option>
                {usersByRole(projectUsers, 'Revisor de Estilo').map((pu) => (
                  <option key={pu.profiles.id} value={pu.profiles.id}>
                    {pu.profiles.nombre} {pu.profiles.apellido}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-red-500 hover:underline whitespace-nowrap pb-1.5"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : tab === 'subformularios' ? (
        <ProjectSubformsTab projectId={projectId} />
      ) : tab === 'documentos' ? (
        <div className="paper-card rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Tipo de documento</th>
                <th className="p-3">Población objetivo</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Creador Experto</th>
                <th className="p-3">Revisor Pedagógico</th>
                <th className="p-3">Revisor de Estilo</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((d) => (
                <Fragment key={d.id}>
                  <tr className="border-t border-deepViolet/10">
                    <td className="p-3 font-mono text-xs">
                      <Link to={`/documentos/${d.id}`} className="text-cognitiveTeal hover:underline">
                        {d.codigo}
                      </Link>
                    </td>
                    <td className="p-3 text-xs">{d.document_types?.nombre || '—'}</td>
                    <td className="p-3 text-xs">
                      {d.poblaciones_objetivo
                        ? `${d.poblaciones_objetivo.nombre} (${d.poblaciones_objetivo.edad_min}-${d.poblaciones_objetivo.edad_max})`
                        : '—'}
                    </td>
                    <td className="p-3"><StateBadge estado={d.estado} /></td>
                    <td className="p-3 text-xs">{d.creador ? `${d.creador.nombre} ${d.creador.apellido}` : '—'}</td>
                    <td className="p-3 text-xs">
                      {d.revisor_pedagogico ? `${d.revisor_pedagogico.nombre} ${d.revisor_pedagogico.apellido}` : '—'}
                    </td>
                    <td className="p-3 text-xs">
                      {d.revisor_estilo ? `${d.revisor_estilo.nombre} ${d.revisor_estilo.apellido}` : '—'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {!readOnly && (
                        <>
                          <button
                            onClick={() => (editingId === d.id ? setEditingId(null) : startEdit(d))}
                            className="text-xs font-semibold text-deepViolet hover:underline mr-3"
                          >
                            {editingId === d.id ? 'Cancelar' : 'Editar'}
                          </button>
                          {d.creador?.is_synthetic && CREADOR_EDITABLE_STATES.includes(d.estado) && (
                            <button
                              onClick={() => generar(d.id)}
                              disabled={!!generandoId}
                              className="text-xs font-semibold text-cognitiveTeal hover:underline mr-3 disabled:opacity-50"
                            >
                              ✨ Generar con IA
                            </button>
                          )}
                          <button
                            onClick={() => vaciar(d.id)}
                            disabled={!!vaciandoId}
                            className="text-xs font-semibold text-warmAmber-hover hover:underline mr-3 disabled:opacity-50"
                          >
                            Vaciar
                          </button>
                          <button
                            onClick={() => deleteDocument(d)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {editingId === d.id && editValues && (
                    <tr className="border-t border-deepViolet/10 bg-deepViolet/5">
                      <td colSpan={8} className="p-4">
                        <div className="grid sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Estado</label>
                            <select
                              value={editValues.estado}
                              onChange={(e) => setEditValues({ ...editValues, estado: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            >
                              {EDITABLE_STATES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Población objetivo</label>
                            <select
                              required
                              value={editValues.poblacion_objetivo_id}
                              onChange={(e) => setEditValues({ ...editValues, poblacion_objetivo_id: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            >
                              <option value="">Seleccionar...</option>
                              {projectPoblaciones.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre} ({p.edad_min}-{p.edad_max} años)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Creador Experto</label>
                            <select
                              value={editValues.creador_id}
                              onChange={(e) => setEditValues({ ...editValues, creador_id: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            >
                              <option value="">Sin asignar</option>
                              {usersByRole(projectUsers, 'Creador Experto').map((pu) => (
                                <option key={pu.profiles.id} value={pu.profiles.id}>
                                  {pu.profiles.nombre} {pu.profiles.apellido}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Revisor Pedagógico</label>
                            <select
                              value={editValues.revisor_pedagogico_id}
                              onChange={(e) => setEditValues({ ...editValues, revisor_pedagogico_id: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            >
                              <option value="">Sin asignar</option>
                              {usersByRole(projectUsers, 'Revisor Pedagógico').map((pu) => (
                                <option key={pu.profiles.id} value={pu.profiles.id}>
                                  {pu.profiles.nombre} {pu.profiles.apellido}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Revisor de Estilo</label>
                            <select
                              value={editValues.revisor_estilo_id}
                              onChange={(e) => setEditValues({ ...editValues, revisor_estilo_id: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            >
                              <option value="">Sin asignar</option>
                              {usersByRole(projectUsers, 'Revisor de Estilo').map((pu) => (
                                <option key={pu.profiles.id} value={pu.profiles.id}>
                                  {pu.profiles.nombre} {pu.profiles.apellido}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-3">
                          <button
                            onClick={() => saveEdit(d.id)}
                            className="px-4 py-1.5 rounded-lg bg-deepViolet text-white text-xs font-semibold"
                          >
                            Guardar cambios
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No hay documentos registrados en este proyecto.
                  </td>
                </tr>
              )}
              {documents.length > 0 && filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    Ningún documento coincide con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="paper-card rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Creador Experto</th>
                <th className="p-3">Revisor Pedagógico</th>
                <th className="p-3">Revisor de Estilo</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {trashedDocuments.map((d) => (
                <tr key={d.id} className="border-t border-deepViolet/10">
                  <td className="p-3 font-mono text-xs">{d.codigo}</td>
                  <td className="p-3 text-xs">{d.creador ? `${d.creador.nombre} ${d.creador.apellido}` : '—'}</td>
                  <td className="p-3 text-xs">
                    {d.revisor_pedagogico ? `${d.revisor_pedagogico.nombre} ${d.revisor_pedagogico.apellido}` : '—'}
                  </td>
                  <td className="p-3 text-xs">
                    {d.revisor_estilo ? `${d.revisor_estilo.nombre} ${d.revisor_estilo.apellido}` : '—'}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {readOnly ? null : restoringId === d.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={restoreEstado}
                          onChange={(e) => setRestoreEstado(e.target.value)}
                          className="border border-deepViolet/20 rounded-lg p-1.5 text-xs"
                        >
                          {EDITABLE_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => confirmRestore(d.id)}
                          className="text-xs font-semibold text-cognitiveTeal hover:underline"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setRestoringId(null)}
                          className="text-xs font-semibold text-slate-400 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRestore(d)}
                        className="text-xs font-semibold text-cognitiveTeal hover:underline"
                      >
                        ♻️ Restaurar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {trashedDocuments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    La papelera está vacía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProcessingModal open={!!vaciandoId} message="Vaciando documento... esto puede tardar unos segundos." />
      <ProcessingModal
        open={!!generandoId}
        message="El agente sintético está generando el contenido... esto puede tardar hasta un minuto."
      />
    </div>
  );
}
