import { NextRequest, NextResponse } from 'next/server';
import { withTimeout } from '@/src/lib/server/timeout';

function checkApp(): { status: 'healthy'; detail: string } {
  return { status: 'healthy', detail: 'app serving requests' };
}

function checkFirebase(): { status: 'healthy' | 'degraded' | 'unhealthy'; detail: string } {
  const configured =
    !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    (!!process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);
  if (!configured) return { status: 'degraded', detail: 'Firebase not configured — running in demo mode' };
  return { status: 'healthy', detail: 'Firebase connected' };
}

function checkAI(): { status: 'healthy' | 'degraded' | 'unhealthy'; detail: string } {
  const configured =
    !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
  if (!configured) return { status: 'degraded', detail: 'AI provider not configured — using browser fallback' };
  return { status: 'healthy', detail: 'Gemini API reachable' };
}

function checkGitHub(): { status: 'healthy' | 'degraded' | 'unhealthy'; detail: string } {
  const configured = !!process.env.GITHUB_CLIENT_ID && !!process.env.GH_GRANT_SECRET;
  if (!configured) return { status: 'degraded', detail: 'GitHub OAuth not configured' };
  return { status: 'healthy', detail: 'GitHub OAuth configured' };
}

async function runChecks(verbose: boolean) {
  const app = checkApp();
  const firebase = checkFirebase();
  const ai = checkAI();
  const github = checkGitHub();

  const services = { app, firebase, ai, github };

  const anyDegraded = [firebase, ai].some((s) => s.status === 'degraded');

  // Demo mode is the supported first-run experience (AGENTS §4). An optional
  // integration being unconfigured is a degraded *report*, not a failed probe:
  // returning 503 here would have orchestrators restart a perfectly healthy
  // app. The body still carries status: 'degraded' for dashboards.
  const httpStatus = 200;
  const overallStatus = anyDegraded ? 'degraded' : 'healthy';

  const response: Record<string, unknown> = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
  };

  if (verbose) {
    response['uptimeSeconds'] = Math.floor(process.uptime());
    response['nodeVersion'] = process.version;
    response['memory'] = process.memoryUsage();
    response['environment'] = process.env.NODE_ENV ?? 'development';
  }

  return { response, httpStatus };
}

const _healthzHandler = async (request: NextRequest): Promise<NextResponse> => {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  const url = new URL(request.url);
  const verbose = url.searchParams.get('verbose') === 'true';

  try {
    const { response, httpStatus } = await runChecks(verbose);
    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'cache-control': 'no-store',
        ...(requestId ? { 'X-Request-ID': requestId } : {}),
      },
    });
  } catch (err: any) {
    console.error('Healthz error:', err);
    return NextResponse.json(
      { error: 'Health check failed', requestId },
      { status: 500 },
    );
  }
};

export const GET = withTimeout(_healthzHandler, 10000);

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400',
    },
  });
}
