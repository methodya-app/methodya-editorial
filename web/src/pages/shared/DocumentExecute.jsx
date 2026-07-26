import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import StateBadge from '../../components/StateBadge.jsx';
import FormRenderer from '../../components/form/FormRenderer.jsx';
import ProcessingModal from '../../components/ProcessingModal.jsx';

// Aviso flotante: se muestra en una posición fija de la pantalla (no dentro
// del flujo del documento) para que se vea sin importar el scroll, ya que
// los botones de acción viven en una barra fija al fondo.
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      className={`fixed bottom-24 right-6 z-50 max-w-sm rounded-lg shadow-lg p-3 text-sm font-semibold ${
        isError ? 'bg-red-600 text-white' : 'bg-activeMint text-emerald-900'
      }`}
    >
      {toast.text}
    </div>
  );
}

// Pantalla de "modo ejecución" (punto 2.1.6): diligenciar o revisar un
// documento a través de su formulario. La reutilizan el Creador Experto, el
// Revisor Pedagógico, el Revisor de Estilo y el Administrador; los botones
// disponibles cambian según el rol y el estado actual del documento.
export default function DocumentExecute() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [subformsLibrary, setSubformsLibrary] = useState([]);
  const [paragraphsLibrary, setParagraphsLibrary] = useState([]);
  const [projectUsers, setProjectUsers] = useState([]);
  const [globalValidations, setGlobalValidations] = useState([]);
  const [projectPoblaciones, setProjectPoblaciones] = useState([]);
  const [projectTemas, setProjectTemas] = useState([]);
  const [projectDotacionReferencias, setProjectDotacionReferencias] = useState([]);
  const [languagetoolConfigured, setLanguagetoolConfigured] = useState(false);
  const [spellcheckSubmitMode, setSpellcheckSubmitMode] = useState('off');
  const [saving, setSaving] = useState(false);
  const [vaciando, setVaciando] = useState(false);
  const [toast, setToast] = useState(null);
  const [spellWarning, setSpellWarning] = useState(null);

  const load = useCallback(async () => {
    const doc = await api.get(`/documents/${id}`);
    setData(doc);
    setValues(doc.values || {});
    const [subforms, paragraphs, users, validations, publicSettings, poblaciones, dotacionReferencias] =
      await Promise.all([
        api.get('/subforms'),
        api.get('/paragraphs'),
        api.get(`/projects/${doc.document.project_id}/users`),
        api.get(`/projects/${doc.document.project_id}/validations`),
        api.get('/settings/public'),
        api.get('/poblaciones-objetivo'),
        api.get('/dotacion-referencias'),
      ]);
    setSubformsLibrary(subforms.subforms);
    setParagraphsLibrary(paragraphs.paragraphs);
    setProjectUsers(users.project_users);
    setGlobalValidations(validations.validations);
    setLanguagetoolConfigured(publicSettings.languagetool_configured);
    setSpellcheckSubmitMode(publicSettings.spellcheck_submit_mode || 'off');

    // Opciones dinámicas de los tipos de campo "Población objetivo" / "Temas
    // y Focos" / "Dotación": solo lo que este proyecto tiene seleccionado en
    // su Parametrización (no todo el catálogo global).
    const parametrizacion = doc.document.projects?.parametrizacion || {};
    const allowedPoblacionIds = parametrizacion.poblacion_objetivo?.poblacion_ids || [];
    const allowedDotacionIds = parametrizacion.dotacion?.referencia_ids || [];
    setProjectPoblaciones(poblaciones.poblaciones_objetivo.filter((p) => allowedPoblacionIds.includes(p.id)));
    setProjectTemas(parametrizacion.temas_focos?.temas || []);
    setProjectDotacionReferencias(
      dotacionReferencias.dotacion_referencias.filter((r) => allowedDotacionIds.includes(r.id))
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-slate-500">Cargando documento...</p>;

  const { document, form, access } = data;
  const reviewMode = access.is_revisor_pedagogico || access.is_revisor_estilo;
  const canEdit =
    isAdmin ||
    (access.is_creador && ['Pendiente', 'En proceso', 'Devuelto'].includes(document.estado)) ||
    (access.is_revisor_pedagogico && document.estado === 'Revisión Pedagógica') ||
    (access.is_revisor_estilo && document.estado === 'Revisión Estilo');
  const readOnly = access.is_read_only || !canEdit;

  // Nombres de campo -> etiqueta legible, para armar mensajes de error claros.
  const fieldLabel = (variable) =>
    form?.sections?.flatMap((s) => s.fields).find((f) => f.variable === variable)?.label || variable;

  const showValidationErrors = (fieldErrors) => {
    setErrors(fieldErrors);
    const labels = Object.keys(fieldErrors).map(fieldLabel);
    setToast({
      type: 'error',
      text:
        labels.length === 1
          ? `Falta completar o corregir el campo "${labels[0]}".`
          : `Faltan completar o corregir estos campos: ${labels.join(', ')}.`,
    });
    const firstVariable = Object.keys(fieldErrors)[0];
    if (firstVariable) {
      window.document
        .getElementById(`field-${firstVariable}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setToast(null);
    try {
      await api.put(`/documents/${id}/data`, { values, partial: true });
      setToast({ type: 'success', text: 'Guardado ✓' });
    } catch (err) {
      setToast({ type: 'error', text: 'Error al guardar: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Tipos de campo de texto libre en los que tiene sentido revisar ortografía
  // (debe coincidir con SPELLCHECKABLE_TYPES de FormRenderer.jsx).
  const SPELLCHECKABLE_TYPES = ['text', 'textarea', 'predefined_paragraph'];

  // Revisa ortografía de todos los campos de texto libre diligenciados y
  // devuelve solo los que tienen algún error/sugerencia pendiente. Si el
  // corrector falla para un campo (servicio caído, límite alcanzado), ese
  // campo se ignora en vez de bloquear todo el flujo de envío.
  const findSpellingIssues = async () => {
    const fields = (form?.sections?.flatMap((s) => s.fields) || []).filter(
      (f) => SPELLCHECKABLE_TYPES.includes(f.type) && (values[f.variable] || '').toString().trim()
    );
    if (fields.length === 0) return [];
    const results = await Promise.all(
      fields.map((f) =>
        api
          .post('/ai/check-spelling', { text: values[f.variable] })
          .then((r) => ({ field: f, issues: r.issues || [] }))
          .catch(() => ({ field: f, issues: [] }))
      )
    );
    return results.filter((r) => r.issues.length > 0);
  };

  const doSubmit = async (action) => {
    setSaving(true);
    setToast(null);
    try {
      // Guarda y valida de forma estricta antes de cambiar de estado.
      await api.put(`/documents/${id}/data`, { values, partial: false });
      await api.post(`/documents/${id}/submit`, { action });
      await load();
      setErrors({});
      setSpellWarning(null);
      setToast({ type: 'success', text: 'Acción ejecutada ✓' });
    } catch (err) {
      if (err.errors) showValidationErrors(err.errors);
      else setToast({ type: 'error', text: 'No se pudo completar: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const submitAction = async (action) => {
    if (spellcheckSubmitMode !== 'off' && languagetoolConfigured) {
      setSaving(true);
      setToast(null);
      const flagged = await findSpellingIssues();
      setSaving(false);

      if (flagged.length > 0) {
        const labels = flagged.map((f) => f.field.label);
        if (spellcheckSubmitMode === 'block') {
          setToast({
            type: 'error',
            text: `Hay posibles errores ortográficos sin revisar en: ${labels.join(
              ', '
            )}. Usa "Revisar ortografía" en cada campo para corregirlos antes de enviar.`,
          });
          window.document
            .getElementById(`field-${flagged[0].field.variable}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        // modo 'warn': pide confirmación explícita antes de enviar
        setSpellWarning({ action, labels });
        return;
      }
    }
    await doSubmit(action);
  };

  const confirmSubmitDespiteWarning = () => {
    const pending = spellWarning;
    setSpellWarning(null);
    if (pending) doSubmit(pending.action);
  };

  const saveAndValidate = async () => {
    setSaving(true);
    setToast(null);
    try {
      await api.put(`/documents/${id}/data`, { values, partial: false });
      setErrors({});
      setToast({ type: 'success', text: 'Guardado y validado ✓' });
    } catch (err) {
      if (err.errors) showValidationErrors(err.errors);
      else setToast({ type: 'error', text: 'No se pudo guardar: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const canReleaseToMultimedia = isAdmin || access.is_revisor_pedagogico || access.is_revisor_estilo;

  const collectAllSubformInstanceIds = () => {
    const ids = [];
    for (const section of form?.sections || []) {
      for (const field of section.fields) {
        if (field.type !== 'subform') continue;
        for (const inst of values[field.variable]?.instances || []) {
          if (inst.id) ids.push(inst.id);
        }
      }
    }
    return ids;
  };

  const releaseSubforms = async (instanceIds) => {
    if (instanceIds.length === 0) return;
    try {
      const result = await api.post(`/documents/${id}/subforms/release`, { instance_ids: instanceIds });
      await load();
      const parts = [];
      if (result.released.length > 0) parts.push(`${result.released.length} enviado(s) a multimedia ✓`);
      if (result.skipped.length > 0) {
        parts.push(`${result.skipped.length} sin enviar: ${result.skipped.map((s) => s.reason).join('; ')}`);
      }
      setToast({ type: result.released.length > 0 ? 'success' : 'error', text: parts.join(' — ') });
    } catch (err) {
      setToast({ type: 'error', text: 'No se pudo enviar a multimedia: ' + err.message });
    }
  };

  const vaciar = async () => {
    if (vaciando) return; // ya hay un vaciamiento en curso, ignora el doble clic
    setSaving(true);
    setVaciando(true);
    try {
      const result = await api.post(`/documents/${id}/vaciar`);
      await load();
      setToast({
        type: 'success',
        text: result.real ? 'Vaciamiento ejecutado en Google Drive ✓' : 'Vaciamiento ejecutado ✓',
      });
    } catch (err) {
      setToast({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setSaving(false);
      setVaciando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      <div>
        <Link to="/mis-proyectos" className="text-xs text-cognitiveTeal hover:underline">
          ← Volver
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="font-display font-bold text-xl text-deepViolet">{document.codigo}</h2>
          <StateBadge estado={document.estado} />
          {document.creador?.is_synthetic && (
            <span className="text-xs font-semibold text-cognitiveTeal bg-cognitiveTeal-light px-2 py-0.5 rounded-full">
              ✨ Generado por IA
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">{form?.titulo}</p>
      </div>

      {document.poblaciones_objetivo && (
        <div className="text-sm bg-cognitiveTeal-light text-cognitiveTeal-deep rounded-lg p-2.5">
          <strong>Población objetivo:</strong> {document.poblaciones_objetivo.nombre} (
          {document.poblaciones_objetivo.edad_min}-{document.poblaciones_objetivo.edad_max} años
          {document.poblaciones_objetivo.nivel_lector ? `, nivel lector: ${document.poblaciones_objetivo.nivel_lector}` : ''}
          )
        </div>
      )}

      {readOnly && (
        <div className="text-sm text-warmAmber-hover bg-warmAmber-light rounded-lg p-2">
          Este documento está en modo solo lectura para tu rol en su estado actual.
        </div>
      )}

      {canReleaseToMultimedia && collectAllSubformInstanceIds().length > 0 && (
        <button
          onClick={() => releaseSubforms(collectAllSubformInstanceIds())}
          className="text-xs font-semibold text-cognitiveTeal hover:underline"
        >
          🎬 Enviar todos los subformularios a multimedia
        </button>
      )}

      {form && (
        <FormRenderer
          form={form}
          values={values}
          onChange={setValues}
          errors={errors}
          onErrorsChange={setErrors}
          readOnly={readOnly}
          subformsLibrary={subformsLibrary}
          paragraphsLibrary={paragraphsLibrary}
          globalValidations={globalValidations}
          languagetoolConfigured={languagetoolConfigured}
          reviewMode={reviewMode}
          documentId={id}
          comments={data.comments}
          projectUsers={projectUsers}
          onCommentsChange={load}
          canReleaseToMultimedia={canReleaseToMultimedia}
          subformReleaseStatus={data.subform_release_status}
          onReleaseInstance={(instanceId) => releaseSubforms([instanceId])}
          projectPoblaciones={projectPoblaciones}
          projectTemas={projectTemas}
          projectDotacionReferencias={projectDotacionReferencias}
        />
      )}

      {(data.vaciado_resultado || data.vaciado_pdf_resultado) && (
        <div className="paper-card rounded-xl p-4 space-y-3">
          {data.vaciado_drive_file_id && (
            <div>
              <p className="font-display font-bold text-deepViolet mb-1">Documento vaciado en Google Drive</p>
              <a
                href={data.vaciado_resultado}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-cognitiveTeal hover:underline break-all"
              >
                {data.vaciado_resultado} ↗
              </a>
            </div>
          )}
          {data.vaciado_pdf_resultado && (
            <div>
              <p className="font-display font-bold text-deepViolet mb-1">Copia en PDF</p>
              <a
                href={data.vaciado_pdf_resultado}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-cognitiveTeal hover:underline break-all"
              >
                {data.vaciado_pdf_resultado} ↗
              </a>
            </div>
          )}
          {!data.vaciado_drive_file_id && !data.vaciado_pdf_resultado && (
            <div>
              <p className="font-display font-bold text-deepViolet mb-1">Resultado del vaciamiento (simulado)</p>
              <pre className="whitespace-pre-wrap text-xs bg-white p-3 rounded-lg border border-deepViolet/10">
                {data.vaciado_resultado}
              </pre>
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="sticky bottom-0 bg-empatheticLinen/95 backdrop-blur border-t border-deepViolet/10 p-3 flex flex-wrap gap-2 justify-end -mx-6">
          {spellWarning && (
            <div className="w-full flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warmAmber-light text-warmAmber-hover p-2.5 text-sm">
              <span>
                Posibles errores ortográficos sin revisar en: {spellWarning.labels.join(', ')}.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSpellWarning(null)}
                  className="px-3 py-1.5 rounded-lg bg-white text-warmAmber-hover text-xs font-semibold border border-warmAmber-hover/30"
                >
                  Revisar campos
                </button>
                <button
                  type="button"
                  onClick={confirmSubmitDespiteWarning}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-cognitiveTeal text-white text-xs font-semibold disabled:opacity-50"
                >
                  Enviar de todos modos
                </button>
              </div>
            </div>
          )}

          {access.is_creador && (
            <>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-deepViolet/10 text-deepViolet text-sm font-semibold disabled:opacity-50"
              >
                Guardar avance
              </button>
              <button
                onClick={() => submitAction('send_to_pedagogica')}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold disabled:opacity-50"
              >
                Enviar a revisión pedagógica
              </button>
            </>
          )}

          {access.is_revisor_pedagogico && (
            <>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-deepViolet/10 text-deepViolet text-sm font-semibold disabled:opacity-50"
              >
                Guardar avance
              </button>
              <button
                onClick={() => submitAction('return_to_creator_from_pedagogica')}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-semibold disabled:opacity-50"
              >
                Devolver al creador
              </button>
              <button
                onClick={() => submitAction('send_to_estilo')}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold disabled:opacity-50"
              >
                Enviar a revisión de estilo
              </button>
            </>
          )}

          {access.is_revisor_estilo && (
            <>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-deepViolet/10 text-deepViolet text-sm font-semibold disabled:opacity-50"
              >
                Guardar avance
              </button>
              <button
                onClick={() => submitAction('return_to_creator_from_estilo')}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-semibold disabled:opacity-50"
              >
                Devolver al creador
              </button>
              <button
                onClick={vaciar}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-warmAmber text-deepViolet text-sm font-semibold disabled:opacity-50"
              >
                Vaciar documento
              </button>
              <button
                onClick={() => submitAction('send_back_to_pedagogica')}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold disabled:opacity-50"
              >
                Enviar a revisión pedagógica
              </button>
              <button
                onClick={() => submitAction('mark_finished')}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-activeMint text-emerald-900 text-sm font-semibold disabled:opacity-50"
              >
                ✓ Marcar como terminado
              </button>
            </>
          )}

          {isAdmin && !access.is_creador && !access.is_revisor_pedagogico && !access.is_revisor_estilo && (
            <>
              <button
                onClick={saveAndValidate}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-deepViolet/10 text-deepViolet text-sm font-semibold disabled:opacity-50"
              >
                Guardar y validar
              </button>
              <button
                onClick={vaciar}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-warmAmber text-deepViolet text-sm font-semibold disabled:opacity-50"
              >
                Vaciar documento
              </button>
            </>
          )}
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
      <ProcessingModal open={vaciando} message="Vaciando documento... esto puede tardar unos segundos." />
    </div>
  );
}
