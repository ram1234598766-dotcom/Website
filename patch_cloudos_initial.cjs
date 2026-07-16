const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Remove initialPluginSearch from interface
code = code.replace(/interface CloudOSProps \{\n\s*initialPluginSearch\?: string;\n\}/g, '');
code = code.replace(/interface CloudOSProps \{\s*\}/g, ''); // just in case

// Remove CloudOS({ initialPluginSearch }: CloudOSProps)
code = code.replace(/export default function CloudOS\(\{ initialPluginSearch \}: CloudOSProps\) \{/g, 'export default function CloudOS() {');
code = code.replace(/export default function CloudOS\(\{\s*\}\: CloudOSProps\) \{/g, 'export default function CloudOS() {');

// Remove CloudOS({}: CloudOSProps)
code = code.replace(/export default function CloudOS\(.*\) \{/g, 'export default function CloudOS() {');

fs.writeFileSync('src/components/CloudOS.tsx', code);
