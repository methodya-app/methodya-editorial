import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import StateBadge from '../../components/StateBadge.jsx';
import { showAlert } from '../../lib/alertModal.js';

// Estados válidos para editar/restaurar un proyecto (todos menos
// "Eliminado", que se maneja aparte con el botón dedicado de la papelera).
const EDITABLE_STATES = ['Pendiente', 'Activo', 'Detenido', 'Finalizado'];

export default function ProjectsList() {
  const [tab, setTab] = useState('proyectos'); // 'proyectos' | 'papelera'
  const [projects, setProjects] = useState([]);
  const [trashedProjects, setTrashedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [restoreEstado, setRestoreEstado] = useState('Pendiente');

  const load = async () => {
    setLoading(true);
    const [data, trashData] = await Promise.all([api.get('/projects'), api.get('/projects?trashed=1')]);
    setProjects(data.projects);
    setTrashedProjects(trashData.projects);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createProject = async (e) => {
    e.preventDefault();
    await api.post('/projects', { nombre, fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null });
    setNombre('');
    setFechaInicio('');
    setFechaFin('');
    setShowForm(false);
    load();
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditValues({
      nombre: p.nombre,
      fecha_inicio: p.fecha_inicio || '',
      fecha_fin: p.fecha_fin || '',
      estado: p.estado,
    });
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/projects/${id}`, {
        nombre: editValues.nombre,
        fecha_inicio: editValues.fecha_inicio || null,
        fecha_fin: editValues.fecha_fin || null,
        estado: editValues.estado,
      });
      setEditingId(null);
      setEditValues(null);
      load();
    } catch (err) {
      showAlert('No se pudo guardar: ' + err.message);
    }
  };

  const deleteProject = async (p) => {
    if (!window.confirm(`¿Enviar el proyecto "${p.nombre}" a la papelera? Podrás restaurarlo luego.`)) {
      return;
    }
    try {
      await api.put(`/projects/${p.id}`, { estado: 'Eliminado' });
      load();
    } catch (err) {
      showAlert('No se pudo eliminar: ' + err.message);
    }
  };

  const startRestore = (p) => {
    setRestoringId(p.id);
    setRestoreEstado('Pendiente');
  };

  const confirmRestore = async (id) => {
    try {
      await api.put(`/projects/${id}`, { estado: restoreEstado });
      setRestoringId(null);
      load();
    } catch (err) {
      showAlert('No se pudo restaurar: ' + err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('proyectos')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'proyectos' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            Proyectos
          </button>
          <button
            onClick={() => setTab('papelera')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'papelera' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            🗑️ Papelera {trashedProjects.length > 0 && `(${trashedProjects.length})`}
          </button>
        </div>

        {tab === 'proyectos' && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            + Nuevo proyecto
          </button>
        )}
      </div>

      {showForm && tab === 'proyectos' && (
        <form onSubmit={createProject} className="paper-card rounded-xl p-5 grid grid-cols-3 gap-3 items-end">
          <div className="col-span-3 sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre del proyecto</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            />
          </div>
          <div className="col-span-3">
            <button type="submit" className="px-4 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold">
              Crear
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : tab === 'proyectos' ? (
        <div className="paper-card rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Vigencia</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-t border-deepViolet/10">
                    <td className="p-3 font-mono text-xs">{p.codigo}</td>
                    <td className="p-3">
                      <Link to={`/admin/proyectos/${p.id}`} className="font-semibold text-cognitiveTeal hover:underline">
                        {p.nombre}
                      </Link>
                    </td>
                    <td className="p-3"><StateBadge estado={p.estado} /></td>
                    <td className="p-3 text-xs text-slate-500">
                      {p.fecha_inicio || '—'} a {p.fecha_fin || '—'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        onClick={() => (editingId === p.id ? setEditingId(null) : startEdit(p))}
                        className="text-xs font-semibold text-deepViolet hover:underline mr-3"
                      >
                        {editingId === p.id ? 'Cancelar' : 'Editar'}
                      </button>
                      <button
                        onClick={() => deleteProject(p)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                  {editingId === p.id && editValues && (
                    <tr className="border-t border-deepViolet/10 bg-deepViolet/5">
                      <td colSpan={5} className="p-4">
                        <div className="grid sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                            <input
                              value={editValues.nombre}
                              onChange={(e) => setEditValues({ ...editValues, nombre: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha inicio</label>
                            <input
                              type="date"
                              value={editValues.fecha_inicio}
                              onChange={(e) => setEditValues({ ...editValues, fecha_inicio: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha fin</label>
                            <input
                              type="date"
                              value={editValues.fecha_fin}
                              onChange={(e) => setEditValues({ ...editValues, fecha_fin: e.target.value })}
                              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                            />
                          </div>
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
                        </div>
                        <div className="mt-3">
                          <button
                            onClick={() => saveEdit(p.id)}
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
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No hay proyectos aún.
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
                <th className="p-3">Nombre</th>
                <th className="p-3">Vigencia</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {trashedProjects.map((p) => (
                <tr key={p.id} className="border-t border-deepViolet/10">
                  <td className="p-3 font-mono text-xs">{p.codigo}</td>
                  <td className="p-3">{p.nombre}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {p.fecha_inicio || '—'} a {p.fecha_fin || '—'}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {restoringId === p.id ? (
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
                          onClick={() => confirmRestore(p.id)}
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
                        onClick={() => startRestore(p)}
                        className="text-xs font-semibold text-cognitiveTeal hover:underline"
                      >
                        ♻️ Restaurar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {trashedProjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">
                    La papelera está vacía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
