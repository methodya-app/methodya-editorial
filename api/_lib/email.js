import nodemailer from 'nodemailer';
import { supabaseAdmin } from './supabaseAdmin.js';

async function getEmailSettings() {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('settings')
    .select('email_provider, email_gmail_user, email_gmail_app_password, email_resend_api_key, email_from_name, email_from_address')
    .eq('id', 1)
    .single();
  return data || {};
}

// No se cachea el transporte: igual que resolveGeminiKey() en gemini.js, se
// lee la configuración vigente en cada envío, para que un cambio de
// credenciales en Parámetros aplique de inmediato sin esperar una
// invocación fría.
function gmailTransport(user, appPassword) {
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass: appPassword } });
}

// Envía un correo con el proveedor configurado en Parámetros del servidor.
// Nunca lanza: un correo que falla no debe tumbar la acción que lo disparó
// (comentario, asignación, etc.) — se registra el error y se sigue.
// Devuelve { ok, error? }.
export async function sendEmail({ to, subject, html }) {
  try {
    const settings = await getEmailSettings();
    const fromName = settings.email_from_name || 'METHODYA';

    if (settings.email_provider === 'resend') {
      if (!settings.email_resend_api_key) return { ok: false, error: 'Falta la API key de Resend en Parámetros.' };
      if (!settings.email_from_address) return { ok: false, error: 'Falta el correo remitente de Resend en Parámetros.' };

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.email_resend_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${settings.email_from_address}>`,
          to: [to],
          subject,
          html,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        return { ok: false, error: `Resend respondió ${resp.status}: ${body.slice(0, 300)}` };
      }
      return { ok: true };
    }

    // 'gmail_smtp' (por defecto)
    if (!settings.email_gmail_user || !settings.email_gmail_app_password) {
      return { ok: false, error: 'Falta configurar la cuenta de Gmail en Parámetros.' };
    }
    await gmailTransport(settings.email_gmail_user, settings.email_gmail_app_password).sendMail({
      from: `${fromName} <${settings.email_gmail_user}>`,
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('sendEmail error:', err.message);
    return { ok: false, error: err.message };
  }
}
