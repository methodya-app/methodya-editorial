import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import StateBadge from '../../../components/StateBadge.jsx';
import { showAlert } from '../../../lib/alertModal.js';

// Supervisión de los subformularios liberados al equipo multimedia de este
// proyecto: qué tarea es, de qué documento, quién la tiene y en qué estado.
export default function ProjectSubformsTab({ projectId }) {
  const [tab, setTab] = useState('activos'); // 'activos' | 'papelera'
  const [assignments, setAssignments] = useState([]);
  const [trashed, setTrashed] = useState([]);
  const [multimediaRoles, setMultimediaRoles] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [activeData, trashedData, rolesData, teamData] = await Promise.all([
      api.get(`/subform-assignments?project_id=${projectId}&all=1`),
      api.get(`/subform-assignments?project_id=${projectId}&trashed=1`),
      api.get('/multimedia-roles'),
      api.get(`/projects/${projectId}/multimedia-team`),
    ]);
    setAssignments(activeData.assignments);
    setTrashed(trashedData.assignments);
    setMultimediaRoles(rolesData.multimedia_roles);
    setTeamMembers(teamData.multimedia_project_users);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const roleName = (id) => multimediaRoles.find((r) => r.id === id)?.nombre || '—';
  const assignedName = (userId) => {
    const m = teamMembers.find((tm) => tm.profiles?.id === userId);
    return m ? `${m.profiles.nombre} ${m.profiles.apellido}` : 'Sin asignar';
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setEditValues({
      titulo: a.titulo || '',
      multimedia_role_id: a.multimedia_role_id || '',
      assigned_user_id: a.assigned_user_id || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues(null);
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      await api.put(`/subform-assignments/${id}`, {
        titulo: editValues.titulo,
        multimedia_role_id: editValues.multimedia_role_id || null,
        assigned_user_id: editValues.assigned_user_id || null,
      });
      cancelEdit();
      await load();
    } catch (err) {
      showAlert('No se pudo guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const trash = async (a) => {
    if (!window.confirm(`¿Enviar "${a.subform_codigo || a.subform_nombre}" a la papelera?`)) return;
    try {
      await api.post(`/subform-assignments/${a.id}/transition`, { action: 'trash' });
      load();
    } catch (err) {
      showAlert('No se pudo eliminar: ' + err.message);
    }
  };

  const restore = async (a) => {
    try {
      await api.post(`/subform-assignments/${a.id}/transition`, { action: 'restore' });
      load();
    } catch (err) {
      showAlert('No se pudo restaurar: ' + err.message);
    }
  };

  const rows = tab === 'activos' ? assignments : trashed;
  const roleOptionsFor = (roleId) => teamMembers.filter((tm) => tm.multimedia_role_id === roleId);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('activos')}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            tab === 'activos' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
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
          🗑️ Papelera {trashed.length > 0 && `(${trashed.length})`}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : (
        <div className="paper-card rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
              <tr>
                <th className="p-3">Código subformulario</th>
                <th className="p-3">Documento</th>
                <th className="p-3">Tipo de subformulario</th>
                <th className="p-3">Título</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Equipo multimedia</th>
                <th className="p-3">Asignado a</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) =>
                editingId === a.id ? (
                  <tr key={a.id} className="border-t border-deepViolet/10 bg-cognitiveTeal-light/10">
                    <td className="p-3 font-mono text-xs">{a.subform_codigo || '—'}</td>
                    <td className="p-3 font-mono text-xs">{a.document_codigo}</td>
                    <td className="p-3 text-xs">{a.subform_nombre}</td>
                    <td className="p-3">
                      <input
                        value={editValues.titulo}
                        onChange={(e) => setEditValues({ ...editValues, titulo: e.target.value })}
                        placeholder="Título"
                        className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
                      />
                    </td>
                    <td className="p-3">
                      <StateBadge estado={a.estado} />
                    </td>
                    <td className="p-3">
                      <select
                        value={editValues.multimedia_role_id}
                        onChange={(e) =>
                          setEditValues({ ...editValues, multimedia_role_id: e.target.value, assigned_user_id: '' })
                        }
                        className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
                      >
                        <option value="">Sin rol</option>
                        {multimediaRoles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <select
                        value={editValues.assigned_user_id}
                        onChange={(e) => setEditValues({ ...editValues, assigned_user_id: e.target.value })}
                        className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
                      >
                        <option value="">Sin asignar</option>
                        {roleOptionsFor(editValues.multimedia_role_id).map((tm) => (
                          <option key={tm.profiles.id} value={tm.profiles.id}>
                            {tm.profiles.nombre} {tm.profiles.apellido}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        onClick={() => saveEdit(a.id)}
                        disabled={saving}
                        className="text-xs font-semibold text-cognitiveTeal hover:underline mr-3 disabled:opacity-50"
                      >
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button onClick={cancelEdit} className="text-xs font-semibold text-slate-500 hover:underline">
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id} className="border-t border-deepViolet/10">
                    <td className="p-3 font-mono text-xs">
                      <Link to={`/multimedia/tarea/${a.id}`} className="text-cognitiveTeal hover:underline">
                        {a.subform_codigo || '(abrir)'}
                      </Link>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      <Link to={`/documentos/${a.document_id}`} className="text-cognitiveTeal hover:underline">
                        {a.document_codigo}
                      </Link>
                    </td>
                    <td className="p-3 text-xs">{a.subform_nombre}</td>
                    <td className="p-3 text-xs">{a.titulo || '—'}</td>
                    <td className="p-3">
                      <StateBadge estado={a.estado} />
                    </td>
                    <td className="p-3 text-xs">{roleName(a.multimedia_role_id)}</td>
                    <td className="p-3 text-xs">
                      {a.assigned_user_id ? assignedName(a.assigned_user_id) : 'Sin asignar'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {tab === 'activos' ? (
                        <>
                          <button
                            onClick={() => startEdit(a)}
                            className="text-xs font-semibold text-deepViolet hover:underline mr-3"
                          >
                            Editar
                          </button>
                          <button onClick={() => trash(a)} className="text-xs font-semibold text-red-500 hover:underline">
                            Eliminar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => restore(a)}
                          className="text-xs font-semibold text-cognitiveTeal hover:underline"
                        >
                          ♻️ Restaurar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    {tab === 'activos'
                      ? 'No hay subformularios liberados al equipo multimedia en este proyecto.'
                      : 'La papelera está vacía.'}
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
