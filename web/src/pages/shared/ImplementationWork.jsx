import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import StateBadge from '../../components/StateBadge.jsx';
import ProjectImplementationTeamTab from '../admin/project/ProjectImplementationTeamTab.jsx';
import ProjectImplementationAssignmentTab from '../admin/project/ProjectImplementationAssignmentTab.jsx';

const ROLE_LABEL = { implementador: 'Implementador', lider: 'Líder de implementación' };

function ImplementationRow({ item, showClaim, onClaim, claiming }) {
  return (
    <tr className="border-t border-deepViolet/10">
      <td className="p-3 font-mono text-xs">{item.document_codigo}</td>
      <td className="p-3">
        <StateBadge estado={item.estado} />
      </td>
      <td className="p-3">
        {showClaim ? (
          <button
            onClick={() => onClaim(item.id)}
            disabled={!!claiming}
            className="text-xs font-semibold text-cognitiveTeal hover:underline disabled:opacity-50"
          >
            {claiming === item.id ? 'Tomando...' : 'Tomar tarea'}
          </button>
        ) : (
          <Link
            to={`/implementacion/tarea/${item.id}`}
            className="text-xs font-semibold text-cognitiveTeal hover:underline"
          >
            Abrir
          </Link>
        )}
      </td>
    </tr>
  );
}

function ImplementationsTable({ items, emptyText, showClaim, onClaim, claiming }) {
  return (
    <div className="paper-card rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
          <tr>
            <th className="p-3">Documento</th>
            <th className="p-3">Estado</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ImplementationRow key={item.id} item={item} showClaim={showClaim} onClaim={onClaim} claiming={claiming} />
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className="p-6 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ImplementationWork() {
  const { projectId } = useParams();
  const { implementacionProjectRoles } = useAuth();
  const [tab, setTab] = useState('mias');
  const [implementations, setImplementations] = useState([]);
  const [allImplementations, setAllImplementations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);

  const projectRole = implementacionProjectRoles.find((pr) => pr.project_id === projectId);
  const isLider = implementacionProjectRoles.some((pr) => pr.project_id === projectId && pr.role === 'lider');

  const load = async () => {
    setLoading(true);
    const data = await api.get(`/implementations?project_id=${projectId}`);
    setImplementations(data.implementations);
    if (isLider) {
      const allData = await api.get(`/implementations?project_id=${projectId}&all=1`);
      setAllImplementations(allData.implementations);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isLider]);

  const claim = async (implementationId) => {
    setClaimingId(implementationId);
    try {
      await api.post(`/implementations/${implementationId}/claim`);
      await load();
    } catch (err) {
      alert('No se pudo tomar la tarea: ' + err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const mias = implementations.filter((a) => a.assigned_to_me);
  const disponibles = implementations.filter((a) => a.can_claim);

  const TABS = [
    { key: 'mias', label: `Mis tareas ${mias.length > 0 ? `(${mias.length})` : ''}` },
    { key: 'disponibles', label: `Disponibles ${disponibles.length > 0 ? `(${disponibles.length})` : ''}` },
    ...(isLider
      ? [
          { key: 'todas', label: 'Todas' },
          { key: 'equipo', label: 'Equipo' },
          { key: 'reglas', label: 'Reglas de asignación' },
        ]
      : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <Link to="/implementacion" className="text-xs text-cognitiveTeal hover:underline">
          ← Mis proyectos de implementación
        </Link>
        <h2 className="font-display font-bold text-xl text-deepViolet">{projectRole?.projects?.nombre}</h2>
        <p className="text-sm text-slate-500">Tu rol: {ROLE_LABEL[projectRole?.role] || projectRole?.role}</p>
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
            <ImplementationsTable items={mias} emptyText="No tienes tareas asignadas en este proyecto." />
          )}
          {tab === 'disponibles' && (
            <ImplementationsTable
              items={disponibles}
              emptyText="No hay tareas disponibles para tomar."
              showClaim
              onClaim={claim}
              claiming={claimingId}
            />
          )}
          {tab === 'todas' && isLider && (
            <ImplementationsTable items={allImplementations} emptyText="No hay documentos liberados en este proyecto." />
          )}
          {tab === 'equipo' && isLider && <ProjectImplementationTeamTab projectId={projectId} readOnly={false} />}
          {tab === 'reglas' && isLider && (
            <ProjectImplementationAssignmentTab projectId={projectId} readOnly={false} />
          )}
        </>
      )}
    </div>
  );
}
