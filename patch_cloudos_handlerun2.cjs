const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const newHandleRun = `  const handleRun = async () => {
    setIsTerminalOpen(true);
    setTerminalOutput(prev => prev + 'Compiling...\\n');
    
    const file = files.find(f => f.id === activeFileId);
    if (!file) {
       setTerminalOutput(prev => prev + 'Error: No active file to run.\\n$ ');
       return;
    }
    
    setTerminalOutput(prev => prev + \`> node \${file.name}\\n\\n\`);
    
    if (file.language === 'javascript' || file.language === 'typescript') {
        try {
            const response = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: file.content, language: file.language })
            });
            const data = await response.json();
            let out = '';
            if (data.stdout) out += data.stdout + '\\n';
            if (data.stderr) out += '[ERROR] ' + data.stderr + '\\n';
            if (data.error) out += '[SERVER ERROR] ' + data.error + '\\n';
            
            setTerminalOutput(prev => prev + out + '\\n[Process completed]\\n$ ');
        } catch (err: any) {
            setTerminalOutput(prev => prev + 'Error communicating with server: ' + err.message + '\\n\\n[Process completed]\\n$ ');
        }
    } else {
       setTerminalOutput(prev => prev + \`Cannot run files of type \${file.language} natively in browser sandbox.\\n\\n[Process completed]\\n$ \`);
    }
  };`;

// Replace from `  const handleRun = () => {` up to `  };` before `  const [dirtyTabs`
const startIdx = code.indexOf('  const handleRun = () => {');
const endIdx = code.indexOf('  const [dirtyTabs', startIdx);
if (startIdx !== -1 && endIdx !== -1) {
   code = code.substring(0, startIdx) + newHandleRun + '\n\n' + code.substring(endIdx);
   fs.writeFileSync('src/components/CloudOS.tsx', code);
   console.log('Patched handleRun');
} else {
   console.log('Could not find bounds');
}
