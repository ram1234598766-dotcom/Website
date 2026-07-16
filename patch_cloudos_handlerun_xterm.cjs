const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(/const handleRun = async \(\) => \{[\s\S]*?\[Process completed\]\\n\$ `\);\s*\}\s*\};/m, `const handleRun = () => {
    setIsTerminalOpen(true);
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;
    
    // Instead of using /api/run, we can just send the run command to the xterm via a global event
    // since the terminal is connected to a real bash session.
    let cmd = '';
    if (file.language === 'javascript') {
        cmd = \`node "\${file.name}"\\n\`;
    } else if (file.language === 'typescript') {
        cmd = \`npx tsx "\${file.name}"\\n\`;
    } else if (file.language === 'python') {
        cmd = \`python3 "\${file.name}"\\n\`;
    } else {
        cmd = \`echo "Cannot run \${file.language} files directly"\\n\`;
    }
    window.dispatchEvent(new CustomEvent('terminal-send', { detail: cmd }));
  };`);

fs.writeFileSync('src/components/CloudOS.tsx', code);
