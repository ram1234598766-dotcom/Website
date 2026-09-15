import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const headersPath = join(process.cwd(), '.open-next', 'assets', '_headers');
try {
  let content = readFileSync(headersPath, 'utf8');
  // Remove immutable and force revalidation so CSS/JS fixes reach the browser immediately
  const fixed = content
    .replace(/Cache-Control: public, max-age=\d+, immutable/g, 'Cache-Control: public, max-age=0, must-revalidate')
    .replace(/Cache-Control: public, max-age=\d+, immutable,/g, 'Cache-Control: public, max-age=0, must-revalidate,');
  if (fixed !== content) {
    writeFileSync(headersPath, fixed);
    console.log('Fixed cache headers in _headers');
  }
} catch {}
