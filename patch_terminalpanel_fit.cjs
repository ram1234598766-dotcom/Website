const fs = require('fs');
let code = fs.readFileSync('src/components/TerminalPanel.tsx', 'utf8');

code = code.replace(/const handleResize = \(\) => \{[\s\S]*?try \{ fitAddon\.fit\(\); \} catch\(e\) \{\}[\s\S]*?\};/, `const handleResize = () => {
      if (!term.element || !term.element.parentElement) return;
      try { 
        // Only fit if dimensions are present and terminal is visible
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
            fitAddon.fit(); 
        }
      } catch(e) {}
    };`);

code = code.replace(/setTimeout\(\(\) => \{[\s\S]*?try \{[\s\S]*?fitAddon\.fit\(\);[\s\S]*?\} catch\(e\) \{\}[\s\S]*?\}, 10\);/, `setTimeout(() => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
            fitAddon.fit();
        }
      } catch(e) {}
    }, 50);`);

fs.writeFileSync('src/components/TerminalPanel.tsx', code);
