import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { showAlert } from '../../lib/alertModal.js';

// Módulo de Parámetros del Servidor (punto 2.3): la clave de la API de IA
// (Gemini) y el endpoint del backend, editables en caliente sin redeploy.
export default function ServerSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [ltUsername, setLtUsername] = useState('');
  const [ltApiKey, setLtApiKey] = useState('');
  const [spellMode, setSpellMode] = useState('off');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [googleMessage, setGoogleMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [emailProvider, setEmailProvider] = useState('gmail_smtp');
  const [emailGmailUser, setEmailGmailUser] = useState('');
  const [emailGmailAppPassword, setEmailGmailAppPassword] = useState('');
  const [emailResendApiKey, setEmailResendApiKey] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailMessage, setTestEmailMessage] = useState('');
  const pollRef = useRef(null);

  const load = async () => {
    const data = await api.get('/settings');
    setSettings(data.settings);
    setEndpoint(data.settings.backend_endpoint || '');
    setLtUsername(data.settings.languagetool_username || '');
    setSpellMode(data.settings.spellcheck_submit_mode || 'off');
    setGoogleClientId(data.settings.google_oauth_client_id || '');
    setEmailProvider(data.settings.email_provider || 'gmail_smtp');
    setEmailGmailUser(data.settings.email_gmail_user || '');
    setEmailFromName(data.settings.email_from_name || '');
    setEmailFromAddress(data.settings.email_from_address || '');
    return data.settings;
  };

  useEffect(() => {
    load();
  }, []);

  // Si volvemos de /auth/google/callback (pestaña de Google), muestra el
  // resultado y limpia la URL.
  useEffect(() => {
    const google = searchParams.get('google');
    if (!google) return;
    if (google === 'connected') setGoogleMessage({ type: 'success', text: 'Cuenta de Google conectada ✓' });
    else setGoogleMessage({ type: 'error', text: searchParams.get('message') || 'No se pudo conectar' });
    load();
    setSearchParams({}, { replace: true });
  }, [searchParams]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', {
        gemini_api_key: geminiKey || undefined,
        backend_endpoint: endpoint,
        languagetool_username: ltUsername,
        languagetool_api_key: ltApiKey || undefined,
        spellcheck_submit_mode: spellMode,
        google_oauth_client_id: googleClientId,
        google_oauth_client_secret: googleClientSecret || undefined,
        email_provider: emailProvider,
        email_gmail_user: emailGmailUser,
        email_gmail_app_password: emailGmailAppPassword || undefined,
        email_resend_api_key: emailResendApiKey || undefined,
        email_from_name: emailFromName,
        email_from_address: emailFromAddress,
      });
      setGeminiKey('');
      setLtApiKey('');
      setGoogleClientSecret('');
      setEmailGmailAppPassword('');
      setEmailResendApiKey('');
      setSavedAt(new Date());
      load();
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    setTestingEmail(true);
    setTestEmailMessage('');
    try {
      const { sent_to } = await api.post('/settings/test-email');
      setTestEmailMessage({ type: 'success', text: `Correo de prueba enviado a ${sent_to} ✓` });
    } catch (err) {
      setTestEmailMessage({ type: 'error', text: err.message });
    } finally {
      setTestingEmail(false);
    }
  };

  const connectGoogle = async () => {
    if (!googleClientId || (!googleClientSecret && !settings.google_oauth_client_secret)) {
      showAlert('Primero guarda el Client ID y Client Secret de Google OAuth.');
      return;
    }
    setConnecting(true);
    setGoogleMessage('');
    try {
      const { url } = await api.get('/auth/google/start');
      window.open(url, '_blank', 'noopener,noreferrer');
      // Mientras el admin autoriza en la otra pestaña, esta va revisando
      // cada 3s si ya quedó conectado, hasta 2 minutos.
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        const fresh = await load();
        if (fresh.google_oauth_connected || attempts >= 40) {
          clearInterval(pollRef.current);
          setConnecting(false);
        }
      }, 3000);
    } catch (err) {
      setGoogleMessage({ type: 'error', text: err.message });
      setConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm('¿Desconectar la cuenta de Google? El vaciamiento real dejará de funcionar hasta reconectarla.')) {
      return;
    }
    await api.put('/settings', { google_disconnect: true });
    load();
  };

  if (!settings) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h2 className="font-display font-bold text-xl text-deepViolet">Parámetros del servidor</h2>

      <form onSubmit={save} className="paper-card rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Clave de la API de Gemini actual: <span className="font-mono">{settings.gemini_api_key || 'no configurada'}</span>
          </label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Nueva clave (dejar vacío para no cambiar)"
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Endpoint backend serverless</label>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://tu-backend.vercel.app"
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          />
        </div>

        <div className="border-t border-deepViolet/10 pt-3">
          <p className="text-xs font-bold text-deepViolet mb-1.5">
            Corrector ortográfico (LanguageTool)
          </p>
          <p className="text-xs text-slate-500 mb-2">
            Si tienes una cuenta Premium de LanguageTool, configúrala aquí para que el botón
            "Revisar ortografía" de los formularios la use (más reglas y sin el límite de la API
            gratuita). Si la dejas vacía, se usa la API pública gratuita.
          </p>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Usuario (correo) de LanguageTool</label>
          <input
            value={ltUsername}
            onChange={(e) => setLtUsername(e.target.value)}
            placeholder="tu-correo@ejemplo.com"
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-2"
          />
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Clave de la API de LanguageTool actual:{' '}
            <span className="font-mono">{settings.languagetool_api_key || 'no configurada'}</span>
          </label>
          <input
            type="password"
            value={ltApiKey}
            onChange={(e) => setLtApiKey(e.target.value)}
            placeholder="Nueva clave (dejar vacío para no cambiar)"
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          />

          <label className="block text-xs font-semibold text-slate-500 mb-1 mt-3">
            Revisión ortográfica al enviar a la siguiente etapa
          </label>
          <p className="text-xs text-slate-500 mb-1.5">
            Solo aplica si hay una cuenta de LanguageTool configurada arriba (si no, esta opción
            no tiene efecto).
          </p>
          <select
            value={spellMode}
            onChange={(e) => setSpellMode(e.target.value)}
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm"
          >
            <option value="off">Desactivada (no revisa al enviar)</option>
            <option value="warn">Advertir, pero permitir enviar de todos modos</option>
            <option value="block">Bloquear el envío hasta revisar los campos señalados</option>
          </select>
        </div>

        <div className="border-t border-deepViolet/10 pt-3">
          <p className="text-xs font-bold text-deepViolet mb-1.5">
            Cuenta de Google (vaciamiento real en Drive)
          </p>
          <p className="text-xs text-slate-500 mb-2">
            Pega aquí el <span className="font-mono">Client ID</span> y el{' '}
            <span className="font-mono">Client Secret</span> del OAuth Client (tipo "Aplicación
            web") que creaste en Google Cloud, guarda, y luego usa "Conectar cuenta de Google" para
            autorizar con tu cuenta real. Si no conectas ninguna cuenta, "Vaciar" sigue funcionando
            en modo simulado.
          </p>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Client ID</label>
          <input
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.target.value)}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-2 font-mono"
          />
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Client Secret actual:{' '}
            <span className="font-mono">{settings.google_oauth_client_secret || 'no configurado'}</span>
          </label>
          <input
            type="password"
            value={googleClientSecret}
            onChange={(e) => setGoogleClientSecret(e.target.value)}
            placeholder="Nuevo Client Secret (dejar vacío para no cambiar)"
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-3"
          />

          <div className="flex items-center gap-3 flex-wrap">
            {settings.google_oauth_connected_email ? (
              <>
                <span className="text-xs text-emerald-600">
                  ✓ Conectado como <span className="font-mono">{settings.google_oauth_connected_email}</span>
                </span>
                <button
                  type="button"
                  onClick={connectGoogle}
                  disabled={connecting}
                  className="text-xs font-semibold text-deepViolet hover:underline disabled:opacity-50"
                >
                  Reconectar
                </button>
                <button
                  type="button"
                  onClick={disconnectGoogle}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Desconectar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={connectGoogle}
                disabled={connecting}
                className="px-3 py-1.5 rounded-lg bg-deepViolet text-white text-xs font-semibold disabled:opacity-50"
              >
                {connecting ? 'Esperando autorización...' : '🔗 Conectar cuenta de Google'}
              </button>
            )}
          </div>

          {googleMessage && (
            <p className={`mt-2 text-xs ${googleMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
              {googleMessage.text}
            </p>
          )}
        </div>

        <div className="border-t border-deepViolet/10 pt-3">
          <p className="text-xs font-bold text-deepViolet mb-1.5">Notificaciones por correo</p>
          <p className="text-xs text-slate-500 mb-2">
            Correo enviado cuando mencionan a alguien en un comentario, responden un hilo, o asignan una
            tarea. Cada usuario puede apagarlo desde "Mi cuenta".
          </p>

          <label className="block text-xs font-semibold text-slate-500 mb-1">Proveedor</label>
          <select
            value={emailProvider}
            onChange={(e) => setEmailProvider(e.target.value)}
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-3"
          >
            <option value="gmail_smtp">Gmail SMTP</option>
            <option value="resend">Resend</option>
          </select>

          {emailProvider === 'gmail_smtp' ? (
            <>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Cuenta de Gmail</label>
              <input
                value={emailGmailUser}
                onChange={(e) => setEmailGmailUser(e.target.value)}
                placeholder="methodya.app@gmail.com"
                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-2"
              />
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Contraseña de aplicación actual:{' '}
                <span className="font-mono">{settings.email_gmail_app_password || 'no configurada'}</span>
              </label>
              <input
                type="password"
                value={emailGmailAppPassword}
                onChange={(e) => setEmailGmailAppPassword(e.target.value)}
                placeholder="Nueva contraseña de aplicación (dejar vacío para no cambiar)"
                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-3"
              />
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                API key de Resend actual:{' '}
                <span className="font-mono">{settings.email_resend_api_key || 'no configurada'}</span>
              </label>
              <input
                type="password"
                value={emailResendApiKey}
                onChange={(e) => setEmailResendApiKey(e.target.value)}
                placeholder="Nueva API key (dejar vacío para no cambiar)"
                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-3"
              />
              <label className="block text-xs font-semibold text-slate-500 mb-1">Correo remitente</label>
              <input
                value={emailFromAddress}
                onChange={(e) => setEmailFromAddress(e.target.value)}
                placeholder="notificaciones@tudominio.com"
                className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-3"
              />
            </>
          )}

          <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre del remitente</label>
          <input
            value={emailFromName}
            onChange={(e) => setEmailFromName(e.target.value)}
            placeholder="METHODYA"
            className="w-full border border-deepViolet/20 rounded-lg p-2 text-sm mb-3"
          />

          <button
            type="button"
            onClick={sendTestEmail}
            disabled={testingEmail}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-deepViolet text-white disabled:opacity-50"
          >
            {testingEmail ? 'Enviando...' : 'Enviar correo de prueba'}
          </button>
          {testEmailMessage && (
            <p className={`mt-2 text-xs ${testEmailMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
              {testEmailMessage.text}
            </p>
          )}
        </div>

        {savedAt && <p className="text-xs text-emerald-600">Guardado correctamente ✓</p>}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-cognitiveTeal text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
