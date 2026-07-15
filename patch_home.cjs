const fs = require('fs');
let code = fs.readFileSync('src/components/Home.tsx', 'utf8');

code = code.replace(
/\s*{\/\* AI Mesh Stats \*\/}[\s\S]*?(?={\/\* Security & FHE \*\/})/m,
`          {/* CloudOS IDE */}
          <div 
            onClick={() => setCurrentView('ide')}
            className="bg-white rounded-2xl p-6 border border-slate-200 flex-1 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all group cursor-pointer flex flex-col justify-between relative"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                <h3 className="font-bold text-slate-800 text-lg">CloudOS Web IDE</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">Full-stack browser development environment. Real-time compilation, multi-language support, and cloud persistence.</p>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tighter">0ms</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Setup Time</div>
              </div>
              <div className="text-indigo-500 bg-indigo-50 px-2 py-1 rounded text-xs font-bold font-mono">Zero Config</div>
            </div>
            {/* Tooltip */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs px-3 py-2 rounded shadow-lg pointer-events-none whitespace-nowrap z-50">
              Access the CloudOS IDE with 25+ language plugins
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>

          `
);

fs.writeFileSync('src/components/Home.tsx', code);
