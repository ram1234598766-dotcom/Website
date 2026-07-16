const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const stateStr = `  const [terminalHeight, setTerminalHeight] = useState(256);
  const [terminalTheme, setTerminalTheme] = useState<any>('dark');
  const [terminalFontSize, setTerminalFontSize] = useState<number>(13);
  const [showTerminalSettings, setShowTerminalSettings] = useState(false);`;

code = code.replace(/const \[terminalHeight, setTerminalHeight\] = useState\(256\);/, stateStr);

const tpStr = `<TerminalPanel />`;
const tpReplacement = `<TerminalPanel theme={terminalTheme} fontSize={terminalFontSize} />`;
code = code.replace(tpStr, tpReplacement);

fs.writeFileSync('src/components/CloudOS.tsx', code);
