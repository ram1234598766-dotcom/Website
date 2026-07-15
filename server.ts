import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Backend Security Software Endpoint
  app.post('/api/security/scan', (req, res) => {
    const { payload } = req.body;
    let threatsFound = false;
    
    if (typeof payload === 'string') {
        const lower = payload.toLowerCase();
        // Basic signature-based threat detection
        if (lower.includes('drop table') || lower.includes('<script>') || lower.includes('alert(') || lower.includes('exec(')) {
            threatsFound = true;
        }
    }
    
    res.json({ threatsFound, status: threatsFound ? 'Quarantined' : 'Clean', timestamp: new Date().toISOString() });
  });
  
  // Gemini Proxy Endpoint for AI features
  // Supabase Edge Functions - Mock Auth Validation Endpoint
  app.post('/api/edge-functions/auth-sync', (req, res) => {
     const authHeader = req.headers.authorization;
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authentication token in Edge Function' });
     }
     res.json({ success: true, message: 'Server-side validation passed' });
  });

  app.post('/api/ai/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
        res.json({ text });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
