import React, { useState, useMemo } from 'react';
import { Search, FileCode, Folder, File } from 'lucide-react';
import { useWorkspace } from '../lib/workspace/workspace';

interface SearchPanelProps {
  onClose: () => void;
}

interface Match {
  fileId: string;
  fileName: string;
  line: string;
  lineNum: number;
}

export default function SearchPanel({ onClose }: SearchPanelProps) {
  const { state } = useWorkspace();
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [regex, setRegex] = useState(false);
  const [results, setResults] = useState<Match[]>([]);

  const files = useMemo(() => {
    const list: { id: string; name: string; content: string }[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.content !== undefined) {
          list.push({ id: node.id, name: node.name, content: node.content });
        }
        if (node.children) walk(node.children);
      }
    };
    try {
      const root = (state as any).rootId;
      if (root) {
        const rootNode = (state as any).nodes?.get?.(root);
        if (rootNode?.children) {
          walk(rootNode.children);
        }
      }
    } catch {
      /* fallback: search DEFAULT_FILES */
    }
    return list;
  }, [state]);

  const runSearch = () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let pattern: RegExp | string = query;
    if (regex) {
      try {
        pattern = new RegExp(query, matchCase ? '' : 'i');
      } catch {
        setResults([]);
        return;
      }
    }
    const matches: Match[] = [];
    for (const file of files) {
      const lines = file.content.split('\n');
      lines.forEach((line, i) => {
        const searchStr = matchCase ? line : line.toLowerCase();
        const q = regex ? pattern : (matchCase ? query : query.toLowerCase());
        if (regex ? (pattern as RegExp).test(line) : searchStr.includes(q as string)) {
          matches.push({ fileId: file.id, fileName: file.name, line, lineNum: i + 1 });
        }
      });
    }
    setResults(matches);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Search size={16} color="#fff" />
          <strong style={{ color: '#fff', fontSize: 14 }}>Search</strong>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
          >
            <Search size={16} />
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search files..."
            autoFocus
            style={{
              width: '100%',
              background: '#252526',
              border: '1px solid #333',
              color: '#fff',
              padding: '8px 10px',
              borderRadius: 4,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#aaa', fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />
            Match Case
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#aaa', fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
            Regex
          </label>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
        {results.length === 0 ? (
          <div style={{ color: '#666', padding: 16, textAlign: 'center' }}>
            {query ? 'No results found' : 'Type to search files'}
          </div>
        ) : (
          results.map((match, i) => (
            <div
              key={i}
              style={{
                padding: '6px 8px',
                marginBottom: 2,
                background: '#252526',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileCode size={12} color="#4ec9b0" />
                <span style={{ color: '#fff' }}>{match.fileName}</span>
                <span style={{ color: '#007acc', fontSize: 11 }}>
                  Line {match.lineNum}
                </span>
              </div>
              <div style={{ color: '#aaa', marginTop: 2, whiteSpace: 'pre-wrap', fontSize: 11 }}>
                {match.line}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
