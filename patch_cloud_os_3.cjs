const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// 1. Add Markdown preview to handleRun
code = code.replace(
/    if \(activeFile\.language === 'html'\) \{/,
"    if (activeFile.language === 'markdown') {\n" +
"      setOutputHtml(`\n" +
"        <!DOCTYPE html>\n" +
"        <html>\n" +
"        <head>\n" +
"          <link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css\">\n" +
"          <script src=\"https://cdn.jsdelivr.net/npm/marked/marked.min.js\"></script>\n" +
"        </head>\n" +
"        <body class=\"markdown-body\" style=\"padding: 20px;\">\n" +
"          <div id=\"content\"></div>\n" +
"          <script>\n" +
"            document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(activeFile.content)});\n" +
"          </script>\n" +
"        </body>\n" +
"        </html>\n" +
"      `);\n" +
"      return;\n" +
"    }\n" +
"\n" +
"    if (activeFile.language === 'html') {"
);

// 2. Add handleFormat function
code = code.replace(
/  const handleRun = async \(\) => \{/,
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

// 3. Add Format button next to Save button
code = code.replace(
/<button \n\s*onClick=\{handleSave\}\n\s*className="flex items-center gap-2 px-3 py-1\.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800\/50 text-slate-400 border-slate-700\/50 hover:bg-slate-800 hover:text-slate-300"\n\s*>/,
`<button
            onClick={handleFormat}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
          >
            <Code2 className="w-4 h-4" />
            <span className="hidden sm:inline">Format</span>
          </button>
          
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
          >`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
