const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/    if \(!plugins\['prettier'\]\?\.active\) \{[\s\S]*?  const handleRun = async \(\) => \{/,
`  const handleFormat = async () => {
    if (!plugins['prettier']?.active) {
      setTerminalOutput('Error: Prettier plugin is not enabled.');
      setShowOutput(true);
      return;
    }
    
    try {
      let formatted = activeFile.content;
      if (activeFile.language === 'javascript' || activeFile.language === 'typescript') {
        formatted = await prettier.format(activeFile.content, {
          parser: 'babel',
          plugins: [prettierPluginBabel, prettierPluginEstree]
        });
      } else if (activeFile.language === 'html') {
        formatted = await prettier.format(activeFile.content, {
          parser: 'html',
          plugins: [prettierPluginHtml]
        });
      } else if (activeFile.language === 'css') {
        formatted = await prettier.format(activeFile.content, {
          parser: 'css',
          plugins: [prettierPluginCss]
        });
      } else if (activeFile.language === 'json') {
        formatted = JSON.stringify(JSON.parse(activeFile.content), null, 2);
      }
      
      const updatedFiles = files.map(f => f.id === activeFileId ? { ...f, content: formatted } : f);
      setFiles(updatedFiles);
    } catch (e: any) {
      setTerminalOutput('Format error: ' + e.message);
      setShowOutput(true);
    }
  };

  const handleRun = async () => {`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
