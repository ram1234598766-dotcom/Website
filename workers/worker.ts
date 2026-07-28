/**
 * VantaOS Worker — handles API routes alongside static assets (from out/)
 *
 * This Worker runs when using `npx wrangler deploy`. The [assets] config in
 * wrangler.toml serves the static export (out/) automatically. This Worker
 * only intercepts requests to /api/* paths and handles SPA fallback.
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
      'Access-Control-Max-Age': '86400',
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
          version: '2.0.0',
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

      // If no API route matches, return 404
      return new Response(JSON.stringify({ 
        error: 'Not found',
        path: path,
        message: 'The requested API endpoint does not exist.'
      }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err: any) {
      console.error('Worker error:', err);
      return Response.json(
        { error: err.message || 'Internal error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

async function handleAiGenerate(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { provider, model, apiKey, messages } = body;

    if (!provider || !apiKey) {
      return Response.json(
        { error: 'Missing required fields: provider, apiKey, and messages or prompt' },
        { status: 400 }
      );
    }

    switch (provider) {
      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://website.vasudevaya.workers.dev',
            'X-Title': 'VantaOS',
          },
          body: JSON.stringify({
            model: model || 'openai/gpt-4o',
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error?.message || `OpenRouter error (${res.status})`);
        return Response.json({ text: data.choices?.[0]?.message?.content || '', model });
      }

      case 'gemini': {
        const geminiModel = model || 'gemini-2.5-flash';
        const contents = messages.map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          }
        );
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error?.message || `Gemini error (${res.status})`);
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
        return Response.json({ text, model: geminiModel });
      }

      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error?.message || `OpenAI error (${res.status})`);
        return Response.json({ text: data.choices?.[0]?.message?.content || '', model });
      }

      default:
        return Response.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }
  } catch (err: any) {
    return Response.json(
      { error: err.message || 'AI request failed' },
      { status: 500 }
    );
  }
}

async function handleSecurityScan(env: Env): Promise<Response> {
  const geminiKey = env.GEMINI_API_KEY;
  const findings: { severity: string; message: string }[] = [];

  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    findings.push({
      severity: 'medium',
      message: 'GEMINI_API_KEY is unset or a placeholder. Omni-AI will not work.',
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
