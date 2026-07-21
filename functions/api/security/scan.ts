export async function onRequestPost() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const findings: { severity: string; message: string }[] = [];

  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    findings.push({
      severity: 'high',
      message:
        'GEMINI_API_KEY is unset or a placeholder (AI endpoints will not work).',
    });
  }

  try {
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      findings.push({
        severity: 'medium',
        message: 'Server process is running as root (uid 0).',
      });
    }
  } catch {
    // non-Node runtime; skip
  }

  const threatsFound = findings.some(
    (f) => f.severity === 'high' || f.severity === 'medium'
  );

  return Response.json({
    status: threatsFound ? 'threat' : 'secure',
    threatsFound,
    scannedAt: new Date().toISOString(),
    environment: 'cloudflare-pages',
    findings,
  });
}
