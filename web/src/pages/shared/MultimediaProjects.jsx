import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import StateBadge from '../../components/StateBadge.jsx';

// Proyectos en los que el usuario tiene un rol multimedia (diseñador o
// Coordinador Multimedia) — equivalente a "Mis proyectos" pero para el
// equipo multimedia.
export default function MultimediaProjects() {
  const { multimediaProjectRoles, profile } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="font-display font-bold text-xl text-deepViolet">Hola, {profile?.nombre}</h2>
        <p className="text-sm text-slate-500">
          Estos son los proyectos en los que tienes un rol del equipo multimedia.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {multimediaProjectRoles.map((pr) => (
          <Link
            key={`${pr.project_id}-${pr.multimedia_role_id || 'coordinador'}`}
            to={`/multimedia/${pr.project_id}`}
            className="paper-card rounded-xl p-4 hover:border-cognitiveTeal transition"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-deepViolet">{pr.projects?.nombre}</p>
              <StateBadge estado={pr.projects?.estado} />
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">{pr.projects?.codigo}</p>
            <p className="text-xs text-cognitiveTeal font-semibold mt-2">
              Tu rol: {pr.es_coordinador ? 'Coordinador Multimedia' : pr.multimedia_roles?.nombre}
            </p>
          </Link>
        ))}
        {multimediaProjectRoles.length === 0 && (
          <p className="text-slate-400 text-sm">Aún no tienes proyectos multimedia asignados.</p>
        )}
      </div>
    </div>
  );
}
