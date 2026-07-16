const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Remove showDiagnostics
code = code.replace(/const \[showDiagnostics, setShowDiagnostics\] = useState\(false\);\n/, '');

// Remove isCreating
code = code.replace(/const \[isCreating, setIsCreating\] = useState\(false\);\n/, '');

fs.writeFileSync('src/components/CloudOS.tsx', code);
