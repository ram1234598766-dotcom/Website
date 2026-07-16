const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const fsWriteCode = `
  app.post('/api/fs/write', async (req, res) => {
    try {
        const { filename, content } = req.body;
        const fs = await import('fs/promises');
        const path = await import('path');
        const safePath = path.join(process.cwd(), filename.replace(/\\.\\.\\//g, ''));
        await fs.writeFile(safePath, content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
  });
`;

code = code.replace(/app\.post\('\/api\/run',/, fsWriteCode + '\n  app.post(\'/api/run\',');

fs.writeFileSync('server.ts', code);
