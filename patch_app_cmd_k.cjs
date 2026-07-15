const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('import CommandPalette')) {
  code = code.replace(
    /import Navigation from '\.\/components\/Navigation';/,
    `import Navigation from './components/Navigation';\nimport CommandPalette from './components/CommandPalette';`
  );
}

if (!code.includes('const [isCommandPaletteOpen')) {
  code = code.replace(
    /  const \[securityStatus, setSecurityStatus\] = useState/,
    `  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);\n  const [pluginSearchQuery, setPluginSearchQuery] = useState('');\n  const [securityStatus, setSecurityStatus] = useState`
  );
}

if (!code.includes('e.key === \'k\'')) {
  code = code.replace(
    /  useEffect\(\(\) => \{\n    const checkSecurity/,
    `  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const checkSecurity`
  );
}

code = code.replace(
/\{currentView === 'ide' && <CloudOS \/>\}/,
`{currentView === 'ide' && <CloudOS initialPluginSearch={pluginSearchQuery} />}`
);

code = code.replace(
/          <GlobalHelperBot \/>/,
`          <GlobalHelperBot />
          <CommandPalette 
            isOpen={isCommandPaletteOpen} 
            onClose={() => setIsCommandPaletteOpen(false)} 
            setCurrentView={setCurrentView}
            onSearchPlugins={(q) => setPluginSearchQuery(q)}
          />`
);

fs.writeFileSync('src/App.tsx', code);
