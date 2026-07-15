const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

if (!code.includes("import { FixedSizeList as List } from 'react-window'")) {
  code = code.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/, "import { motion, AnimatePresence } from 'motion/react';\nimport { FixedSizeList as List } from 'react-window';");
  
  // Terminal virtualized list
  code = code.replace(
    /\{terminalOutput \? \(\n\s*<pre className="p-4 font-mono text-sm text-emerald-400 h-full whitespace-pre-wrap">\{terminalOutput\}<\/pre>/,
    `{terminalOutput ? (
                        <div className="h-full w-full font-mono text-sm text-emerald-400">
                          <List
                            height={256}
                            itemCount={terminalOutput.split('\\n').length}
                            itemSize={20}
                            width="100%"
                          >
                            {({ index, style }) => (
                              <div style={style} className="px-4 whitespace-pre-wrap">
                                {terminalOutput.split('\\n')[index]}
                              </div>
                            )}
                          </List>
                        </div>`
  );
  
  // File explorer virtualized list
  code = code.replace(
    /<div className="p-2 space-y-1 overflow-y-auto max-h-\[60vh\] cloudos-scroll">\n\s*\{files.map\(file => \(/,
    `<div className="p-2 overflow-y-auto h-[60vh] cloudos-scroll">
              <List
                height={400}
                itemCount={files.length}
                itemSize={36}
                width="100%"
              >
                {({ index, style }) => {
                  const file = files[index];
                  return (
                    <div style={style} className="pr-2">`
  );
  
  // Need to fix the closing tags of files.map
  code = code.replace(
    /<\/div>\n\s*\)\)}\n\s*<\/div>/,
    `</div>
                  );
                }}
              </List>
            </div>`
  );
  fs.writeFileSync('src/components/CloudOS.tsx', code);
}
