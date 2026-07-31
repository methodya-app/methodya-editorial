import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import StateBadge from '../../components/StateBadge.jsx';
import ProjectMultimediaTeamTab from '../admin/project/ProjectMultimediaTeamTab.jsx';
import ProjectMultimediaAssignmentTab from '../admin/project/ProjectMultimediaAssignmentTab.jsx';
import { showAlert } from '../../lib/alertModal.js';

function AssignmentRow({ a, showClaim, onClaim, claiming }) {
  return (
    <tr className="border-t border-deepViolet/10">
      <td className="p-3 font-mono text-xs">{a.document_codigo}</td>
      <td className="p-3">{a.subform_nombre}</td>
      <td className="p-3">
        <StateBadge estado={a.estado} />
      </td>
      <td className="p-3">
        {showClaim ? (
          <button
            onClick={() => onClaim(a.id)}
            disabled={!!claiming}
            className="text-xs font-semibold text-cognitiveTeal hover:underline disabled:opacity-50"
          >
            {claiming === a.id ? 'Tomando...' : 'Tomar tarea'}
          </button>
        ) : (
          <Link to={`/multimedia/tarea/${a.id}`} className="text-xs font-semibold text-cognitiveTeal hover:underline">
            Abrir
          </Link>
        )}
      </td>
    </tr>
  );
}

function AssignmentsTable({ items, emptyText, showClaim, onClaim, claiming }) {
  return (
    <div className="paper-card rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
          <tr>
            <th className="p-3">Documento</th>
            <th className="p-3">Subformulario</th>
            <th className="p-3">Estado</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <AssignmentRow key={a.id} a={a} showClaim={showClaim} onClaim={onClaim} claiming={claiming} />
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="p-6 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function MultimediaProjectWork() {
  const { projectId } = useParams();
  const { multimediaProjectRoles } = useAuth();
  const [tab, setTab] = useState('mias');
  const [assignments, setAssignments] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]);
  const [trashedAssignments, setTrashedAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);

  const projectRole = multimediaProjectRoles.find((pr) => pr.project_id === projectId);
  const isCoordinator = multimediaProjectRoles.some((pr) => pr.project_id === projectId && pr.es_coordinador);

  const load = async () => {
    setLoading(true);
    const data = await api.get(`/subform-assignments?project_id=${projectId}`);
    setAssignments(data.assignments);
    if (isCoordinator) {
      const [allData, trashedData] = await Promise.all([
        api.get(`/subform-assignments?project_id=${projectId}&all=1`),
        api.get(`/subform-assignments?project_id=${projectId}&trashed=1`),
      ]);
      setAllAssignments(allData.assignments);
      setTrashedAssignments(trashedData.assignments);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isCoordinator]);

  const claim = async (assignmentId) => {
    setClaimingId(assignmentId);
    try {
      await api.post(`/subform-assignments/${assignmentId}/claim`);
      await load();
    } catch (err) {
      showAlert('No se pudo tomar la tarea: ' + err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const mias = assignments.filter((a) => a.assigned_to_me);
  const disponibles = assignments.filter((a) => a.can_claim);

  const TABS = [
    { key: 'mias', label: `Mis tareas ${mias.length > 0 ? `(${mias.length})` : ''}` },
    { key: 'disponibles', label: `Disponibles ${disponibles.length > 0 ? `(${disponibles.length})` : ''}` },
    ...(isCoordinator
      ? [
          { key: 'todas', label: 'Todas' },
          { key: 'papelera', label: `🗑️ Papelera ${trashedAssignments.length > 0 ? `(${trashedAssignments.length})` : ''}` },
          { key: 'equipo', label: 'Equipo multimedia' },
          { key: 'reglas', label: 'Reglas de asignación' },
        ]
      : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <Link to="/multimedia" className="text-xs text-cognitiveTeal hover:underline">
          ← Mis proyectos multimedia
        </Link>
        <h2 className="font-display font-bold text-xl text-deepViolet">{projectRole?.projects?.nombre}</h2>
        <p className="text-sm text-slate-500">
          Tu rol: {isCoordinator ? 'Coordinador Multimedia' : projectRole?.multimedia_roles?.nombre}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === t.key ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : (
        <>
          {tab === 'mias' && (
            <AssignmentsTable items={mias} emptyText="No tienes tareas asignadas en este proyecto." />
          )}
          {tab === 'disponibles' && (
            <AssignmentsTable
              items={disponibles}
              emptyText="No hay tareas disponibles para tomar en tu rol."
              showClaim
              onClaim={claim}
              claiming={claimingId}
            />
          )}
          {tab === 'todas' && isCoordinator && (
            <AssignmentsTable items={allAssignments} emptyText="No hay subformularios liberados en este proyecto." />
          )}
          {tab === 'papelera' && isCoordinator && (
            <AssignmentsTable items={trashedAssignments} emptyText="La papelera está vacía." />
          )}
          {tab === 'equipo' && isCoordinator && <ProjectMultimediaTeamTab projectId={projectId} readOnly={false} />}
          {tab === 'reglas' && isCoordinator && (
            <ProjectMultimediaAssignmentTab projectId={projectId} readOnly={false} />
          )}
        </>
      )}
    </div>
  );
}
