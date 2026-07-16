const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Remove isRunning state
code = code.replace(/const \[isRunning, setIsRunning\] = useState\(false\);\n?/g, '');
code = code.replace(/const \[compileProgress, setCompileProgress\] = useState\(0\);\n?/g, '');
code = code.replace(/const \[stdinValue, setStdinValue\] = useState\(''\);\n?/g, '');

// Remove handleRun
code = code.replace(/const handleRun = async \(\) => \{[\s\S]*?\n  \};\n/g, '');

// Remove Compile & Run button
const compileBtnRegex = /<button[^>]*onClick=\{handleRun\}[^>]*>[\s\S]*?<\/button>\n/g;
code = code.replace(compileBtnRegex, '');

fs.writeFileSync('src/components/CloudOS.tsx', code);
