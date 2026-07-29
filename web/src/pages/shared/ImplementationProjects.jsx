import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import StateBadge from '../../components/StateBadge.jsx';

const ROLE_LABEL = { implementador: 'Implementador', lider: 'Líder de implementación' };

// Proyectos en los que el usuario tiene un rol de implementación —
// equivalente a "Mis proyectos" pero para el área de Implementación.
export default function ImplementationProjects() {
  const { implementacionProjectRoles, profile } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="font-display font-bold text-xl text-deepViolet">Hola, {profile?.nombre}</h2>
        <p className="text-sm text-slate-500">
          Estos son los proyectos en los que tienes un rol del área de Implementación.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {implementacionProjectRoles.map((pr) => (
          <Link
            key={`${pr.project_id}-${pr.role}`}
            to={`/implementacion/${pr.project_id}`}
            className="paper-card rounded-xl p-4 hover:border-cognitiveTeal transition"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-deepViolet">{pr.projects?.nombre}</p>
              <StateBadge estado={pr.projects?.estado} />
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">{pr.projects?.codigo}</p>
            <p className="text-xs text-cognitiveTeal font-semibold mt-2">
              Tu rol: {ROLE_LABEL[pr.role] || pr.role}
            </p>
          </Link>
        ))}
        {implementacionProjectRoles.length === 0 && (
          <p className="text-slate-400 text-sm">Aún no tienes proyectos de implementación asignados.</p>
        )}
      </div>
    </div>
  );
}
