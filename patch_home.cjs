const fs = require('fs');
let code = fs.readFileSync('src/components/Home.tsx', 'utf8');

code = code.replace(
  '<a href="#" className="text-slate-400 hover:text-white transition-colors">GitHub Repo</a>\n                <a href="#" className="text-slate-400 hover:text-white transition-colors">Documentation</a>',
  ''
);

fs.writeFileSync('src/components/Home.tsx', code);
