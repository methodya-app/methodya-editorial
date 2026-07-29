import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';

const ROLES = [
  { value: 'implementador', label: 'Implementador' },
  { value: 'lider', label: 'Líder de implementación' },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

// Equipo de Implementación de un proyecto: quién es Implementador y quién
// es Líder de implementación — a diferencia del equipo multimedia, son 2
// roles fijos (sin catálogo que consultar), así que este selector no
// necesita ningún fetch adicional de roles.
export default function ProjectImplementationTeamTab({ projectId, readOnly }) {
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [roleValue, setRoleValue] = useState(ROLES[0].value);
  const [editingId, setEditingId] = useState(null);
  const [editRoleValue, setEditRoleValue] = useState('');

  const load = async () => {
    const [team, users] = await Promise.all([
      api.get(`/projects/${projectId}/implementation-team`),
      api.get('/users'),
    ]);
    setMembers(team.implementacion_project_users);
    setAllUsers(users.users);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const addMember = async (e) => {
    e.preventDefault();
    if (!userId) return;
    await api.post(`/projects/${projectId}/implementation-team`, { user_id: userId, role: roleValue });
    setUserId('');
    load();
  };

  const removeMember = async (id) => {
    await api.del(`/projects/${projectId}/implementation-team`, { implementacion_project_user_id: id });
    load();
  };

  const startEdit = (member) => {
    setEditingId(member.id);
    setEditRoleValue(member.role);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    await api.put(`/projects/${projectId}/implementation-team`, {
      implementacion_project_user_id: id,
      role: editRoleValue,
    });
    setEditingId(null);
    load();
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <form onSubmit={addMember} className="paper-card rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Usuario</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Rol</label>
            <select
              value={roleValue}
              onChange={(e) => setRoleValue(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold">
            Asignar
          </button>
        </form>
      )}

      <div className="paper-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
            <tr>
              <th className="p-3">Usuario</th>
              <th className="p-3">Correo</th>
              <th className="p-3">Rol</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-deepViolet/10">
                <td className="p-3">
                  {m.profiles?.nombre} {m.profiles?.apellido}
                </td>
                <td className="p-3 text-slate-500">{m.profiles?.email}</td>
                <td className="p-3">
                  {editingId === m.id ? (
                    <select
                      value={editRoleValue}
                      onChange={(e) => setEditRoleValue(e.target.value)}
                      className="border border-deepViolet/20 rounded-lg p-1.5 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABEL[m.role] || m.role
                  )}
                </td>
                <td className="p-3 space-x-2">
                  {!readOnly &&
                    (editingId === m.id ? (
                      <>
                        <button
                          onClick={() => saveEdit(m.id)}
                          className="text-xs text-cognitiveTeal font-semibold hover:underline"
                        >
                          Guardar
                        </button>
                        <button onClick={cancelEdit} className="text-xs text-slate-500 hover:underline">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(m)} className="text-xs text-cognitiveTeal hover:underline">
                          Editar
                        </button>
                        <button onClick={() => removeMember(m.id)} className="text-xs text-red-500 hover:underline">
                          Quitar
                        </button>
                      </>
                    ))}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  No hay equipo de implementación asignado a este proyecto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
