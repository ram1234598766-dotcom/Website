import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const API_ROUTES = [
  { path: '/api/health', method: 'GET', requires: [] },
  { path: '/api/ready', method: 'GET', requires: [] },
  { path: '/api/status', method: 'GET', requires: [] },
  { path: '/api/healthz', method: 'GET', requires: [] },
  { path: '/api/peers', method: 'GET', requires: [] },
  { path: '/api/services/health', method: 'GET', requires: [] },
  { path: '/api/ai/generate', method: 'POST', requires: ['ai'] },
  { path: '/api/models', method: 'GET', requires: [] },
  { path: '/api/rate-limit-check', method: 'POST', requires: [] },
  { path: '/api/plugins', method: 'GET', requires: [] },
  { path: '/api/edge-functions/auth-sync', method: 'POST', requires: ['firebase'] },
  { path: '/api/security/scan', method: 'POST', requires: ['ai'] },
  { path: '/api/git-status', method: 'GET', requires: [] },
  { path: '/api/git-diff', method: 'GET', requires: [] },
];

function loadAppVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function detectEnvironment(): string {
  const env = (process.env.NODE_ENV as string) || 'development';
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  const hasFirebase = !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  );
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasGithub = !!(process.env.GITHUB_CLIENT_ID && process.env.GH_GRANT_SECRET);

  const services = {
    editor: 'available',
    terminal: 'available',
    ai: hasGemini ? 'cloud' : 'browser',
    fileManager: 'available',
    github: hasGithub ? 'configured' : 'disabled',
    drive: hasFirebase ? 'connected' : 'disabled',
  };

  const tips = [
    hasFirebase ? null : 'Connect cloud accounts for authentication and file persistence',
    hasGemini ? null : 'Set GEMINI_API_KEY for Omni-AI cloud assistance',
    hasGithub ? null : 'Configure GitHub OAuth for repo import/push',
  ].filter(Boolean);

  const memory = process.memoryUsage();
  const overallStatus = (!hasFirebase || !hasGemini) ? 'degraded' : 'healthy';

  const routeStatus = (requires: string[]): 'ok' | 'degraded' | 'offline' => {
    for (const r of requires) {
      if (r === 'ai' && !hasGemini) return 'degraded';
      if (r === 'firebase' && !hasFirebase) return 'degraded';
    }
    return 'ok';
  };

  return NextResponse.json(
    {
      status: overallStatus,
      version: loadAppVersion(),
      nodeVersion: process.version,
      environment: detectEnvironment(),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      mode: hasFirebase ? 'connected' : 'demo',
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
      services,
      routes: API_ROUTES.map((route) => ({
        path: route.path,
        method: route.method,
        status: routeStatus(route.requires),
      })),
      tips,
      serviceHealth: {
        firebase: { status: hasFirebase ? 'healthy' : 'unhealthy', configured: hasFirebase },
        gemini: { status: hasGemini ? 'healthy' : 'unhealthy', configured: hasGemini },
        github: { status: hasGithub ? 'healthy' : 'unhealthy', configured: hasGithub },
        database: { status: hasFirebase ? 'healthy' : 'unhealthy', connected: hasFirebase },
      },
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        ...(requestId ? { 'X-Request-ID': requestId } : {}),
      },
    },
  );
}

export async function OPTIONS(request: Request): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
      'Access-Control-Max-Age': '86400',
    },
  });
}
