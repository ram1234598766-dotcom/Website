const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const newLangs = `const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: 'js' },
  { id: 'typescript', name: 'TypeScript', ext: 'ts' },
  { id: 'html', name: 'HTML', ext: 'html' },
  { id: 'css', name: 'CSS', ext: 'css' },
  { id: 'python', name: 'Python', ext: 'py' },
  { id: 'php', name: 'PHP', ext: 'php' },
  { id: 'sql', name: 'SQL', ext: 'sql' },
  { id: 'cpp', name: 'C++', ext: 'cpp' },
  { id: 'c', name: 'C', ext: 'c' },
  { id: 'csharp', name: 'C#', ext: 'cs' },
  { id: 'java', name: 'Java', ext: 'java' },
  { id: 'rust', name: 'Rust', ext: 'rs' },
  { id: 'go', name: 'Go', ext: 'go' },
  { id: 'ruby', name: 'Ruby', ext: 'rb' },
  { id: 'swift', name: 'Swift', ext: 'swift' },
  { id: 'kotlin', name: 'Kotlin', ext: 'kt' },
  { id: 'dart', name: 'Dart', ext: 'dart' },
  { id: 'json', name: 'JSON', ext: 'json' },
  { id: 'yaml', name: 'YAML', ext: 'yaml' },
  { id: 'markdown', name: 'Markdown', ext: 'md' },
  { id: 'shell', name: 'Shell Script', ext: 'sh' },
  { id: 'objective-c', name: 'Objective-C', ext: 'm' },
  { id: 'scala', name: 'Scala', ext: 'scala' },
  { id: 'perl', name: 'Perl', ext: 'pl' },
  { id: 'lua', name: 'Lua', ext: 'lua' }
];`;

code = code.replace(/const LANGUAGES = \[[^\]]*\];/, newLangs);
fs.writeFileSync('src/components/CloudOS.tsx', code);
