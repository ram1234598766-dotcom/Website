const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/import Editor, \{ useMonaco \} from '@monaco-editor\/react';/,
`import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';`
);

code = code.replace(
/import \{ Keyboard \} from 'lucide-react';/,
`import { Keyboard, GitMerge } from 'lucide-react';`
);

code = code.replace(
/const \[files, setFiles\] = useState<FileNode\[\]>\(DEFAULT_FILES\);/,
`const [files, setFiles] = useState<FileNode[]>(DEFAULT_FILES);
  const [originalFiles, setOriginalFiles] = useState<Record<string, string>>({});
  const [showDiff, setShowDiff] = useState(false);`
);

code = code.replace(
/          const \{ data, error \} = await supabase\.from\('workspace_files'\)\.select\('\*'\);\n          if \(data && data\.length > 0\) \{\n            setFiles\(data\);\n            setActiveFileId\(data\[0\]\.id\);/,
`          const { data, error } = await supabase.from('workspace_files').select('*');
          if (data && data.length > 0) {
            setFiles(data);
            const orig: Record<string, string> = {};
            data.forEach((d: any) => orig[d.id] = d.content);
            setOriginalFiles(orig);
            setActiveFileId(data[0].id);`
);

code = code.replace(
/          if \(parsed && parsed\.length > 0\) \{\n             setFiles\(parsed\);\n             setActiveFileId\(parsed\[0\]\.id\);/,
`          if (parsed && parsed.length > 0) {
             setFiles(parsed);
             const orig: Record<string, string> = {};
             parsed.forEach((d: any) => orig[d.id] = d.content);
             setOriginalFiles(orig);
             setActiveFileId(parsed[0].id);`
);

code = code.replace(
/<button \n\s*onClick=\{handleSave\}/,
`{plugins['gitlens']?.active && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border \${showDiff ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}\`}
            >
              <GitMerge className="w-4 h-4" />
              <span className="hidden sm:inline">Diff</span>
            </button>
          )}
          
          <button 
            onClick={handleSave}`
);

code = code.replace(
/<Editor height="100%" className="cloudos-scroll smooth-typing"\n\s*language=\{activeFile\.language\}/,
`{showDiff ? (
                      <DiffEditor height="100%"
                        original={originalFiles[activeFile.id] || ''}
                        modified={activeFile.content}
                        language={activeFile.language}
                        theme={editorTheme}
                        options={{
                          renderSideBySide: true,
                          minimap: { enabled: false },
                          fontSize: 14,
                          fontFamily: '"JetBrains Mono", monospace'
                        }}
                      />
                    ) : (
                    <Editor height="100%" className="cloudos-scroll smooth-typing"
                      language={activeFile.language}`
);

code = code.replace(
/                          vertical: 'visible',\n\s*horizontal: 'visible',\n\s*\}\}\n\s*\/>\n\s*<\/div>/,
`                          vertical: 'visible',
                          horizontal: 'visible',
                        }}
                      />
                    )}
                  </div>`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
