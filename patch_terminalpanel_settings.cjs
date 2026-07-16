const fs = require('fs');
let code = fs.readFileSync('src/components/TerminalPanel.tsx', 'utf8');

code = code.replace(/export default function TerminalPanel\(\) \{/, `export type TerminalTheme = 'dark' | 'light' | 'dracula' | 'monokai' | 'ubuntu';

interface TerminalPanelProps {
  fontSize?: number;
  theme?: TerminalTheme;
}

const THEMES = {
  dark: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff' },
  light: { background: '#ffffff', foreground: '#333333', cursor: '#000000', selectionBackground: '#add6ff' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f0' },
  monokai: { background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0' },
  ubuntu: { background: '#300a24', foreground: '#eeeeee', cursor: '#bbbbbb' }
};

export default function TerminalPanel({ fontSize = 13, theme = 'dark' }: TerminalPanelProps) {`);

code = code.replace(/const term = new Terminal\(\{[\s\S]*?theme: \{[\s\S]*?background: '#1e1e1e',[\s\S]*?\},[\s\S]*?fontSize: 13,[\s\S]*?\}\);/, `const term = new Terminal({
      theme: THEMES[theme] || THEMES.dark,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize,
      cursorBlink: true,
    });`);

const useEffectEndRegex = /return \(\) => \{\n\s*socket\.disconnect\(\);\n\s*term\.dispose\(\);\n\s*window\.removeEventListener\('resize', handleResize\);\n\s*window\.removeEventListener\('terminal-send', handleTerminalSend\);\n\s*\};\n\s*\}, \[\]\);/;

code = code.replace(useEffectEndRegex, `return () => {
      socket.disconnect();
      term.dispose();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('terminal-send', handleTerminalSend);
    };
  }, []);

  useEffect(() => {
    if (xtermRef.current) {
        xtermRef.current.options.fontSize = fontSize;
    }
  }, [fontSize]);

  useEffect(() => {
    if (xtermRef.current) {
        xtermRef.current.options.theme = THEMES[theme] || THEMES.dark;
    }
  }, [theme]);`);

code = code.replace(/className="w-full h-full p-2 bg-\[#1e1e1e\] overflow-hidden"/, 'className="w-full h-full p-2 overflow-hidden" style={{ backgroundColor: THEMES[theme]?.background || \'#1e1e1e\' }}"');

fs.writeFileSync('src/components/TerminalPanel.tsx', code);
