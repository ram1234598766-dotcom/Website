const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

if (!code.includes('/* CloudOS Custom Scrollbars */')) {
  code = code.replace(/<div className="flex-1 flex flex-col bg-\[#1e1e1e\] relative min-w-0">/, 
`
<style dangerouslySetInnerHTML={{__html: \`
  /* CloudOS Custom Scrollbars */
  .cloudos-scroll::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  .cloudos-scroll::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
  .cloudos-scroll::-webkit-scrollbar-thumb {
    background: #475569;
    border-radius: 6px;
    border: 3px solid #1e1e1e;
  }
  .cloudos-scroll::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
  .cloudos-scroll {
    scrollbar-width: thin;
    scrollbar-color: #475569 #1e1e1e;
    scroll-behavior: smooth;
  }
  .smooth-typing .view-lines {
    transition: all 0.1s ease-out;
  }
\`}} />
<div className="flex-1 flex flex-col bg-[#1e1e1e] relative min-w-0 cloudos-scroll overflow-auto h-full min-h-[600px]">`);
}

// Add animation to the Editor
code = code.replace(/<Editor\s+height="100%"/, 
`<Editor
                  height="100%"
                  className="cloudos-scroll smooth-typing"
                  options={{
                    wordWrap: "on",
                    minimap: { enabled: true },
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    cursorSmoothCaretAnimation: "on",
                    formatOnPaste: true,
                    scrollBeyondLastLine: true,
                    scrollbar: {
                      vertical: "visible",
                      horizontal: "visible",
                      useShadows: true,
                      verticalScrollbarSize: 12,
                      horizontalScrollbarSize: 12
                    }
                  }}`);

fs.writeFileSync('src/components/CloudOS.tsx', code);
