import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import StateBadge from '../../../components/StateBadge.jsx';

// Supervisión de los subformularios liberados al equipo multimedia de este
// proyecto: qué tarea es, de qué documento, quién la tiene y en qué estado.
export default function ProjectSubformsTab({ projectId }) {
  const [tab, setTab] = useState('activos'); // 'activos' | 'papelera'
  const [assignments, setAssignments] = useState([]);
  const [trashed, setTrashed] = useState([]);
  const [multimediaRoles, setMultimediaRoles] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const rows = tab === 'activos' ? assignments : trashed;

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
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-deepViolet/10">
                  <td className="p-3 font-mono text-xs">{a.subform_codigo || '—'}</td>
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
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
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
