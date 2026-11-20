import { getConfiguredAdminEmails } from '@/lib/auth/serverAuth';
import type { CoachingInquiry } from '@/types/domain';

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

export async function notifyCoachNewInquiry(
  inquiry: CoachingInquiry
): Promise<EmailSendResult> {
  const offerLabels: Record<CoachingInquiry['offerInterest'], string> = {
    coaching_1to1: 'Coaching Individuel 1-to-1',
    race_audit: 'Pack Stratégie Jour J & Roadbook (89 €)',
    training_plan: 'Programme Trail Autonome',
  };
  const offerLabel = offerLabels[inquiry.offerInterest] || inquiry.offerInterest;
  const subject = `[MyKairn] Nouvelle demande (${offerLabel}) — ${inquiry.name}`;

  const html = `
    <div style="font-family: Inter, system-ui, sans-serif; color: #0F172A; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">Nouvelle demande entrante</h2>
      <p><strong>Athlète :</strong> ${escapeHtml(inquiry.name)} (${escapeHtml(inquiry.email)})</p>
      <p><strong>Offre ciblée :</strong> ${escapeHtml(offerLabel)}</p>
      ${
        inquiry.weeklyHours
          ? `<p><strong>Disponibilité :</strong> ${inquiry.weeklyHours} h/semaine</p>`
          : ''
      }
      <p><strong>Référence :</strong> <code>${escapeHtml(inquiry.id)}</code></p>
      <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
      <p style="white-space: pre-wrap;">${escapeHtml(inquiry.goal)}</p>
    </div>
  `;

  const text = [
    `Nouvelle demande entrante (${offerLabel})`,
    `Athlète : ${inquiry.name} <${inquiry.email}>`,
    inquiry.weeklyHours ? `Volume hebdo dispo : ${inquiry.weeklyHours}h` : '',
    `Réf : ${inquiry.id}`,
    '',
    inquiry.goal,
  ]
    .filter(Boolean)
    .join('\n');

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
  sensitiveArea?: string;
  comment?: string;
  fatigueLevel?: number;
  rpe?: number;
  checkInDate: string;
}): Promise<EmailSendResult> {
  const subject = `[MyKairn ALERTE DOULEUR] ${params.athleteName} — ${params.checkInDate}`;

  const html = `
    <div style="font-family: Inter, system-ui, sans-serif; color: #0F172A; line-height: 1.6;">
      <h2 style="margin: 0 0 12px; color: #FF5A36;">Alerte Douleur athlète</h2>
      <p><strong>Athlète :</strong> ${escapeHtml(params.athleteName)}${
        params.athleteEmail ? ` (${escapeHtml(params.athleteEmail)})` : ''
      }</p>
      <p><strong>Date check-in :</strong> ${escapeHtml(params.checkInDate)}</p>
      <p><strong>Fatigue :</strong> ${params.fatigueLevel ?? 'N/A'}/5 · <strong>RPE :</strong> ${
        params.rpe ?? 'N/A'
      }/10</p>
      ${
        params.sensitiveArea
          ? `<p><strong>Zone sensible :</strong> ${escapeHtml(params.sensitiveArea)}</p>`
          : ''
      }
      <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 16px 0;" />
      <p><strong>Commentaire :</strong> ${escapeHtml(
        params.comment || 'Douleur signalée sans commentaire.'
      )}</p>
    </div>
  `;

  const text = [
    `ALERTE DOULEUR — ${params.athleteName}`,
    `Date : ${params.checkInDate} | Fatigue : ${params.fatigueLevel ?? 'N/A'}/5 | RPE : ${params.rpe ?? 'N/A'}/10`,
    params.sensitiveArea ? `Zone : ${params.sensitiveArea}` : '',
    `Commentaire : ${params.comment || 'Douleur signalée sans commentaire.'}`,
  ]
    .filter(Boolean)
    .join('\n');

  return sendResendEmail({
    subject,
    html,
    text,
    replyTo: params.athleteEmail,
  });
}
