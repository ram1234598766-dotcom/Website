const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(/const \[showOutput, setShowOutput\] = useState\(false\);\n?/g, '');
code = code.replace(/const \[outputHtml, setOutputHtml\] = useState\(''\);\n?/g, '');
code = code.replace(/const \[terminalOutput, setTerminalOutput\] = useState\(''\);\n?/g, '');

fs.writeFileSync('src/components/CloudOS.tsx', code);
