const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Add import
const importTarget = "import { Keyboard, GitMerge } from 'lucide-react';";
const importReplacement = "import { Keyboard, GitMerge, Github } from 'lucide-react';\nimport GitHubManager from './GitHubManager';";
code = code.replace(importTarget, importReplacement);

// Add state
const stateTarget = "const [showPlugins, setShowPlugins] = useState(false);";
const stateReplacement = "const [showPlugins, setShowPlugins] = useState(false);\n  const [showGithub, setShowGithub] = useState(false);";
code = code.replace(stateTarget, stateReplacement);

// Add button
const buttonTarget = `<button 
            onClick={() => setShowPlugins(!showPlugins)}`;
const buttonReplacement = `<button 
            onClick={() => setShowGithub(!showGithub)}
            className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border \${showGithub ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}\`}
          >
            <Github className="w-4 h-4" />
            GitHub
          </button>
          
          <button 
            onClick={() => setShowPlugins(!showPlugins)}`;
code = code.replace(buttonTarget, buttonReplacement);

// Add component
const componentTarget = `{showPlugins && (
          <motion.div`;
const componentReplacement = `{showGithub && (
          <GitHubManager 
            files={files} 
            setFiles={setFiles} 
            originalFiles={originalFiles} 
            setOriginalFiles={setOriginalFiles} 
            onClose={() => setShowGithub(false)} 
          />
        )}
        
        {showPlugins && (
          <motion.div`;
code = code.replace(componentTarget, componentReplacement);

fs.writeFileSync('src/components/CloudOS.tsx', code);
