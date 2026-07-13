import Prism from 'prismjs';

Prism.languages.lion = {
  'comment': /\/\/.*/,
  'string': {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    lookbehind: true,
    greedy: true
  },
  'number': /\b\d+(?:\.\d+)?\b/,
  'class-name': {
    pattern: /\b[A-Z]\w*(?=\.)/,
    greedy: true
  },
  'function': {
    pattern: /\.([a-zA-Z_]\w*)(?=\()/,
    lookbehind: true
  },
  'property': {
    pattern: /\b[a-zA-Z_]\w*(?=\s*:)/
  },
  'punctuation': /[.,()[\]{}:]/
};
