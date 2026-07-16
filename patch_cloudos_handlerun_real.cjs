const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const newHandleRun = `const handleRun = async () => {
    setIsTerminalOpen(true);
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;
    
    try {
        // Save to real disk for execution
        await fetch('/api/fs/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content: file.content })
        });

        // Send to integrated terminal
        let cmd = '';
        if (file.language === 'javascript') {
            cmd = \`node "\${file.name}"\\n\`;
        } else if (file.language === 'typescript') {
            cmd = \`npx tsx "\${file.name}"\\n\`;
        } else if (file.language === 'python') {
            cmd = \`python3 "\${file.name}"\\n\`;
        } else {
            cmd = \`echo "File saved. Execute manually."\\n\`;
        }
        window.dispatchEvent(new CustomEvent('terminal-send', { detail: cmd }));
    } catch (err) {
        console.error("Failed to run", err);
    }
  };`;

code = code.replace(/const handleRun = \(\) => \{[\s\S]*?window\.dispatchEvent\(new CustomEvent\('terminal-send', \{ detail: cmd \}\)\);\s*\};/m, newHandleRun);

fs.writeFileSync('src/components/CloudOS.tsx', code);
