import { Fragment, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { showAlert } from '../../lib/alertModal.js';

export default function UsersGlobal() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('usuarios'); // 'usuarios' | 'papelera'
  const [users, setUsers] = useState([]);
  const [trashedUsers, setTrashedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    is_admin: false,
    is_synthetic: false,
    persona_prompt: '',
    persona_model: '',
  });

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState(null);

  const load = async () => {
    setLoading(true);
    const [data, trashData] = await Promise.all([api.get('/users'), api.get('/users?trashed=1')]);
    setUsers(data.users);
    setTrashedUsers(trashData.users);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      setForm({
        nombre: '',
        apellido: '',
        email: '',
        password: '',
        is_admin: false,
        is_synthetic: false,
        persona_prompt: '',
        persona_model: '',
      });
      setShowForm(false);
      load();
    } catch (err) {
      showAlert('No se pudo crear: ' + err.message);
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditValues({
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      is_admin: u.is_admin,
      password: '',
      is_synthetic: u.is_synthetic,
      persona_prompt: u.persona_prompt || '',
      persona_model: u.persona_model || '',
    });
  };

  const saveEdit = async (id) => {
    try {
      const payload = {
        nombre: editValues.nombre,
        apellido: editValues.apellido,
        email: editValues.email,
        is_admin: editValues.is_admin,
      };
      if (editValues.password) payload.password = editValues.password;
      if (editValues.is_synthetic) {
        payload.persona_prompt = editValues.persona_prompt;
        payload.persona_model = editValues.persona_model;
      }
      await api.put(`/users/${id}`, payload);
      setEditingId(null);
      setEditValues(null);
      load();
    } catch (err) {
      showAlert('No se pudo guardar: ' + err.message);
    }
  };

  const toggleSuspend = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { activo: !u.activo });
      load();
    } catch (err) {
      showAlert('No se pudo actualizar: ' + err.message);
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`¿Enviar al usuario "${u.nombre} ${u.apellido}" a la papelera? Podrás restaurarlo luego.`)) {
      return;
    }
    try {
      await api.del(`/users/${u.id}`);
      load();
    } catch (err) {
      showAlert('No se pudo eliminar: ' + err.message);
    }
  };

  const restoreUser = async (id) => {
    try {
      await api.put(`/users/${id}`, { eliminado: false, activo: true });
      load();
    } catch (err) {
      showAlert('No se pudo restaurar: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('usuarios')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'usuarios' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setTab('papelera')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
              tab === 'papelera' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
            }`}
          >
            🗑️ Papelera {trashedUsers.length > 0 && `(${trashedUsers.length})`}
          </button>
        </div>

        {tab === 'usuarios' && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold"
          >
            + Nuevo usuario
          </button>
        )}
      </div>

      {showForm && tab === 'usuarios' && (
        <form onSubmit={createUser} className="paper-card rounded-xl p-4 grid sm:grid-cols-2 gap-3">
          <input
            required
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          <input
            required
            placeholder="Apellido"
            value={form.apellido}
            onChange={(e) => setForm({ ...form, apellido: e.target.value })}
            className="border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          {!form.is_synthetic && (
            <>
              <input
                required
                type="email"
                placeholder="Correo"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="border border-deepViolet/20 rounded-lg p-2 text-sm"
              />
              <input
                required
                type="password"
                placeholder="Clave temporal"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="border border-deepViolet/20 rounded-lg p-2 text-sm"
              />
            </>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_admin}
              onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
            />
            Es Administrador
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_synthetic}
              onChange={(e) => setForm({ ...form, is_synthetic: e.target.checked })}
            />
            Es agente sintético (IA)
          </label>
          {form.is_synthetic && (
            <>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Persona / instrucciones del agente
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej: profesora de biología, tono directo, le gusta usar analogías con la vida cotidiana"
                  value={form.persona_prompt}
                  onChange={(e) => setForm({ ...form, persona_prompt: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Modelo (opcional)</label>
                <input
                  placeholder="Ej: gemini-2.5-flash (vacío = el modelo por defecto)"
                  value={form.persona_model}
                  onChange={(e) => setForm({ ...form, persona_model: e.target.value })}
                  className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-deepViolet text-white text-sm font-semibold">
              Crear usuario
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : tab === 'usuarios' ? (
        <div className="paper-card rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Correo</th>
                <th className="p-3">Admin</th>
                <th className="p-3">Estado</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === profile?.id;
                return (
                  <Fragment key={u.id}>
                    <tr className="border-t border-deepViolet/10">
                      <td className="p-3">
                        {u.nombre} {u.apellido}
                        {u.is_synthetic && (
                          <span className="ml-2 text-[10px] font-semibold text-cognitiveTeal bg-cognitiveTeal-light px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            ✨ Agente IA
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">{u.email}</td>
                      <td className="p-3">{u.is_admin ? 'Sí' : 'No'}</td>
                      <td className="p-3">
                        <span className={u.activo ? 'text-emerald-600' : 'text-red-500'}>
                          {u.activo ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button
                          onClick={() => (editingId === u.id ? setEditingId(null) : startEdit(u))}
                          className="text-xs font-semibold text-deepViolet hover:underline mr-3"
                        >
                          {editingId === u.id ? 'Cancelar' : 'Editar'}
                        </button>
                        <button
                          onClick={() => toggleSuspend(u)}
                          disabled={isSelf}
                          title={isSelf ? 'No puedes suspenderte a ti mismo' : undefined}
                          className="text-xs font-semibold text-cognitiveTeal hover:underline mr-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                        >
                          {u.activo ? 'Suspender' : 'Reactivar'}
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={isSelf}
                          title={isSelf ? 'No puedes eliminarte a ti mismo' : undefined}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                    {editingId === u.id && editValues && (
                      <tr className="border-t border-deepViolet/10 bg-deepViolet/5">
                        <td colSpan={5} className="p-4">
                          <div className="grid sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                              <input
                                value={editValues.nombre}
                                onChange={(e) => setEditValues({ ...editValues, nombre: e.target.value })}
                                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Apellido</label>
                              <input
                                value={editValues.apellido}
                                onChange={(e) => setEditValues({ ...editValues, apellido: e.target.value })}
                                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Correo</label>
                              <input
                                type="email"
                                value={editValues.email}
                                onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">
                                Nueva contraseña (opcional)
                              </label>
                              <input
                                type="password"
                                placeholder="Dejar en blanco para no cambiar"
                                value={editValues.password}
                                onChange={(e) => setEditValues({ ...editValues, password: e.target.value })}
                                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                              />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editValues.is_admin}
                                onChange={(e) => setEditValues({ ...editValues, is_admin: e.target.checked })}
                              />
                              Es Administrador
                            </label>
                            {editValues.is_synthetic && (
                              <>
                                <div className="sm:col-span-3">
                                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                                    Persona / instrucciones del agente
                                  </label>
                                  <textarea
                                    required
                                    rows={3}
                                    placeholder="Ej: profesora de biología, tono directo, le gusta usar analogías con la vida cotidiana"
                                    value={editValues.persona_prompt}
                                    onChange={(e) => setEditValues({ ...editValues, persona_prompt: e.target.value })}
                                    className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                                    Modelo (opcional)
                                  </label>
                                  <input
                                    placeholder="Ej: gemini-2.5-flash (vacío = el modelo por defecto)"
                                    value={editValues.persona_model}
                                    onChange={(e) => setEditValues({ ...editValues, persona_model: e.target.value })}
                                    className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                          <div className="mt-3">
                            <button
                              onClick={() => saveEdit(u.id)}
                              className="px-4 py-1.5 rounded-lg bg-deepViolet text-white text-xs font-semibold"
                            >
                              Guardar cambios
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="paper-card rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Correo</th>
                <th className="p-3">Admin</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {trashedUsers.map((u) => (
                <tr key={u.id} className="border-t border-deepViolet/10">
                  <td className="p-3">
                    {u.nombre} {u.apellido}
                  </td>
                  <td className="p-3 text-slate-500">{u.email}</td>
                  <td className="p-3">{u.is_admin ? 'Sí' : 'No'}</td>
                  <td className="p-3">
                    <button
                      onClick={() => restoreUser(u.id)}
                      className="text-xs font-semibold text-cognitiveTeal hover:underline"
                    >
                      ♻️ Restaurar
                    </button>
                  </td>
                </tr>
              ))}
              {trashedUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">
                    La papelera está vacía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
