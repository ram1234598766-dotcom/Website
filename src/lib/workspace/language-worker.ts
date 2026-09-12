/**
 * VantaOS Language Worker — runs in a Web Worker.
 *
 * Protocol:
 *   { type: 'diagnostics', fileId: string, content: string }
 *     → { type: 'diagnostics', fileId: string, diagnostics: Diagnostic[] }
 *
 * Keeps the main thread free during syntax analysis.  The analysis here is
 * intentionally minimal — bracket / brace / paren balance and unterminated
 * string detection — but it exercises the full worker lifecycle so it can be
 * extended later without changing the wiring.
 */

interface Diagnostic {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

interface DiagnosticsRequest {
  type: 'diagnostics';
  fileId: string;
  content: string;
}

interface DiagnosticsResponse {
  type: 'diagnostics';
  fileId: string;
  diagnostics: Diagnostic[];
}

function analyze(content: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = content.split('\n');

  // Track stack of opening brackets across lines for brace/paren/bracket balance.
  const openStack: { char: string; line: number; col: number }[] = [];

  // We only check for the three common structural brackets here; template
  // literals and string boundaries are handled per-line below.
  const pairs: Record<string, { open: string; close: string }> = {
    '(': { open: '(', close: ')' },
    '[': { open: '[', close: ']' },
    '{': { open: '{', close: '}' },
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let col = 0;

    while (col < line.length) {
      const ch = line[col];

      // Skip string literals (single-line only — multi-line strings are flagged
      // separately below).
      if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch;
        col++;
        while (col < line.length) {
          if (line[col] === '\\') { col += 2; continue; }
          if (line[col] === quote) { col++; break; }
          col++;
        }
        if (col >= line.length && quote !== '`') {
          diagnostics.push({
            line: lineIdx + 1,
            column: col,
            message: `Unterminated ${quote === '"' ? 'double-quoted' : 'single-quoted'} string`,
            severity: 'error',
          });
        }
        continue;
      }

      if (ch === '`') {
        // Template literal — count until closing backtick.
        col++;
        while (col < line.length) {
          if (line[col] === '\\') { col += 2; continue; }
          if (line[col] === '`') { col++; break; }
          col++;
        }
        if (col >= line.length) {
          diagnostics.push({
            line: lineIdx + 1,
            column: line.length,
            message: 'Unterminated template literal',
            severity: 'error',
          });
        }
        continue;
      }

      const pair = pairs[ch];
      if (pair) {
        openStack.push({ char: ch, line: lineIdx + 1, col: col + 1 });
        col++;
        continue;
      }

      const openEntry = openStack[openStack.length - 1];
      const expectedClose = openEntry ? pairs[openEntry.char]?.close : null;
      if (expectedClose && ch === expectedClose) {
        openStack.pop();
        col++;
        continue;
      }

      col++;
    }
  }

  for (const entry of openStack) {
    diagnostics.push({
      line: entry.line,
      column: entry.col,
      message: `Unclosed '${entry.char}'`,
      severity: 'error',
    });
  }

  return diagnostics;
}

self.onmessage = (event: MessageEvent<DiagnosticsRequest>) => {
  const msg = event.data;
  if (msg.type !== 'diagnostics') return;

  // Run analysis off the main thread; yield back the result.
  const diagnostics = analyze(msg.content);
  const response: DiagnosticsResponse = {
    type: 'diagnostics',
    fileId: msg.fileId,
    diagnostics,
  };
  self.postMessage(response);
};
