const fs = require('fs');
let code = fs.readFileSync('src/components/TerminalPanel.tsx', 'utf8');

code = code.replace(/term\.open\(terminalRef\.current\);\s*fitAddon\.fit\(\);/, `term.open(terminalRef.current);
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch(e) {}
    }, 10);`);

code = code.replace(/const handleResize = \(\) => \{\s*fitAddon\.fit\(\);\s*\};/, `const handleResize = () => {
      try { fitAddon.fit(); } catch(e) {}
    };`);

fs.writeFileSync('src/components/TerminalPanel.tsx', code);
