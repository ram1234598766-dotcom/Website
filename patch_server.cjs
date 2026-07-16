const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/app\.use\(express\.json\(\)\);/, `app.use(express.json());

  app.post('/api/run', async (req, res) => {
    try {
        const { code, language } = req.body;
        let jsCode = code;
        if (language === 'typescript') {
             // Basic transpilation for execution (using esbuild in memory is fast and clean, but let's just use ts-node or tsx programmatically if possible)
             // We can just use esbuild or a simple child process to run tsx.
             const fs = require('fs/promises');
             const path = require('path');
             const tmpfile = path.join(process.cwd(), 'temp-' + Date.now() + '.ts');
             await fs.writeFile(tmpfile, code);
             const { exec } = require('child_process');
             exec(\`npx tsx \${tmpfile}\`, { timeout: 5000 }, (err, stdout, stderr) => {
                 fs.unlink(tmpfile).catch(()=>{});
                 res.json({ stdout: stdout || '', stderr: stderr || (err ? err.message : '') });
             });
             return;
        } else if (language === 'javascript') {
             const fs = require('fs/promises');
             const path = require('path');
             const tmpfile = path.join(process.cwd(), 'temp-' + Date.now() + '.js');
             await fs.writeFile(tmpfile, code);
             const { exec } = require('child_process');
             exec(\`node \${tmpfile}\`, { timeout: 5000 }, (err, stdout, stderr) => {
                 fs.unlink(tmpfile).catch(()=>{});
                 res.json({ stdout: stdout || '', stderr: stderr || (err ? err.message : '') });
             });
             return;
        }
        res.json({ stdout: '', stderr: 'Unsupported language for server execution' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
  });`);

fs.writeFileSync('server.ts', code);
