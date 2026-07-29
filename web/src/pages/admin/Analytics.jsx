import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { toCsv, downloadCsv } from '../../lib/csv.js';
import StateBadge from '../../components/StateBadge.jsx';
import BarChart from '../../components/analytics/BarChart.jsx';

const fmtDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const fullName = (p) => (p ? `${p.nombre} ${p.apellido}` : '');
const fmtTokens = (n) => n.toLocaleString('es-CO');

const TABS = [
  { key: 'documentos', label: 'Documentos' },
  { key: 'multimedia', label: 'Multimedia' },
  { key: 'implementacion', label: 'Implementación' },
  { key: 'consumo-ia', label: 'Consumo IA' },
];

// Lista plana de los documentos del proyecto seleccionado, con descarga en
// CSV — se repite al final de las 4 pestañas (mismo contenido, misma
// posición fija) para tener siempre a mano el detalle documento por
// documento sin importar qué panel de gráficas se esté viendo.
function DocumentsListSection({ documents, onExportCsv }) {
  return (
    <div className="paper-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display font-bold text-deepViolet">Documentos del proyecto ({documents.length})</h3>
        <button
          onClick={onExportCsv}
          disabled={documents.length === 0}
          className="px-3 py-1.5 rounded-lg bg-cognitiveTeal text-white text-xs font-semibold disabled:opacity-50"
        >
          ⬇ Descargar CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-deepViolet/5 text-left text-xs uppercase text-deepViolet/70">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Creador Experto</th>
              <th className="p-2">Revisor Pedagógico</th>
              <th className="p-2">Revisor de Estilo</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-t border-deepViolet/10">
                <td className="p-2 font-mono text-xs">{d.codigo}</td>
                <td className="p-2">
                  <StateBadge estado={d.estado} />
                </td>
                <td className="p-2 text-xs">{fullName(d.creador) || '—'}</td>
                <td className="p-2 text-xs">{fullName(d.revisor_pedagogico) || '—'}</td>
                <td className="p-2 text-xs">{fullName(d.revisor_estilo) || '—'}</td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  No hay documentos en este proyecto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    ]).then(([docsData, analyticsData, multimediaData, implementationData]) => {
      setDocuments(docsData.documents);
      setAnalytics(analyticsData);
      setMultimediaAnalytics(multimediaData);
      setImplementationAnalytics(implementationData);
      setLoading(false);
    });
  }, [projectId]);

  const exportCsv = () => {
    const project = projects.find((p) => p.id === projectId);
    const csv = toCsv(documents, [
      { label: 'Código', value: (d) => d.codigo },
      { label: 'Tipo de documento', value: (d) => d.document_types?.nombre || '' },
      { label: 'Estado', value: (d) => d.estado },
      { label: 'Creador Experto', value: (d) => fullName(d.creador) },
      { label: 'Revisor Pedagógico', value: (d) => fullName(d.revisor_pedagogico) },
      { label: 'Revisor de Estilo', value: (d) => fullName(d.revisor_estilo) },
      { label: 'Creado', value: (d) => fmtDate(d.created_at) },
      { label: 'Última actualización', value: (d) => fmtDate(d.updated_at) },
      { label: 'Vaciado', value: (d) => fmtDate(d.vaciado_at) },
    ]);
    downloadCsv(`${project?.codigo || 'proyecto'}-documentos.csv`, csv);
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

                  <DocumentsListSection documents={documents} onExportCsv={exportCsv} />
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

                  <DocumentsListSection documents={documents} onExportCsv={exportCsv} />
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
