const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace standard express app.listen with http.createServer and socket.io
code = code.replace(/import express from 'express';/, `import express from 'express';\nimport { createServer } from 'http';\nimport { Server } from 'socket.io';\nimport pty from 'node-pty'; // Will fallback if missing\nimport { spawn } from 'child_process';`);

code = code.replace(/async function startServer\(\) \{/, `async function startServer() {\n  const app = express();\n  const httpServer = createServer(app);\n  const io = new Server(httpServer);\n\n  io.on('connection', (socket) => {\n    let bash;\n    try {\n       bash = require('node-pty').spawn('bash', [], {\n           name: 'xterm-color',\n           cols: 80,\n           rows: 24,\n           cwd: process.cwd(),\n           env: process.env\n       });\n       bash.onData((data) => socket.emit('terminal.incData', data));\n       socket.on('terminal.toTerm', (data) => bash.write(data));\n       socket.on('resize', (size) => bash.resize(size.cols, size.rows));\n    } catch (e) {\n       // Fallback to spawn\n       bash = spawn('bash', ['-i'], {\n           cwd: process.cwd(),\n           env: process.env\n       });\n       bash.stdout.on('data', (data) => socket.emit('terminal.incData', data.toString()));\n       bash.stderr.on('data', (data) => socket.emit('terminal.incData', data.toString()));\n       socket.on('terminal.toTerm', (data) => bash.stdin.write(data));\n    }\n\n    socket.on('disconnect', () => {\n      if (bash) bash.kill();\n    });\n  });`);

code = code.replace(/const app = express\(\);\n  const PORT = 3000;/, `const PORT = 3000;`);

code = code.replace(/app\.listen\(PORT, '0\.0\.0\.0', \(\) => \{/, `httpServer.listen(PORT, '0.0.0.0', () => {`);

fs.writeFileSync('server.ts', code);
