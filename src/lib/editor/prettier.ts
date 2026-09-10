/**
 * VantaOS IDE — Code Formatting.
 *
 * Centralizes the lazy-loaded Prettier plumbing. Prettier's parser bundle is
 * ~1MB, so all dynamic imports happen on first use from here and nowhere else.
 */

/** Languages Prettier supports via a single `babel`-family parser cluster. */
const PRETTIER_FORMATTABLE = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'html',
  'css',
  'scss',
  'less',
  'json',
  'markdown',
  'yaml',
]);

export function isPrettierFormattable(language: string): boolean {
  return PRETTIER_FORMATTABLE.has(language);
}

/**
 * Format `content` with Prettier based on `language`. Throws on parse errors;
 * callers decide whether to keep the original content.
 */
export async function formatWithPrettier(
  content: string,
  language: string
): Promise<string> {
  const prettier = await import('prettier/standalone');

  if (language === 'json') {
    const formatted = await prettier.format(content, {
      parser: 'json',
      singleQuote: true,
    });
    return formatted.trimEnd();
  }

  let parser: string;
  let plugins: any[];

  switch (language) {
    case 'html':
      parser = 'html';
      plugins = [(await import('prettier/plugins/html')).default];
      break;
    case 'css':
    case 'scss':
    case 'less':
      parser = 'css';
      plugins = [(await import('prettier/plugins/postcss')).default];
      break;
    case 'markdown':
      parser = 'markdown';
      plugins = [(await import('prettier/plugins/markdown')).default];
      break;
    case 'yaml':
      parser = 'yaml';
      plugins = [(await import('prettier/plugins/yaml')).default];
      break;
    default:
      parser = 'babel';
      plugins = [
        (await import('prettier/plugins/babel')).default,
        (await import('prettier/plugins/estree')).default,
      ];
      break;
  }

  return prettier.format(content, { parser, plugins, singleQuote: true });
}