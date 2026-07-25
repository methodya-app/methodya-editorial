import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-cognitiveTeal text-white' : 'text-empatheticLinen/80 hover:bg-white/10'
  }`;

export default function Layout() {
  const { profile, isAdmin, isMultimediaCoordinator, multimediaProjectRoles, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-deepViolet px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-empatheticLinen flex items-center justify-center">
            <span className="font-display font-extrabold text-deepViolet">M</span>
          </div>
          <div>
            <h1 className="font-display font-extrabold text-empatheticLinen tracking-wide text-lg leading-none">
              METHODYA
            </h1>
            <p className="text-[11px] text-warmAmber">El puente empático hacia el aprendizaje real</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-1 bg-deepViolet-bg/40 bg-black/20 p-1 rounded-xl">
          {isAdmin ? (
            <>
              <NavLink to="/admin/proyectos" className={navLinkClass}>Proyectos</NavLink>
              <NavLink to="/admin/analitica" className={navLinkClass}>Analítica</NavLink>
              <NavLink to="/admin/usuarios" className={navLinkClass}>Usuarios</NavLink>
              <NavLink to="/admin/tipos-documento" className={navLinkClass}>Tipos de documento</NavLink>
              <NavLink to="/admin/subformularios" className={navLinkClass}>Subformularios</NavLink>
              <NavLink to="/admin/parrafos" className={navLinkClass}>Párrafos</NavLink>
              <NavLink to="/admin/parametros" className={navLinkClass}>Parámetros</NavLink>
              <NavLink to="/multimedia-roles" className={navLinkClass}>Roles multimedia</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/mis-proyectos" className={navLinkClass}>Mis proyectos</NavLink>
              {multimediaProjectRoles.length > 0 && (
                <NavLink to="/multimedia" className={navLinkClass}>Multimedia</NavLink>
              )}
              {isMultimediaCoordinator && (
                <NavLink to="/multimedia-roles" className={navLinkClass}>Roles multimedia</NavLink>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-empatheticLinen/90">
            {profile ? `${profile.nombre} ${profile.apellido}` : ''}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-warmAmber text-deepViolet hover:bg-warmAmber-hover"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 bg-empatheticLinen p-6">
        <Outlet />
      </main>
    </div>
  );
}
