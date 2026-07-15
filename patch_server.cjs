const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
/app\.post\('\/api\/ai\/generate', async \(req, res\) => \{/,
`// Supabase Edge Functions - Mock Auth Validation Endpoint
  app.post('/api/edge-functions/auth-sync', (req, res) => {
     const authHeader = req.headers.authorization;
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authentication token in Edge Function' });
     }
     res.json({ success: true, message: 'Server-side validation passed' });
  });

  app.post('/api/ai/generate', async (req, res) => {`
);

fs.writeFileSync('server.ts', code);
