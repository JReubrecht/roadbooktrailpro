import { getConfiguredAdminEmails } from '@/lib/auth/serverAuth';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface EmailSendResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

async function sendResendEmail(params: {
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const coachEmail = (
    process.env.COACH_NOTIFICATION_EMAIL?.trim() ||
    getConfiguredAdminEmails()[0] ||
    ''
  ).trim();
  const fromEmail = (
    process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev'
  ).trim();

  if (!apiKey || !coachEmail) {
    console.info(
      `[MyKairn Email] Notification ignorée (RESEND_API_KEY ou COACH_NOTIFICATION_EMAIL absent) : ${params.subject}`
    );
    return { sent: false, skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [coachEmail],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error(`[MyKairn Email] Erreur Resend (${res.status}):`, bodyText);
      return { sent: false, error: `HTTP ${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur réseau Resend';
    console.error('[MyKairn Email] Exception envoi Resend:', message);
    return { sent: false, error: message };
  }
}

export async function notifyCoachNewInquiry(inquiry: {
  id: string;
  fullName: string;
  email: string;
  targetRace?: string;
  targetDate?: string;
  goalType: string;
  message: string;
}): Promise<EmailSendResult> {
  const raceLabel = inquiry.targetRace ? `${inquiry.targetRace}` : 'Non précisée';
  const dateLabel = inquiry.targetDate ? ` (${inquiry.targetDate})` : '';
  const subject = `[MyKairn] Nouvelle demande (${inquiry.goalType}) — ${inquiry.fullName}`;

  const html = `
    <div style="font-family: Inter, system-ui, sans-serif; color: #0F172A; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Nouvelle demande entrante</h2>
      <p><strong>Athlète :</strong> ${escapeHtml(inquiry.fullName)} (${escapeHtml(inquiry.email)})</p>
      <p><strong>Objectif :</strong> ${escapeHtml(inquiry.goalType)}</p>
      <p><strong>Course cible :</strong> ${escapeHtml(raceLabel + dateLabel)}</p>
      <p><strong>Référence :</strong> <code>${escapeHtml(inquiry.id)}</code></p>
      <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
      <p style="white-space: pre-wrap;">${escapeHtml(inquiry.message)}</p>
    </div>
  `;

  const text = [
    `Nouvelle demande entrante (${inquiry.goalType})`,
    `Athlète : ${inquiry.fullName} <${inquiry.email}>`,
    `Course cible : ${raceLabel}${dateLabel}`,
    `Réf : ${inquiry.id}`,
    '',
    inquiry.message,
  ].join('\n');

  return sendResendEmail({
    subject,
    html,
    text,
    replyTo: inquiry.email,
  });
}

export async function notifyCoachPainAlert(params: {
  athleteName: string;
  athleteEmail?: string;
  painNotes?: string;
  fatigueScore: number;
  rpe: number;
  dateIso: string;
}): Promise<EmailSendResult> {
  const subject = `[MyKairn ALERTE DOULEUR] ${params.athleteName} — ${params.dateIso}`;

  const html = `
    <div style="font-family: Inter, system-ui, sans-serif; color: #0F172A; line-height: 1.6;">
      <h2 style="margin: 0 0 12px; color: #FF5A36;">Alerte Douleur athlète</h2>
      <p><strong>Athlète :</strong> ${escapeHtml(params.athleteName)}${
        params.athleteEmail ? ` (${escapeHtml(params.athleteEmail)})` : ''
      }</p>
      <p><strong>Date check-in :</strong> ${escapeHtml(params.dateIso)}</p>
      <p><strong>Fatigue :</strong> ${params.fatigueScore}/10 · <strong>RPE :</strong> ${params.rpe}/10</p>
      <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
      <p><strong>Détail signalé :</strong> ${escapeHtml(
        params.painNotes || 'Douleur signalée sans précision.'
      )}</p>
    </div>
  `;

  const text = [
    `ALERTE DOULEUR — ${params.athleteName}`,
    `Date : ${params.dateIso} | Fatigue : ${params.fatigueScore}/10 | RPE : ${params.rpe}/10`,
    `Notes : ${params.painNotes || 'Douleur signalée sans précision.'}`,
  ].join('\n');

  return sendResendEmail({
    subject,
    html,
    text,
    replyTo: params.athleteEmail,
  });
}
