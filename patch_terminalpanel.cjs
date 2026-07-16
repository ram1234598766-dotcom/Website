const fs = require('fs');
let code = fs.readFileSync('src/components/TerminalPanel.tsx', 'utf8');

code = code.replace(/term\.onResize\(\(size\) => \{/, `
    const handleTerminalSend = (e: any) => {
       if (socketRef.current && e.detail) {
           socketRef.current.emit('terminal.toTerm', e.detail);
       }
    };
    window.addEventListener('terminal-send', handleTerminalSend);

    term.onResize((size) => {`);

code = code.replace(/window\.removeEventListener\('resize', handleResize\);/, `window.removeEventListener('resize', handleResize);\n      window.removeEventListener('terminal-send', handleTerminalSend);`);

fs.writeFileSync('src/components/TerminalPanel.tsx', code);
