const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const didMountLogic = `
  const [remoteCursors, setRemoteCursors] = useState<Record<string, {line: number, column: number, color: string}>>({});
  const decorationsRef = useRef<string[]>([]);
  
  useEffect(() => {
    if (!auth.currentUser) return;
    const sessionRef = doc(db, 'collaboration', activeFileId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.cursors) {
          const others = { ...data.cursors };
          delete others[auth.currentUser.uid];
          setRemoteCursors(others);
        }
      }
    });
    return () => unsubscribe();
  }, [activeFileId]);

  useEffect(() => {
    if (editorRef.current && monaco) {
      const decorations = Object.values(remoteCursors).map((cursor: any) => ({
        range: new monaco.Range(cursor.line, cursor.column, cursor.line, cursor.column),
        options: {
          className: 'remote-cursor-collab',
          hoverMessage: { value: 'Collaborator' }
        }
      }));
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, decorations);
    }
  }, [remoteCursors, monaco]);

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;
    
    // Listen for cursor changes
    editor.onDidChangeCursorPosition((e: any) => {
      if (auth.currentUser) {
        const sessionRef = doc(db, 'collaboration', activeFileId);
        setDoc(sessionRef, {
          cursors: {
            [auth.currentUser.uid]: {
              line: e.position.lineNumber,
              column: e.position.column,
              color: '#10b981' // Emerald
            }
          }
        }, { merge: true });
      }
    });
  };
`;

code = code.replace(/const monaco = useMonaco\(\);/, didMountLogic + '\n  const monaco = useMonaco();');

code = code.replace(/onMount=\{\(editor\) => editorRef\.current = editor\}/, 'onMount={handleEditorDidMount}');

// Add custom CSS for cursor
code = code.replace(/<style dangerouslySetInnerHTML=\{\{__html: \`/, 
`<style dangerouslySetInnerHTML={{__html: \`
  .remote-cursor-collab {
    border-left: 2px solid #10b981;
    position: absolute;
    z-index: 10;
  }
`);

fs.writeFileSync('src/components/CloudOS.tsx', code);
