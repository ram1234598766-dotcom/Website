const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/const DEFAULT_PLUGINS: Record<string, PluginMeta> = \{[\s\S]*?\};\n/,
`const DEFAULT_PLUGINS: Record<string, PluginMeta> = {
  prettier: { name: 'Prettier', description: 'Auto-formatter for JS, HTML, CSS', active: true },
  eslint: { name: 'ESLint', description: 'JavaScript Linter', active: false },
  clang: { name: 'Clang-Format', description: 'C++ style rules', active: true },
  gitlens: { name: 'GitLens', description: 'Supercharge Git', active: false },
  liveServer: { name: 'Live Server', description: 'Launch a local dev server', active: false },
  vscodeIcons: { name: 'VSCode Icons', description: 'Icons for Visual Studio Code', active: true },
  materialIcon: { name: 'Material Icon Theme', description: 'Material Design Icons', active: false },
  python: { name: 'Python Extension', description: 'IntelliSense, linting, debugging', active: true },
  cpp: { name: 'C/C++ Extension', description: 'C/C++ IntelliSense, debugging', active: true },
  java: { name: 'Java Extension Pack', description: 'Popular extensions for Java', active: false },
  docker: { name: 'Docker', description: 'Build, manage Docker containers', active: false },
  kubernetes: { name: 'Kubernetes', description: 'Develop, deploy K8s applications', active: false },
  restClient: { name: 'REST Client', description: 'REST Client for IDE', active: true },
  thunderClient: { name: 'Thunder Client', description: 'Lightweight API Client', active: false },
  spellChecker: { name: 'Code Spell Checker', description: 'Spell checker for source code', active: true },
  pathIntellisense: { name: 'Path Intellisense', description: 'Visual Studio Code plugin that autocompletes filenames', active: true },
  reactSnippets: { name: 'React Snippets', description: 'ES7 React/Redux/GraphQL/React-Native snippets', active: true },
  autoCloseTag: { name: 'Auto Close Tag', description: 'Auto add HTML/XML close tag', active: true },
  autoRenameTag: { name: 'Auto Rename Tag', description: 'Auto rename paired HTML/XML tag', active: true },
  bracketPair: { name: 'Bracket Pair Colorizer', description: 'A customizable extension for colorizing matching brackets', active: true },
  settingsSync: { name: 'Settings Sync', description: 'Synchronize Settings, Snippets, Themes', active: false },
  remoteSsh: { name: 'Remote - SSH', description: 'Open any folder on a remote machine', active: false },
  vim: { name: 'Vim', description: 'Vim emulation', active: false },
  jupyter: { name: 'Jupyter', description: 'Jupyter notebook support', active: true },
  markdown: { name: 'Markdown All in One', description: 'All you need to write Markdown', active: true },
  tailwind: { name: 'Tailwind CSS IntelliSense', description: 'Intelligent Tailwind CSS tooling', active: true }
};
`
);

code = code.replace(
/          const \{ data, error \} = await supabase\.from\('workspace_files'\)\.select\('\*'\);/,
`          // Server-side validation via Supabase Edge Functions (Mocked in our server)
          const token = await auth.currentUser?.getIdToken();
          const authRes = await fetch('/api/edge-functions/auth-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${token}\`
            },
            body: JSON.stringify({ action: 'read' })
          });
          
          if (!authRes.ok) {
            throw new Error('Server-side authentication failed in Edge Function');
          }
          const { data, error } = await supabase.from('workspace_files').select('*');`
);

code = code.replace(
/<span>Novalith Cloud OS IDE<\/span>/,
`<span>Thessvar CLOUD OS IDE</span>`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
