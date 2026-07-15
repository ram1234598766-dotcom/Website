const fs = require('fs');
let code = fs.readFileSync('src/components/Home.tsx', 'utf8');

code = code.replace(
/            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500\/50 rounded-full blur-3xl -translate-y-1\/2 translate-x-1\/2"><\/div>\n          <\/div>/,
`            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            {/* Tooltip */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none whitespace-nowrap z-50">
              Zero-trust architecture with end-to-end encryption
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>`
);

fs.writeFileSync('src/components/Home.tsx', code);
