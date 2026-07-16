const fs = require('fs');
let code = fs.readFileSync('src/components/GlobalHelperBot.tsx', 'utf8');

code = code.replace(/navigating the zero-cost decentralized mesh, setting up quantum-secure configurations/g, 'setting up secure configurations');
code = code.replace(/the Global Mesh to review your secure node deployment/g, 'the Global Forum to discuss with other users');

fs.writeFileSync('src/components/GlobalHelperBot.tsx', code);
