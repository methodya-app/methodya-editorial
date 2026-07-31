import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { showAlert } from '../lib/alertModal.js';

// Catálogo global de roles multimedia (ej. "Diseñador videos multimedia"),
// cada uno asociado a qué plantillas de subformulario puede trabajar.
// Accesible al Administrador y a cualquier Coordinador Multimedia.
export default function MultimediaRoles() {
  const [roles, setRoles] = useState([]);
  const [subforms, setSubforms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [nombre, setNombre] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  const load = async () => {
    const [rolesData, subformsData] = await Promise.all([api.get('/multimedia-roles'), api.get('/subforms')]);
    setRoles(rolesData.multimedia_roles);
    setSubforms(subformsData.subforms);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    const result = await api.post('/multimedia-roles', { nombre, subform_ids: [] });
    setNombre('');
    await load();
    setSelected(result.multimedia_role);
  };

  const save = async () => {
    setSavedAt(null);
    try {
      await api.put(`/multimedia-roles/${selected.id}`, {
        nombre: selected.nombre,
        subform_ids: selected.subform_ids,
      });
      await load();
      setSavedAt(new Date());
    } catch (err) {
      showAlert('No se pudo guardar: ' + err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar este rol multimedia?')) return;
    await api.del(`/multimedia-roles/${id}`);
    if (selected?.id === id) setSelected(null);
    setSavedAt(null);
    load();
  };

  const toggleSubform = (subformId) => {
    const current = selected.subform_ids || [];
    const next = current.includes(subformId)
      ? current.filter((id) => id !== subformId)
      : [...current, subformId];
    setSelected({ ...selected, subform_ids: next });
  };

  return (
    <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-5">
      <div className="md:col-span-1 space-y-3">
        <h2 className="font-display font-bold text-xl text-deepViolet">Roles multimedia</h2>
        <form onSubmit={create} className="flex gap-2">
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del rol"
            className="flex-1 border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold">
            +
          </button>
        </form>
        <div className="paper-card rounded-xl divide-y divide-deepViolet/10">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelected(r);
                setSavedAt(null);
              }}
              className={`w-full text-left p-3 text-sm hover:bg-deepViolet/5 ${
                selected?.id === r.id ? 'bg-cognitiveTeal-light/40' : ''
              }`}
            >
              {r.nombre}
              <span className="block text-xs text-slate-400">
                {(r.subform_ids || []).length} tipo(s) de subformulario
              </span>
            </button>
          ))}
          {roles.length === 0 && <p className="p-3 text-sm text-slate-400">Sin roles aún.</p>}
        </div>
      </div>

      <div className="md:col-span-2">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <input
                value={selected.nombre}
                onChange={(e) => setSelected({ ...selected, nombre: e.target.value })}
                className="font-display font-bold text-lg text-deepViolet bg-transparent border-b border-transparent hover:border-deepViolet/20 focus:border-deepViolet focus:outline-none"
              />
              <div className="flex items-center gap-2">
                {savedAt && <span className="text-xs text-emerald-600">Guardado ✓</span>}
                <button onClick={() => remove(selected.id)} className="text-xs text-red-500 hover:underline">
                  Eliminar
                </button>
                <button onClick={save} className="px-3 py-1.5 rounded-lg bg-deepViolet text-white text-xs font-semibold">
                  Guardar
                </button>
              </div>
            </div>

            <div className="paper-card rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Tipos de subformulario que trabaja este rol
              </p>
              <div className="space-y-1.5">
                {subforms.map((sf) => (
                  <label key={sf._id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(selected.subform_ids || []).includes(sf._id)}
                      onChange={() => toggleSubform(sf._id)}
                    />
                    {sf.nombre}
                  </label>
                ))}
                {subforms.length === 0 && (
                  <p className="text-sm text-slate-400">No hay subformularios en la biblioteca aún.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Selecciona un rol para editarlo.</p>
        )}
      </div>
    </div>
  );
}
