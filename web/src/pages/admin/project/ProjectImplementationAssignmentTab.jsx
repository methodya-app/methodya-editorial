import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';

const MODOS = [
  { value: 'manual', label: 'Manual (cualquiera del rol puede tomarlo)' },
  { value: 'carga', label: 'Por Carga (se nivela entre los Implementadores)' },
  { value: 'aleatoria', label: 'Aleatoria' },
];

// Igual que las reglas de asignación de Multimedia, pero acá es un solo
// modo por proyecto (no por rol): solo "Implementador" recibe trabajo
// auto-asignable, "Líder de implementación" no.
export default function ProjectImplementationAssignmentTab({ projectId, readOnly }) {
  const [modo, setModo] = useState('manual');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await api.get(`/projects/${projectId}/implementation-assignment-config`);
    setModo(data.modo);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const changeModo = async (value) => {
    setModo(value);
    setSaving(true);
    try {
      await api.put(`/projects/${projectId}/implementation-assignment-config`, { modo: value });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="paper-card rounded-xl p-5 space-y-4 max-w-2xl">
      <div className="bg-warmAmber-light text-warmAmber-hover text-xs rounded-lg p-3">
        Cuando un documento se libera a implementación sin nadie asignado, este modo decide qué pasa:
        queda disponible para que cualquier Implementador lo tome, o el sistema lo asigna solo. El
        criterio de "carga" es el mismo configurado en Reglas de asignación del proyecto.
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Implementador {saving && <span className="text-cognitiveTeal">Guardando...</span>}
        </label>
        <select
          disabled={readOnly}
          value={modo}
          onChange={(e) => changeModo(e.target.value)}
          className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
        >
          {MODOS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
