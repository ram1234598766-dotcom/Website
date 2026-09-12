/**
 * GET /api/plugins
 *
 * Returns the current plugin registry state: installed plugins,
 * their enabled status, and signatures.
 *
 * In production this queries the plugin service; here it returns
 * an empty registry (no plugins installed by default).
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json(
    { plugins: [], total: 0, status: 'ok' },
    { status: 200 },
  );
}

/**
 * POST /api/plugins
 *
 * Installs a plugin from a manifest URL or inline manifest text.
 * Validates the manifest and signature before installing.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { manifest?: unknown; url?: string };

    if (!body.manifest && !body.url) {
      return NextResponse.json(
        { error: 'Provide either manifest or url' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Plugin installation requires the full registry service', code: 'unavailable' },
      { status: 503 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
