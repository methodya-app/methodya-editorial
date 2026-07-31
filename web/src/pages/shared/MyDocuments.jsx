import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import StateBadge from '../../components/StateBadge.jsx';
import { showAlert } from '../../lib/alertModal.js';

// Lista de documentos del usuario dentro de un proyecto, según su(s) rol(es)
// (Creador Experto / Revisor Pedagógico / Revisor de Estilo): los que ya
// tiene asignados, y los que están disponibles para tomar en su rol.
export default function MyDocuments() {
  const { projectId } = useParams();
  const { projectRoles } = useAuth();
  const [tab, setTab] = useState('mios'); // 'mios' | 'disponibles'
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);

  const myRolesHere = projectRoles.filter((pr) => pr.project_id === projectId);
  const myRole = myRolesHere[0];

  const load = () => {
    setLoading(true);
    return api.get(`/projects/${projectId}/documents`).then((d) => {
      setDocuments(d.documents);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const asignados = documents.filter((d) => d.assigned_to_me);
  const disponibles = documents.filter((d) => d.can_claim);

  const claim = async (d) => {
    setClaimingId(d.id);
    try {
      await api.post(`/documents/${d.id}/claim`);
      await load();
      setTab('mios');
    } catch (err) {
      showAlert('No se pudo tomar el documento: ' + err.message);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <Link to="/mis-proyectos" className="text-xs text-cognitiveTeal hover:underline">
          ← Mis proyectos
        </Link>
        <h2 className="font-display font-bold text-xl text-deepViolet">{myRole?.projects?.nombre}</h2>
        <p className="text-sm text-slate-500">
          Tu rol: {myRolesHere.map((pr) => pr.role).join(', ') || '—'}
        </p>
      </div>

      <div className="flex gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('mios')}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            tab === 'mios' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
          }`}
        >
          Mis documentos {asignados.length > 0 && `(${asignados.length})`}
        </button>
        <button
          onClick={() => setTab('disponibles')}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            tab === 'disponibles' ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
          }`}
        >
          Disponibles para tomar {disponibles.length > 0 && `(${disponibles.length})`}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : (
        <div className="paper-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Estado</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {tab === 'mios' &&
                asignados.map((d) => (
                  <tr key={d.id} className="border-t border-deepViolet/10">
                    <td className="p-3 font-mono text-xs">{d.codigo}</td>
                    <td className="p-3">
                      <StateBadge estado={d.estado} />
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/documentos/${d.id}`}
                        className="text-xs font-semibold text-cognitiveTeal hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              {tab === 'mios' && asignados.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-400">
                    No tienes documentos asignados en este proyecto.
                  </td>
                </tr>
              )}

              {tab === 'disponibles' &&
                disponibles.map((d) => (
                  <tr key={d.id} className="border-t border-deepViolet/10">
                    <td className="p-3 font-mono text-xs">{d.codigo}</td>
                    <td className="p-3">
                      <StateBadge estado={d.estado} />
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => claim(d)}
                        disabled={!!claimingId}
                        className="text-xs font-semibold text-cognitiveTeal hover:underline disabled:opacity-50"
                      >
                        {claimingId === d.id ? 'Tomando...' : 'Tomar documento'}
                      </button>
                    </td>
                  </tr>
                ))}
              {tab === 'disponibles' && disponibles.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-400">
                    No hay documentos disponibles para tomar en tu rol.
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
