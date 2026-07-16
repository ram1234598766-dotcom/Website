const fs = require('fs');
let code = fs.readFileSync('src/components/OmniAI.tsx', 'utf8');

code = code.replace(/Cloud Mesh Active/g, 'Online');
code = code.replace(/Failed to connect to Omni-AI mesh/g, 'Failed to connect to Omni-AI server');
code = code.replace(/\[MESH ERROR\]/g, '[API ERROR]');
// also remove the dot thing?
// <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
// <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Cloud Mesh Active</span>
// let's just replace Cloud Mesh Active with Online

fs.writeFileSync('src/components/OmniAI.tsx', code);
