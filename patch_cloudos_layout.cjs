const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(/<div className="flex-1 flex flex-col bg\[#1e1e1e\] relative min-w-0 cloudos-scroll overflow-auto h-full min-h-\[600px\]">/, '<div className="flex-1 flex flex-col bg-[#1e1e1e] relative min-w-0 h-full">');

code = code.replace(/<div className="flex-1 relative bg\[#1e1e1e\]"\s*style=\{\{\s*\/\* CSS-in-JS custom scrollbar for the container \*\/\s*minHeight: '600px',\s*\}\}\s*>/m, '<div className="flex-1 relative bg-[#1e1e1e] min-h-0">');

fs.writeFileSync('src/components/CloudOS.tsx', code);
