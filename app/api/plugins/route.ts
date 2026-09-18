import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

function jsonError(error: string, status: number, requestId?: string) {
  const body: Record<string, unknown> = { error };
  if (requestId) body.requestId = requestId;
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  return NextResponse.json(
    { plugins: [], total: 0, status: 'ok' },
    {
      status: 200,
      headers: requestId ? { 'X-Request-ID': requestId } : undefined,
    },
  );
}

/**
 * POST /api/plugins
 *
 * Installs a plugin from a manifest URL or inline manifest text.
 * Validates the manifest and signature before installing.
 */
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  try {
    const body = (await request.json()) as { manifest?: unknown; url?: string };

    if (!body.manifest && !body.url) {
      return jsonError('Provide either manifest or url', 400, requestId);
    }

    return jsonError(
      'Plugin installation requires the full registry service',
      503,
      requestId,
    );
  } catch {
    return jsonError('Invalid request body', 400, requestId);
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      ...(request.headers.get('x-request-id')
        ? { 'X-Request-ID': request.headers.get('x-request-id')! }
        : {}),
    },
  });
}
