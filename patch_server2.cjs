const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const fs = require\('fs\/promises'\);\s*const path = require\('path'\);/g, `const fs = await import('fs/promises');\n             const path = await import('path');`);

code = code.replace(/const \{ exec \} = require\('child_process'\);/g, `const { exec } = await import('child_process');`);

fs.writeFileSync('server.ts', code);
