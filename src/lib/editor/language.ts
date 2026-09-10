/**
 * VantaOS IDE — Language mapping.
 *
 * Translates CloudOS language ids (kept from Monaco, see LANGUAGES in
 * CloudOS.tsx) into the matching CodeMirror 6 language extension. Languages
 * that have no @codemirror/lang-* package fall back to plain text (no
 * highlighting) instead of degrading the editor itself.
 */

import type { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { php } from '@codemirror/lang-php';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';

export function languageExtension(language: string): Extension {
  const id = language.toLowerCase().trim();

  switch (id) {
    case 'javascript':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return javascript({ jsx: true, typescript: false });
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'json':
      return json();
    case 'html':
    case 'html5':
    case 'markup':
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'markdown':
    case 'md':
    case 'mdx':
      return markdown();
    case 'python':
      return python();
    case 'php':
      return php();
    case 'java':
      return java();
    case 'cpp':
    case 'c':
    case 'csharp':
    case 'c++':
    case 'objective-c':
      return cpp();
    case 'rust':
      return rust();
    case 'go':
      return go();
    case 'sql':
      return sql();
    case 'xml':
    case 'svg':
      return xml();
    case 'yaml':
    case 'yml':
      return yaml();
    default:
      return [];
  }
}