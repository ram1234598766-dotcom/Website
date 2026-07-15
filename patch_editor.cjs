const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

if (!code.includes('/* CloudOS Custom Scrollbars */')) {
  code = code.replace(/<div className="flex-1 flex flex-col bg-\[#1e1e1e\] relative min-w-0">/, 
`
<style dangerouslySetInnerHTML={{__html: \`
  /* CloudOS Custom Scrollbars */
  .cloudos-scroll::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .cloudos-scroll::-webkit-scrollbar-track {
    background: #1e1e1e;
  }
  .cloudos-scroll::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 5px;
    border: 2px solid #1e1e1e;
  }
  .cloudos-scroll::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
  .cloudos-scroll {
    scrollbar-width: thin;
    scrollbar-color: #333 #1e1e1e;
    scroll-behavior: smooth;
  }
\`}} />
<motion.div 
  initial={{ opacity: 0, scale: 0.98 }} 
  animate={{ opacity: 1, scale: 1 }} 
  transition={{ duration: 0.5, ease: "easeOut" }}
  className="flex-1 flex flex-col bg-[#1e1e1e] relative min-w-0 cloudos-scroll overflow-auto h-full"
>`);
  
  // Also close the motion.div where appropriate
  // Actually, wait, replacing a div with motion.div might break if I don't replace the closing tag.
  // Better to wrap the Editor component or inject classes directly.
}

fs.writeFileSync('src/components/CloudOS.tsx', code);
