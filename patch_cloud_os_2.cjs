const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// 1. Rename to "Thessvar Cloud OS IDE" (Check if already replaced, if not replace)
if (!code.includes('Thessvar CLOUD OS IDE')) {
  code = code.replace(/<span>.*?Cloud OS IDE.*?<\/span>/i, '<span>Thessvar CLOUD OS IDE</span>');
}

// 2. Editor multidirectional scrolling and advanced options
code = code.replace(
/options=\{\{\s*minimap: \{ enabled: false \},\s*fontSize: 14,\s*fontFamily: '"JetBrains Mono", monospace',\s*padding: \{ top: 16, bottom: 100 \},\s*scrollBeyondLastLine: true,\s*smoothScrolling: true,\s*cursorBlinking: "smooth",\s*cursorSmoothCaretAnimation: "on",\s*formatOnPaste: true,\s*automaticLayout: true,\s*scrollbar: \{\s*useShadows: false,\s*verticalScrollbarSize: 10,\s*horizontalScrollbarSize: 10,/g,
`options={{
                        minimap: { enabled: true, renderCharacters: false },
                        fontSize: 14,
                        fontFamily: '"JetBrains Mono", monospace',
                        padding: { top: 16, bottom: 100 },
                        scrollBeyondLastLine: true,
                        smoothScrolling: true,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        formatOnPaste: true,
                        automaticLayout: true,
                        wordWrap: 'off',
                        scrollbar: {
                          useShadows: false,
                          verticalScrollbarSize: 12,
                          horizontalScrollbarSize: 12,
                          vertical: 'visible',
                          horizontal: 'visible',`
);

// 4. Subtle Framer Motion animations for file explorer hover
code = code.replace(
/className=\{\`w-full h-full group flex items-center justify-between px-3 rounded-lg text-sm transition-all cursor-pointer \$\{/,
`as={motion.div as any}
                        whileHover={{ scale: 1.01, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                        whileTap={{ scale: 0.98 }}
                        className={\`w-full h-full group flex items-center justify-between px-3 rounded-lg text-sm transition-all cursor-pointer \${`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
