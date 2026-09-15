import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const headersPath = join(process.cwd(), '.open-next', 'assets', '_headers');
try {
  let content = readFileSync(headersPath, 'utf8');
  // Only force revalidation for non-hashed routes (HTML, OG images).
  // /_next/static/* files have content hashes and must stay immutable.
  const lines = content.split('\n');
  const fixed = lines.map((line, i) => {
    const prev = i > 0 ? lines[i - 1] : '';
    if (line.includes('immutable') && !prev.includes('/_next/static/*')) {
      return line.replace(
        /Cache-Control: public, max-age=\d+, immutable/,
        'Cache-Control: public, max-age=0, must-revalidate'
      );
    }
    return line;
  }).join('\n');
  if (fixed !== content) {
    writeFileSync(headersPath, fixed);
    console.log('Fixed cache headers in _headers');
  }
} catch {}
