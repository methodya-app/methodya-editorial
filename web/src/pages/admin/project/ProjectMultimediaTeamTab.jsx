import { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';

const COORDINADOR = '__coordinador__';

// Equipo multimedia de un proyecto: quién tiene cada rol multimedia (del
// catálogo global) y quién es el Coordinador Multimedia de ese proyecto.
export default function ProjectMultimediaTeamTab({ projectId, readOnly }) {
  const [members, setMembers] = useState([]);
  const [multimediaRoles, setMultimediaRoles] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [roleValue, setRoleValue] = useState('');

  const load = async () => {
    const [team, roles, users] = await Promise.all([
      api.get(`/projects/${projectId}/multimedia-team`),
      api.get('/multimedia-roles'),
      api.get('/users'),
    ]);
    setMembers(team.multimedia_project_users);
    setMultimediaRoles(roles.multimedia_roles);
    setAllUsers(users.users);
    setRoleValue((cur) => cur || roles.multimedia_roles[0]?.id || COORDINADOR);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const addMember = async (e) => {
    e.preventDefault();
    if (!userId) return;
    if (roleValue === COORDINADOR) {
      await api.post(`/projects/${projectId}/multimedia-team`, { user_id: userId, es_coordinador: true });
    } else {
      await api.post(`/projects/${projectId}/multimedia-team`, { user_id: userId, multimedia_role_id: roleValue });
    }
    setUserId('');
    load();
  };

  const removeMember = async (id) => {
    await api.del(`/projects/${projectId}/multimedia-team`, { multimedia_project_user_id: id });
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
            <label className="block text-xs font-semibold text-slate-500 mb-1">Rol multimedia</label>
            <select
              value={roleValue}
              onChange={(e) => setRoleValue(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
            >
              {multimediaRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
              <option value={COORDINADOR}>Coordinador Multimedia</option>
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
                <td className="p-3">{m.es_coordinador ? 'Coordinador Multimedia' : m.multimedia_roles?.nombre}</td>
                <td className="p-3">
                  {!readOnly && (
                    <button onClick={() => removeMember(m.id)} className="text-xs text-red-500 hover:underline">
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  No hay equipo multimedia asignado a este proyecto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
