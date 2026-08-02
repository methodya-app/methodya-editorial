import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';
import StateBadge from '../../components/StateBadge.jsx';
import BarChart from '../../components/analytics/BarChart.jsx';
import DocumentPreviewModal from '../../components/DocumentPreviewModal.jsx';
import SubformPreviewModal from '../../components/SubformPreviewModal.jsx';

const fmtDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const fullName = (p) => (p ? `${p.nombre} ${p.apellido}` : '');
const fmtTokens = (n) => n.toLocaleString('es-CO');

const TABS = [
  { key: 'documentos', label: 'Documentos' },
  { key: 'multimedia', label: 'Multimedia' },
  { key: 'implementacion', label: 'Implementación' },
  { key: 'consumo-ia', label: 'Consumo IA' },
];

// Opciones únicas para un filtro (id + etiqueta), extraídas de los propios
// documentos — evita depender de llamadas aparte a /projects/:id/users o
// /poblaciones-objetivo solo para poblar un <select>.
function uniqueOptions(documents, idKey, getLabel) {
  const byId = new Map();
  for (const d of documents) {
    const id = d[idKey];
    if (!id || byId.has(id)) continue;
    const label = getLabel(d);
    if (label) byId.set(id, label);
  }
  return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

// Lista plana de los documentos del proyecto seleccionado, con filtros y
// descarga en CSV — se repite al final de las 4 pestañas (mismo contenido,
// misma posición fija) para tener siempre a mano el detalle documento por
// documento sin importar qué panel de gráficas se esté viendo.
function DocumentsListSection({ documents, onExportCsv }) {
  const [previewDocId, setPreviewDocId] = useState(null);
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterPoblacion, setFilterPoblacion] = useState('');
  const [filterCreador, setFilterCreador] = useState('');
  const [filterRevisorPedagogico, setFilterRevisorPedagogico] = useState('');
  const [filterRevisorEstilo, setFilterRevisorEstilo] = useState('');

  const estados = [...new Set(documents.map((d) => d.estado))].sort();
  const poblaciones = uniqueOptions(documents, 'poblacion_objetivo_id', (d) => d.poblaciones_objetivo?.nombre);
  const creadores = uniqueOptions(documents, 'creador_id', (d) => fullName(d.creador));
  const revisoresPedagogicos = uniqueOptions(documents, 'revisor_pedagogico_id', (d) => fullName(d.revisor_pedagogico));
  const revisoresEstilo = uniqueOptions(documents, 'revisor_estilo_id', (d) => fullName(d.revisor_estilo));

  const hasActiveFilters =
    filterCodigo || filterEstado || filterPoblacion || filterCreador || filterRevisorPedagogico || filterRevisorEstilo;
  const clearFilters = () => {
    setFilterCodigo('');
    setFilterEstado('');
    setFilterPoblacion('');
    setFilterCreador('');
    setFilterRevisorPedagogico('');
    setFilterRevisorEstilo('');
  };

  const filteredDocuments = documents.filter((d) => {
    if (filterCodigo && !d.codigo.toLowerCase().includes(filterCodigo.toLowerCase())) return false;
    if (filterEstado && d.estado !== filterEstado) return false;
    if (filterPoblacion && d.poblacion_objetivo_id !== filterPoblacion) return false;
    if (filterCreador && d.creador_id !== filterCreador) return false;
    if (filterRevisorPedagogico && d.revisor_pedagogico_id !== filterRevisorPedagogico) return false;
    if (filterRevisorEstilo && d.revisor_estilo_id !== filterRevisorEstilo) return false;
    return true;
  });

  return (
    <div className="paper-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display font-bold text-deepViolet">
          Documentos del proyecto ({filteredDocuments.length}
          {filteredDocuments.length !== documents.length ? ` de ${documents.length}` : ''})
        </h3>
        <button
          onClick={() => onExportCsv(filteredDocuments)}
          disabled={filteredDocuments.length === 0}
          className="px-3 py-1.5 rounded-lg bg-cognitiveTeal text-white text-xs font-semibold disabled:opacity-50"
        >
          ⬇ Descargar CSV
        </button>
      </div>

      {documents.length > 0 && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Código</label>
            <input
              value={filterCodigo}
              onChange={(e) => setFilterCodigo(e.target.value)}
              placeholder="Buscar..."
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {estados.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Población objetivo</label>
            <select
              value={filterPoblacion}
              onChange={(e) => setFilterPoblacion(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todas</option>
              {poblaciones.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Creador Experto</label>
            <select
              value={filterCreador}
              onChange={(e) => setFilterCreador(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {creadores.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Revisor Pedagógico</label>
            <select
              value={filterRevisorPedagogico}
              onChange={(e) => setFilterRevisorPedagogico(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {revisoresPedagogicos.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Revisor de Estilo</label>
              <select
                value={filterRevisorEstilo}
                onChange={(e) => setFilterRevisorEstilo(e.target.value)}
                className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
              >
                <option value="">Todos</option>
                {revisoresEstilo.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-red-500 hover:underline whitespace-nowrap pb-1.5"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Población objetivo</th>
              <th className="p-2">Creador Experto</th>
              <th className="p-2">Revisor Pedagógico</th>
              <th className="p-2">Revisor de Estilo</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.map((d) => (
              <tr key={d.id} className="border-t border-deepViolet/10">
                <td className="p-2 font-mono text-xs">
                  <button onClick={() => setPreviewDocId(d.id)} className="text-cognitiveTeal hover:underline">
                    {d.codigo}
                  </button>
                </td>
                <td className="p-2">
                  <StateBadge estado={d.estado} />
                </td>
                <td className="p-2 text-xs">{d.poblaciones_objetivo?.nombre || '—'}</td>
                <td className="p-2 text-xs">{fullName(d.creador) || '—'}</td>
                <td className="p-2 text-xs">{fullName(d.revisor_pedagogico) || '—'}</td>
                <td className="p-2 text-xs">{fullName(d.revisor_estilo) || '—'}</td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No hay documentos en este proyecto.
                </td>
              </tr>
            )}
            {documents.length > 0 && filteredDocuments.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Ningún documento coincide con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DocumentPreviewModal
        open={!!previewDocId}
        documentId={previewDocId}
        onClose={() => setPreviewDocId(null)}
      />
    </div>
  );
}

// Lista de subformularios liberados al equipo multimedia del proyecto (una
// fila por instancia/tarea), con filtros — versión orientada a
// subformularios de la sección anterior, para la pestaña "Multimedia".
function MultimediaSubformsSection({ assignments, documents, multimediaRoles, teamMembers, onExportCsv }) {
  const [previewSubformId, setPreviewSubformId] = useState(null);
  const [previewDocId, setPreviewDocId] = useState(null);
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterPoblacion, setFilterPoblacion] = useState('');
  const [filterUsuario, setFilterUsuario] = useState('');
  const [filterRol, setFilterRol] = useState('');

  const poblacionByDocId = new Map(documents.map((d) => [d.id, d.poblaciones_objetivo?.nombre || '']));
  const roleName = (id) => multimediaRoles.find((r) => r.id === id)?.nombre || '—';
  const assignedName = (userId) => {
    const m = teamMembers.find((tm) => tm.profiles?.id === userId);
    return m ? `${m.profiles.nombre} ${m.profiles.apellido}` : 'Sin asignar';
  };

  const rows = assignments.map((a) => ({
    ...a,
    poblacion_objetivo_nombre: poblacionByDocId.get(a.document_id) || '',
    rol_nombre: roleName(a.multimedia_role_id),
    usuario_nombre: assignedName(a.assigned_user_id),
  }));

  const tipos = [...new Set(rows.map((r) => r.subform_nombre).filter(Boolean))].sort();
  const estados = [...new Set(rows.map((r) => r.estado))].sort();
  const poblaciones = [...new Set(rows.map((r) => r.poblacion_objetivo_nombre).filter(Boolean))].sort();
  const roles = [...new Set(rows.map((r) => r.rol_nombre).filter((n) => n !== '—'))].sort();
  const usuarios = [...new Set(rows.map((r) => r.usuario_nombre).filter((n) => n !== 'Sin asignar'))].sort();

  const hasActiveFilters =
    filterCodigo || filterTipo || filterEstado || filterPoblacion || filterUsuario || filterRol;
  const clearFilters = () => {
    setFilterCodigo('');
    setFilterTipo('');
    setFilterEstado('');
    setFilterPoblacion('');
    setFilterUsuario('');
    setFilterRol('');
  };

  const filteredRows = rows.filter((r) => {
    if (filterCodigo && !(r.subform_codigo || '').toLowerCase().includes(filterCodigo.toLowerCase())) return false;
    if (filterTipo && r.subform_nombre !== filterTipo) return false;
    if (filterEstado && r.estado !== filterEstado) return false;
    if (filterPoblacion && r.poblacion_objetivo_nombre !== filterPoblacion) return false;
    if (filterUsuario && r.usuario_nombre !== filterUsuario) return false;
    if (filterRol && r.rol_nombre !== filterRol) return false;
    return true;
  });

  return (
    <div className="paper-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display font-bold text-deepViolet">
          Subformularios liberados a multimedia ({filteredRows.length}
          {filteredRows.length !== rows.length ? ` de ${rows.length}` : ''})
        </h3>
        <button
          onClick={() => onExportCsv(filteredRows)}
          disabled={filteredRows.length === 0}
          className="px-3 py-1.5 rounded-lg bg-cognitiveTeal text-white text-xs font-semibold disabled:opacity-50"
        >
          ⬇ Descargar CSV
        </button>
      </div>

      {rows.length > 0 && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Código subformulario</label>
            <input
              value={filterCodigo}
              onChange={(e) => setFilterCodigo(e.target.value)}
              placeholder="Buscar..."
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tipo de subformulario</label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {estados.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Población objetivo</label>
            <select
              value={filterPoblacion}
              onChange={(e) => setFilterPoblacion(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todas</option>
              {poblaciones.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Rol asignado</label>
            <select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Usuario asignado</label>
              <select
                value={filterUsuario}
                onChange={(e) => setFilterUsuario(e.target.value)}
                className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
              >
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-red-500 hover:underline whitespace-nowrap pb-1.5"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
            <tr>
              <th className="p-2">Código subformulario</th>
              <th className="p-2">Código documento</th>
              <th className="p-2">Tipo de subformulario</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Usuario asignado</th>
              <th className="p-2">Población objetivo</th>
              <th className="p-2">Rol asignado</th>
              <th className="p-2">Fecha de asignación</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-deepViolet/10">
                <td className="p-2 font-mono text-xs">
                  <button onClick={() => setPreviewSubformId(r.id)} className="text-cognitiveTeal hover:underline">
                    {r.subform_codigo || '(ver)'}
                  </button>
                </td>
                <td className="p-2 font-mono text-xs">
                  <button
                    onClick={() => setPreviewDocId(r.document_id)}
                    className="text-cognitiveTeal hover:underline"
                  >
                    {r.document_codigo}
                  </button>
                </td>
                <td className="p-2 text-xs">{r.subform_nombre}</td>
                <td className="p-2">
                  <StateBadge estado={r.estado} />
                </td>
                <td className="p-2 text-xs">{r.usuario_nombre}</td>
                <td className="p-2 text-xs">{r.poblacion_objetivo_nombre || '—'}</td>
                <td className="p-2 text-xs">{r.rol_nombre}</td>
                <td className="p-2 text-xs">{fmtDate(r.released_at || r.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  No hay subformularios liberados a multimedia en este proyecto.
                </td>
              </tr>
            )}
            {rows.length > 0 && filteredRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  Ningún subformulario coincide con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SubformPreviewModal
        open={!!previewSubformId}
        assignmentId={previewSubformId}
        onClose={() => setPreviewSubformId(null)}
      />
      <DocumentPreviewModal open={!!previewDocId} documentId={previewDocId} onClose={() => setPreviewDocId(null)} />
    </div>
  );
}

// Lista de documentos enviados a Implementación (uno por documento, no una
// tabla genérica de documentos): orientada a los estados propios de esa
// etapa, no a los del flujo editorial — versión para la pestaña
// "Implementación".
function ImplementationSection({ implementations, teamMembers, onExportCsv }) {
  const [previewDocId, setPreviewDocId] = useState(null);
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterUsuario, setFilterUsuario] = useState('');

  const assignedName = (userId) => {
    const m = teamMembers.find((tm) => tm.profiles?.id === userId);
    return m ? `${m.profiles.nombre} ${m.profiles.apellido}` : 'Sin asignar';
  };

  const rows = implementations.map((i) => ({ ...i, usuario_nombre: assignedName(i.assigned_user_id) }));

  const estados = [...new Set(rows.map((r) => r.estado))].sort();
  const usuarios = [...new Set(rows.map((r) => r.usuario_nombre).filter((n) => n !== 'Sin asignar'))].sort();

  const hasActiveFilters = filterCodigo || filterEstado || filterUsuario;
  const clearFilters = () => {
    setFilterCodigo('');
    setFilterEstado('');
    setFilterUsuario('');
  };

  const filteredRows = rows.filter((r) => {
    if (filterCodigo && !(r.document_codigo || '').toLowerCase().includes(filterCodigo.toLowerCase())) return false;
    if (filterEstado && r.estado !== filterEstado) return false;
    if (filterUsuario && r.usuario_nombre !== filterUsuario) return false;
    return true;
  });

  return (
    <div className="paper-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display font-bold text-deepViolet">
          Documentos enviados a implementación ({filteredRows.length}
          {filteredRows.length !== rows.length ? ` de ${rows.length}` : ''})
        </h3>
        <button
          onClick={() => onExportCsv(filteredRows)}
          disabled={filteredRows.length === 0}
          className="px-3 py-1.5 rounded-lg bg-cognitiveTeal text-white text-xs font-semibold disabled:opacity-50"
        >
          ⬇ Descargar CSV
        </button>
      </div>

      {rows.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-2 items-end mb-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Código</label>
            <input
              value={filterCodigo}
              onChange={(e) => setFilterCodigo(e.target.value)}
              placeholder="Buscar..."
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Estado implementación</label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
            >
              <option value="">Todos</option>
              {estados.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Implementador asignado</label>
              <select
                value={filterUsuario}
                onChange={(e) => setFilterUsuario(e.target.value)}
                className="w-full border border-deepViolet/20 rounded-lg p-1.5 text-xs"
              >
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-semibold text-red-500 hover:underline whitespace-nowrap pb-1.5"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Estado implementación</th>
              <th className="p-2">Implementador asignado</th>
              <th className="p-2">Fecha de asignación</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-deepViolet/10">
                <td className="p-2 font-mono text-xs">
                  <button
                    onClick={() => setPreviewDocId(r.document_id)}
                    className="text-cognitiveTeal hover:underline"
                  >
                    {r.document_codigo}
                  </button>
                </td>
                <td className="p-2">
                  <StateBadge estado={r.estado} />
                </td>
                <td className="p-2 text-xs">{r.usuario_nombre}</td>
                <td className="p-2 text-xs">{fmtDate(r.released_at || r.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  No hay documentos enviados a implementación en este proyecto.
                </td>
              </tr>
            )}
            {rows.length > 0 && filteredRows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  Ningún documento coincide con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DocumentPreviewModal open={!!previewDocId} documentId={previewDocId} onClose={() => setPreviewDocId(null)} />
    </div>
  );
}

export default function Analytics() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [tab, setTab] = useState('documentos');
  const [documents, setDocuments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [multimediaAnalytics, setMultimediaAnalytics] = useState(null);
  const [implementationAnalytics, setImplementationAnalytics] = useState(null);
  const [subformAssignments, setSubformAssignments] = useState([]);
  const [multimediaRolesCatalog, setMultimediaRolesCatalog] = useState([]);
  const [multimediaTeam, setMultimediaTeam] = useState([]);
  const [implementations, setImplementations] = useState([]);
  const [implementationTeam, setImplementationTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api.get('/projects').then((data) => {
      setProjects(data.projects);
      if (data.projects.length > 0) setProjectId(data.projects[0].id);
      else setLoading(false);
    });
    api.get('/agent-usage').then(setUsage);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.get(`/projects/${projectId}/documents`),
      api.get(`/projects/${projectId}/analytics`),
      api.get(`/projects/${projectId}/multimedia-analytics`),
      api.get(`/projects/${projectId}/implementation-analytics`),
      api.get(`/subform-assignments?project_id=${projectId}&all=1`),
      api.get('/multimedia-roles'),
      api.get(`/projects/${projectId}/multimedia-team`),
      api.get(`/implementations?project_id=${projectId}&all=1`),
      api.get(`/projects/${projectId}/implementation-team`),
    ]).then(
      ([
        docsData,
        analyticsData,
        multimediaData,
        implementationData,
        subformAssignmentsData,
        rolesData,
        teamData,
        implementationsData,
        implementationTeamData,
      ]) => {
        setDocuments(docsData.documents);
        setAnalytics(analyticsData);
        setMultimediaAnalytics(multimediaData);
        setImplementationAnalytics(implementationData);
        setSubformAssignments(subformAssignmentsData.assignments);
        setMultimediaRolesCatalog(rolesData.multimedia_roles);
        setMultimediaTeam(teamData.multimedia_project_users);
        setImplementations(implementationsData.implementations);
        setImplementationTeam(implementationTeamData.implementacion_project_users);
        setLoading(false);
      }
    );
  }, [projectId]);

  const exportCsv = (docs) => {
    const project = projects.find((p) => p.id === projectId);
    const csv = toCsv(docs || documents, [
      { label: 'Código', value: (d) => d.codigo },
      { label: 'Tipo de documento', value: (d) => d.document_types?.nombre || '' },
      { label: 'Estado', value: (d) => d.estado },
      { label: 'Población objetivo', value: (d) => d.poblaciones_objetivo?.nombre || '' },
      { label: 'Creador Experto', value: (d) => fullName(d.creador) },
      { label: 'Revisor Pedagógico', value: (d) => fullName(d.revisor_pedagogico) },
      { label: 'Revisor de Estilo', value: (d) => fullName(d.revisor_estilo) },
      { label: 'Creado', value: (d) => fmtDate(d.created_at) },
      { label: 'Última actualización', value: (d) => fmtDate(d.updated_at) },
      { label: 'Vaciado', value: (d) => fmtDate(d.vaciado_at) },
    ]);
    downloadCsv(`${project?.codigo || 'proyecto'}-documentos.csv`, csv);
  };

  const exportSubformsCsv = (rows) => {
    const project = projects.find((p) => p.id === projectId);
    const csv = toCsv(rows, [
      { label: 'Código subformulario', value: (r) => r.subform_codigo || '' },
      { label: 'Código documento', value: (r) => r.document_codigo },
      { label: 'Tipo de subformulario', value: (r) => r.subform_nombre },
      { label: 'Estado', value: (r) => r.estado },
      { label: 'Usuario asignado', value: (r) => r.usuario_nombre },
      { label: 'Población objetivo', value: (r) => r.poblacion_objetivo_nombre },
      { label: 'Rol asignado', value: (r) => r.rol_nombre },
      { label: 'Fecha de asignación', value: (r) => fmtDate(r.released_at || r.created_at) },
    ]);
    downloadCsv(`${project?.codigo || 'proyecto'}-subformularios-multimedia.csv`, csv);
  };

  const exportImplementationsCsv = (rows) => {
    const project = projects.find((p) => p.id === projectId);
    const csv = toCsv(rows, [
      { label: 'Código documento', value: (r) => r.document_codigo },
      { label: 'Estado implementación', value: (r) => r.estado },
      { label: 'Implementador asignado', value: (r) => r.usuario_nombre },
      { label: 'Fecha de asignación', value: (r) => fmtDate(r.released_at || r.created_at) },
    ]);
    downloadCsv(`${project?.codigo || 'proyecto'}-implementacion.csv`, csv);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display font-bold text-xl text-deepViolet">Analítica</h2>
        {projects.length > 0 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border border-deepViolet/20 rounded-lg p-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {projects.length === 0 ? (
        <p className="text-slate-500 text-sm">No hay proyectos aún.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 bg-deepViolet/5 rounded-lg p-1 w-fit">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
                  tab === t.key ? 'bg-white shadow text-deepViolet' : 'text-deepViolet/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading || !analytics ? (
            <p className="text-slate-500 text-sm">Cargando...</p>
          ) : (
            <>
              {tab === 'documentos' && (
                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">Embudo por estado</h3>
                      <BarChart data={analytics.funnel} labelKey="estado" valueKey="count" />
                    </div>

                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">Tiempo promedio por etapa</h3>
                      {analytics.cycle_time.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          Aún no hay suficientes transiciones de estado para calcular esto.
                        </p>
                      ) : (
                        <BarChart
                          data={analytics.cycle_time}
                          labelKey="estado"
                          valueKey="avg_days"
                          formatValue={(v) => `${v} d`}
                        />
                      )}
                    </div>

                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">Carga por usuario</h3>
                      {analytics.workload.length === 0 ? (
                        <p className="text-sm text-slate-400">Este proyecto no tiene usuarios asignados.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs uppercase text-deepViolet/70">
                            <tr>
                              <th className="p-1.5">Usuario</th>
                              <th className="p-1.5">Rol</th>
                              <th className="p-1.5 text-right">Asignados</th>
                              <th className="p-1.5 text-right">Finalizados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.workload.map((w) => (
                              <tr key={`${w.user_id}-${w.role}`} className="border-t border-deepViolet/10">
                                <td className="p-1.5">{w.nombre}</td>
                                <td className="p-1.5 text-xs text-slate-500">{w.role}</td>
                                <td className="p-1.5 text-right font-semibold">{w.asignados}</td>
                                <td className="p-1.5 text-right text-emerald-700">{w.finalizados}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">
                        Devoluciones al creador {analytics.total_devueltos > 0 && `(${analytics.total_devueltos})`}
                      </h3>
                      {analytics.devoluciones.length === 0 ? (
                        <p className="text-sm text-slate-400">No se ha devuelto ningún documento al creador.</p>
                      ) : (
                        <BarChart data={analytics.devoluciones} labelKey="etapa" valueKey="count" />
                      )}
                    </div>
                  </div>

                  <DocumentsListSection documents={documents} onExportCsv={exportCsv} />
                </div>
              )}

              {tab === 'multimedia' && (
                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">
                        Embudo por estado {multimediaAnalytics?.total > 0 && `(${multimediaAnalytics.total})`}
                      </h3>
                      {!multimediaAnalytics || multimediaAnalytics.total === 0 ? (
                        <p className="text-sm text-slate-400">
                          Aún no se ha liberado ningún subformulario a multimedia en este proyecto.
                        </p>
                      ) : (
                        <BarChart data={multimediaAnalytics.funnel} labelKey="estado" valueKey="count" />
                      )}
                    </div>

                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">Por tipo de subformulario</h3>
                      {!multimediaAnalytics || multimediaAnalytics.by_subform_type.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin datos aún.</p>
                      ) : (
                        <BarChart data={multimediaAnalytics.by_subform_type} labelKey="nombre" valueKey="count" />
                      )}
                    </div>

                    <div className="paper-card rounded-xl p-5 md:col-span-2">
                      <h3 className="font-display font-bold text-deepViolet mb-3">Carga por miembro del equipo</h3>
                      {!multimediaAnalytics || multimediaAnalytics.workload.length === 0 ? (
                        <p className="text-sm text-slate-400">Este proyecto no tiene equipo multimedia asignado.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs uppercase text-deepViolet/70">
                            <tr>
                              <th className="p-1.5">Usuario</th>
                              <th className="p-1.5">Rol</th>
                              <th className="p-1.5 text-right">Asignados</th>
                              <th className="p-1.5 text-right">Finalizados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {multimediaAnalytics.workload.map((w) => (
                              <tr key={w.user_id} className="border-t border-deepViolet/10">
                                <td className="p-1.5">{w.nombre}</td>
                                <td className="p-1.5 text-xs text-slate-500">{w.role}</td>
                                <td className="p-1.5 text-right font-semibold">{w.asignados}</td>
                                <td className="p-1.5 text-right text-emerald-700">{w.finalizados}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <MultimediaSubformsSection
                    assignments={subformAssignments}
                    documents={documents}
                    multimediaRoles={multimediaRolesCatalog}
                    teamMembers={multimediaTeam}
                    onExportCsv={exportSubformsCsv}
                  />
                </div>
              )}

              {tab === 'implementacion' && (
                <div className="space-y-5">
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">
                        Embudo por estado {implementationAnalytics?.total > 0 && `(${implementationAnalytics.total})`}
                      </h3>
                      {!implementationAnalytics || implementationAnalytics.total === 0 ? (
                        <p className="text-sm text-slate-400">
                          Aún no se ha enviado ningún documento a implementación en este proyecto.
                        </p>
                      ) : (
                        <BarChart data={implementationAnalytics.funnel} labelKey="estado" valueKey="count" />
                      )}
                    </div>

                    <div className="paper-card rounded-xl p-5">
                      <h3 className="font-display font-bold text-deepViolet mb-3">Carga por Implementador</h3>
                      {!implementationAnalytics || implementationAnalytics.workload.length === 0 ? (
                        <p className="text-sm text-slate-400">
                          Este proyecto no tiene equipo de implementación asignado.
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs uppercase text-deepViolet/70">
                            <tr>
                              <th className="p-1.5">Usuario</th>
                              <th className="p-1.5 text-right">Asignados</th>
                              <th className="p-1.5 text-right">Implementados</th>
                            </tr>
                          </thead>
                          <tbody>
                            {implementationAnalytics.workload.map((w) => (
                              <tr key={w.user_id} className="border-t border-deepViolet/10">
                                <td className="p-1.5">{w.nombre}</td>
                                <td className="p-1.5 text-right font-semibold">{w.asignados}</td>
                                <td className="p-1.5 text-right text-emerald-700">{w.implementados}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <ImplementationSection
                    implementations={implementations}
                    teamMembers={implementationTeam}
                    onExportCsv={exportImplementationsCsv}
                  />
                </div>
              )}

              {tab === 'consumo-ia' && (
                <div className="space-y-5">
                  {usage && (
                    <div className="paper-card rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="font-display font-bold text-deepViolet">
                          Consumo de tokens del agente sintético
                        </h3>
                        <p className="text-xs text-slate-500">
                          {usage.total.intentos} intentos de generación · {fmtTokens(usage.total.total_tokens)}{' '}
                          tokens en total ({fmtTokens(usage.total.prompt_tokens)} de entrada,{' '}
                          {fmtTokens(usage.total.completion_tokens)} de salida)
                        </p>
                      </div>
                      {usage.total.intentos === 0 ? (
                        <p className="text-sm text-slate-400">
                          Aún no se ha generado contenido con el agente sintético en ningún proyecto.
                        </p>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-5">
                          <div>
                            <p className="text-xs font-semibold uppercase text-deepViolet/70 mb-2">Por proyecto</p>
                            <table className="w-full text-sm">
                              <thead className="text-left text-xs uppercase text-deepViolet/70">
                                <tr>
                                  <th className="p-1.5">Proyecto</th>
                                  <th className="p-1.5 text-right">Intentos</th>
                                  <th className="p-1.5 text-right">Tokens</th>
                                </tr>
                              </thead>
                              <tbody>
                                {usage.by_project.map((p) => (
                                  <tr key={p.id} className="border-t border-deepViolet/10">
                                    <td className="p-1.5">{p.nombre}</td>
                                    <td className="p-1.5 text-right">{p.intentos}</td>
                                    <td className="p-1.5 text-right font-semibold">{fmtTokens(p.total_tokens)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-deepViolet/70 mb-2">
                              Por agente sintético
                            </p>
                            <table className="w-full text-sm">
                              <thead className="text-left text-xs uppercase text-deepViolet/70">
                                <tr>
                                  <th className="p-1.5">Agente</th>
                                  <th className="p-1.5 text-right">Intentos</th>
                                  <th className="p-1.5 text-right">Tokens</th>
                                </tr>
                              </thead>
                              <tbody>
                                {usage.by_agent.map((a) => (
                                  <tr key={a.id} className="border-t border-deepViolet/10">
                                    <td className="p-1.5">{a.nombre}</td>
                                    <td className="p-1.5 text-right">{a.intentos}</td>
                                    <td className="p-1.5 text-right font-semibold">{fmtTokens(a.total_tokens)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <DocumentsListSection documents={documents} onExportCsv={exportCsv} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
