const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(/<Editor\s+height="100%"\s+className="cloudos-scroll smooth-typing"\s+options=\{\{[\s\S]*?\}\}/, '<Editor height="100%" className="cloudos-scroll smooth-typing"');

fs.writeFileSync('src/components/CloudOS.tsx', code);
