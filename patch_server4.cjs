const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/import pty from 'node-pty'; \/\/ Will fallback if missing\n/, '');
fs.writeFileSync('server.ts', code);
