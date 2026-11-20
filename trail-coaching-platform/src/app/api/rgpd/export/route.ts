import { NextResponse } from 'next/server';
import { z } from 'zod';

const rgpdExportSchema = z.object({
  user: z.record(z.unknown()).nullable(),
  athleteProfile: z.record(z.unknown()).nullable(),
  intervalsConnection: z.record(z.unknown()).nullable().optional(),
  intervalsSnapshots: z.array(z.record(z.unknown())).default([]),
  checkIns: z.array(z.record(z.unknown())).default([]),
  roadbooks: z.array(z.record(z.unknown())).default([]),
  orders: z.array(z.record(z.unknown())).default([]),
  entitlements: z.array(z.record(z.unknown())).default([]),
  chatMessages: z.array(z.record(z.unknown())).default([]),
});

/**
 * Route de portabilité RGPD (Article 20) — Exporte les données personnelles de l'utilisateur
 * en excluant tout champ secret ou chiffré interne (`secretEncrypted`).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = rgpdExportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload invalide pour export RGPD.' },
        { status: 400 }
      );
    }

    const { intervalsConnection, ...rest } = parsed.data;
    const sanitizedConnection = intervalsConnection
      ? Object.fromEntries(
          Object.entries(intervalsConnection).filter(([k]) => k !== 'secretEncrypted')
        )
      : null;

    const exportBundle = {
      rgpdExportMetadata: {
        exportedAt: new Date().toISOString(),
        regulation: 'RGPD Article 20 - Droit à la portabilité des données',
        platform: 'myKairn Coach',
      },
      ...rest,
      intervalsConnection: sanitizedConnection,
    };

    return new NextResponse(JSON.stringify(exportBundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mykairn-donnees-personnelles-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'export RGPD.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
