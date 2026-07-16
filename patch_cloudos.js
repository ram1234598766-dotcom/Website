const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
  "import { Download, Play, Terminal, Code2, FolderTree, Settings, FileJson, FileType, CheckCircle2, Plus, Trash2, Edit2, File as FileIcon, Archive, ChevronDown, ChevronRight, Folder, FolderOpen, ArrowRight, Cloud, CloudOff, FileCode2, Database, FileTerminal, Puzzle, X, Activity } from 'lucide-react';",
  "import { Download, Play, Terminal, Code2, FolderTree, Settings, FileJson, FileType, CheckCircle2, Plus, Trash2, Edit2, File as FileIcon, Archive, ChevronDown, ChevronRight, Folder, FolderOpen, ArrowRight, Cloud, CloudOff, FileCode2, Database, FileTerminal, Puzzle, X, Activity, Columns, Rows } from 'lucide-react';"
);

code = code.replace(
  "const [activeFileId, setActiveFileId] = useState<string>('0');",
  "const [activeFileId, setActiveFileId] = useState<string>('0');\n  const [dirtyTabs, setDirtyTabs] = useState<string[]>([]);\n  const [splitMode, setSplitMode] = useState<'none' | 'side-by-side' | 'stacked'>('none');\n  const [secondaryActiveFileId, setSecondaryActiveFileId] = useState<string | null>(null);"
);

code = code.replace(
  "const handleEditorDidMount = (editor: any, monacoInstance: any) => {\n    editorRef.current = editor;",
  "const handleEditorDidMount = (editor: any, monacoInstance: any) => {\n    editorRef.current = editor;\n    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {\n       window.dispatchEvent(new CustomEvent('save-active-file'));\n    });"
);

code = code.replace(
  "const handleEditorChange = (value: string | undefined) => {\n    if (value !== undefined) {\n      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value } : f));",
  "const handleEditorChange = (value: string | undefined, isSecondary: boolean = false) => {\n    const fileId = isSecondary ? secondaryActiveFileId : activeFileId;\n    if (value !== undefined && fileId) {\n      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: value } : f));\n      setDirtyTabs(prev => {\n        if (!prev.includes(fileId)) return [...prev, fileId];\n        return prev;\n      });"
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
