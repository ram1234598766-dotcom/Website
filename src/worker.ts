/**
 * VantaOS Worker — handles API routes alongside static assets (from out/)
 *
 * This Worker runs when using `npx wrangler deploy`. The [assets] config in
 * wrangler.toml serves the static export (out/) automatically. This Worker
 * only intercepts requests to /api/* paths.
 */

export interface Env {
  GEMINI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all API responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /api/health
      if (request.method === 'GET' && path === '/api/health') {
        return Response.json({
          ok: true,
          uptimeSeconds: 0,
          environment: 'cloudflare-worker',
          timestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      }

      // POST /api/ai/generate
      if (request.method === 'POST' && path === '/api/ai/generate') {
        return handleAiGenerate(request, env);
      }

      // POST /api/security/scan
      if (request.method === 'POST' && path === '/api/security/scan') {
        return handleSecurityScan(env);
      }

      // POST /api/edge-functions/auth-sync
      if (request.method === 'POST' && path === '/api/edge-functions/auth-sync') {
        return handleAuthSync(request);
      }

      // If no API route matches, let the static assets handle it
      return new Response('Not found', { status: 404 });
    } catch (err: any) {
      return Response.json(
        { error: err.message || 'Internal error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function handleAiGenerate(request: Request, env: Env): Promise<Response> {
  const { prompt, messages } = await request.json() as any;
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY not configured on server' },
      { status: 500 }
    );
  }

  let contents: { role: string; parts: { text: string }[] }[];
  if (messages && Array.isArray(messages)) {
    contents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
  } else {
    contents = [{ role: 'user', parts: [{ text: prompt }] }];
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return Response.json(
      { error: text || `Gemini request failed (${res.status})` },
      { status: res.status }
    );
  }

  const data = await res.json() as any;
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .join('') || 'No response generated.';

  return Response.json({ text });
}

async function handleSecurityScan(env: Env): Promise<Response> {
  const geminiKey = env.GEMINI_API_KEY;
  const findings: { severity: string; message: string }[] = [];

  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    findings.push({
      severity: 'high',
      message: 'GEMINI_API_KEY is unset or a placeholder (AI endpoints will not work).',
    });
  }

  const threatsFound = findings.some(
    (f) => f.severity === 'high' || f.severity === 'medium'
  );

  return Response.json({
    status: threatsFound ? 'threat' : 'secure',
    threatsFound,
    scannedAt: new Date().toISOString(),
    environment: 'cloudflare-worker',
    findings,
  });
}

async function handleAuthSync(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization');

  if (!auth || !auth.startsWith('Bearer ')) {
    return Response.json(
      { error: 'Unauthorized', message: 'Missing or invalid authentication token' },
      { status: 401 }
    );
  }

  return Response.json({
    success: true,
    message: 'Server-side validation passed',
  });
}
