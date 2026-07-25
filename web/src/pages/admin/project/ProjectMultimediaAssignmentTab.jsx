import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';

const MODOS = [
  { value: 'manual', label: 'Manual (cualquiera del rol puede tomarlo)' },
  { value: 'carga', label: 'Por Carga (se nivela entre los del rol)' },
  { value: 'aleatoria', label: 'Aleatoria' },
];

// Igual que las reglas de asignación de Creador/Revisor, pero por cada rol
// multimedia del catálogo (dinámico, no una lista fija de 3).
export default function ProjectMultimediaAssignmentTab({ projectId, readOnly }) {
  const [roles, setRoles] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    const data = await api.get(`/projects/${projectId}/multimedia-assignment-config`);
    setRoles(data.roles);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const changeModo = async (roleId, modo) => {
    setRoles((cur) => cur.map((r) => (r.id === roleId ? { ...r, modo } : r)));
    setSavingId(roleId);
    try {
      await api.put(`/projects/${projectId}/multimedia-assignment-config`, { multimedia_role_id: roleId, modo });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="paper-card rounded-xl p-5 space-y-4 max-w-2xl">
      <div className="bg-warmAmber-light text-warmAmber-hover text-xs rounded-lg p-3">
        Cuando un subformulario se libera al equipo multimedia sin nadie asignado, este modo decide
        qué pasa: queda disponible para que cualquiera con ese rol lo tome, o el sistema lo asigna
        solo. El criterio de "carga" es el mismo configurado en Reglas de asignación del proyecto.
      </div>

      {roles.map((r) => (
        <div key={r.id}>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            {r.nombre} {savingId === r.id && <span className="text-cognitiveTeal">Guardando...</span>}
          </label>
          <select
            disabled={readOnly}
            value={r.modo}
            onChange={(e) => changeModo(r.id, e.target.value)}
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          >
            {MODOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {roles.length === 0 && <p className="text-sm text-slate-400">No hay roles multimedia en el catálogo aún.</p>}
    </div>
  );
}
