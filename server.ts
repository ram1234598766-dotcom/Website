import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    let bash;
    try {
       bash = require('node-pty').spawn('bash', [], {
           name: 'xterm-color',
           cols: 80,
           rows: 24,
           cwd: process.cwd(),
           env: process.env
       });
       bash.onData((data) => socket.emit('terminal.incData', data));
       socket.on('terminal.toTerm', (data) => bash.write(data));
       socket.on('resize', (size) => bash.resize(size.cols, size.rows));
    } catch (e) {
       // Fallback to spawn
       bash = spawn('bash', ['-i'], {
           cwd: process.cwd(),
           env: process.env
       });
       bash.stdout.on('data', (data) => socket.emit('terminal.incData', data.toString()));
       bash.stderr.on('data', (data) => socket.emit('terminal.incData', data.toString()));
       socket.on('terminal.toTerm', (data) => bash.stdin.write(data));
    }

    socket.on('disconnect', () => {
      if (bash) bash.kill();
    });
  });
  const PORT = 3000;

  app.use(express.json());

  
  app.post('/api/fs/write', async (req, res) => {
    try {
        const { filename, content } = req.body;
        const fs = await import('fs/promises');
        const path = await import('path');
        const safePath = path.join(process.cwd(), filename.replace(/\.\.\//g, ''));
        await fs.writeFile(safePath, content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/run', async (req, res) => {
    try {
        const { code, language } = req.body;
        let jsCode = code;
        if (language === 'typescript') {
             // Basic transpilation for execution (using esbuild in memory is fast and clean, but let's just use ts-node or tsx programmatically if possible)
             // We can just use esbuild or a simple child process to run tsx.
             const fs = await import('fs/promises');
             const path = await import('path');
             const tmpfile = path.join(process.cwd(), 'temp-' + Date.now() + '.ts');
             await fs.writeFile(tmpfile, code);
             const { exec } = await import('child_process');
             exec(`npx tsx ${tmpfile}`, { timeout: 5000 }, (err, stdout, stderr) => {
                 fs.unlink(tmpfile).catch(()=>{});
                 res.json({ stdout: stdout || '', stderr: stderr || (err ? err.message : '') });
             });
             return;
        } else if (language === 'javascript') {
             const fs = await import('fs/promises');
             const path = await import('path');
             const tmpfile = path.join(process.cwd(), 'temp-' + Date.now() + '.js');
             await fs.writeFile(tmpfile, code);
             const { exec } = await import('child_process');
             exec(`node ${tmpfile}`, { timeout: 5000 }, (err, stdout, stderr) => {
                 fs.unlink(tmpfile).catch(()=>{});
                 res.json({ stdout: stdout || '', stderr: stderr || (err ? err.message : '') });
             });
             return;
        }
        res.json({ stdout: '', stderr: 'Unsupported language for server execution' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
  });

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
        const { prompt, messages, modelType } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
        }
        
        const ai = new GoogleGenAI({ apiKey });
        
        if (messages && Array.isArray(messages)) {
            // Chat mode
            const formattedContents = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: formattedContents,
            });
            return res.json({ text: response.text || 'No response generated.' });
        } else {
            // Simple prompt mode
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            return res.json({ text: response.text || 'No response generated.' });
        }
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
