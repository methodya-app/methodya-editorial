import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition ${
    isActive ? 'bg-cognitiveTeal text-white' : 'text-empatheticLinen/80 hover:bg-white/10'
  }`;

const dropdownLinkClass = ({ isActive }) =>
  `block px-4 py-2 text-sm whitespace-nowrap ${
    isActive ? 'bg-cognitiveTeal-light text-cognitiveTeal-deep font-semibold' : 'text-deepViolet hover:bg-deepViolet/5'
  }`;

// Pestaña de nivel superior con sub-pestañas (dropdown), para agrupar rutas
// relacionadas (ej. "Usuarios y Roles", "Configuración") sin perder el
// resaltado de "activo" cuando la ruta actual es una de sus hijas.
function NavDropdown({ label, active, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
          active ? 'bg-cognitiveTeal text-white' : 'text-empatheticLinen/80 hover:bg-white/10'
        }`}
      >
        {label}
        <span className="text-[10px]">▾</span>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="absolute left-0 mt-1 bg-white rounded-lg shadow-lg py-1 min-w-[180px] z-50"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { profile, isAdmin, isMultimediaCoordinator, multimediaProjectRoles, implementacionProjectRoles, logout } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isUsuariosRolesActive = ['/admin/usuarios', '/multimedia-roles'].some((p) =>
    location.pathname.startsWith(p)
  );
  const isConfiguracionActive = [
    '/admin/tipos-documento',
    '/admin/subformularios',
    '/admin/parrafos',
    '/admin/poblaciones-objetivo',
    '/admin/dotacion',
    '/admin/parametros',
  ].some((p) => location.pathname.startsWith(p));

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
              <NavDropdown label="Usuarios y Roles" active={isUsuariosRolesActive}>
                <NavLink to="/admin/usuarios" className={dropdownLinkClass}>Usuarios</NavLink>
                <NavLink to="/multimedia-roles" className={dropdownLinkClass}>Roles multimedia</NavLink>
              </NavDropdown>
              <NavDropdown label="Configuración" active={isConfiguracionActive}>
                <NavLink to="/admin/tipos-documento" className={dropdownLinkClass}>Tipos de documento</NavLink>
                <NavLink to="/admin/subformularios" className={dropdownLinkClass}>Subformularios</NavLink>
                <NavLink to="/admin/parrafos" className={dropdownLinkClass}>Párrafos predefinidos</NavLink>
                <NavLink to="/admin/poblaciones-objetivo" className={dropdownLinkClass}>Poblaciones Objetivo</NavLink>
                <NavLink to="/admin/dotacion" className={dropdownLinkClass}>Dotación</NavLink>
                <NavLink to="/admin/parametros" className={dropdownLinkClass}>Parámetros</NavLink>
              </NavDropdown>
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
              {implementacionProjectRoles.length > 0 && (
                <NavLink to="/implementacion" className={navLinkClass}>Implementación</NavLink>
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
