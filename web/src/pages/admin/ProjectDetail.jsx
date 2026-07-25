import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import StateBadge from '../../components/StateBadge.jsx';
import ProjectFormsTab from './project/ProjectFormsTab.jsx';
import ProjectDocumentsTab from './project/ProjectDocumentsTab.jsx';
import ProjectUsersTab from './project/ProjectUsersTab.jsx';
import ProjectValidationsTab from './project/ProjectValidationsTab.jsx';
import ProjectMassChangesTab from './project/ProjectMassChangesTab.jsx';
import ProjectTemplateTab from './project/ProjectTemplateTab.jsx';
import ProjectAssignmentTab from './project/ProjectAssignmentTab.jsx';
import ProjectMultimediaTeamTab from './project/ProjectMultimediaTeamTab.jsx';
import ProjectMultimediaAssignmentTab from './project/ProjectMultimediaAssignmentTab.jsx';

const TABS = [
  { key: 'formularios', label: 'Formularios' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'usuarios', label: 'Usuarios del proyecto' },
  { key: 'validaciones', label: 'Validaciones globales' },
  { key: 'cambios-masivos', label: 'Cambios masivos' },
  { key: 'plantilla', label: 'Plantilla y vaciamiento' },
  { key: 'asignacion', label: 'Reglas de asignación' },
  { key: 'equipo-multimedia', label: 'Equipo multimedia' },
  { key: 'asignacion-multimedia', label: 'Asignación multimedia' },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('formularios');

  const load = async () => {
    const data = await api.get(`/projects/${id}`);
    setProject(data.project);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!project) return <p className="text-slate-500">Cargando proyecto...</p>;

  const readOnly = ['Detenido', 'Finalizado', 'Eliminado'].includes(project.estado);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <Link to="/admin/proyectos" className="text-xs text-cognitiveTeal hover:underline">
          ← Volver a proyectos
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="font-display font-bold text-xl text-deepViolet">{project.nombre}</h2>
          <StateBadge estado={project.estado} />
          {readOnly && (
            <span className="text-xs text-red-500 font-semibold">Solo lectura (proyecto {project.estado})</span>
          )}
        </div>
        <p className="text-xs text-slate-500 font-mono">{project.codigo}</p>
      </div>

      <div className="flex flex-wrap gap-1 bg-deepViolet/5 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-deepViolet text-white' : 'text-deepViolet/70 hover:bg-deepViolet/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'formularios' && <ProjectFormsTab projectId={id} readOnly={readOnly} />}
      {tab === 'documentos' && <ProjectDocumentsTab projectId={id} readOnly={readOnly} />}
      {tab === 'usuarios' && <ProjectUsersTab projectId={id} readOnly={readOnly} />}
      {tab === 'validaciones' && <ProjectValidationsTab projectId={id} readOnly={readOnly} />}
      {tab === 'cambios-masivos' && <ProjectMassChangesTab projectId={id} readOnly={readOnly} />}
      {tab === 'plantilla' && <ProjectTemplateTab project={project} onSaved={load} readOnly={readOnly} />}
      {tab === 'asignacion' && <ProjectAssignmentTab project={project} onSaved={load} readOnly={readOnly} />}
      {tab === 'equipo-multimedia' && <ProjectMultimediaTeamTab projectId={id} readOnly={readOnly} />}
      {tab === 'asignacion-multimedia' && <ProjectMultimediaAssignmentTab projectId={id} readOnly={readOnly} />}
    </div>
  );
}
