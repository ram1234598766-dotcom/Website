import DOMPurify from 'dompurify';

export function sanitizeInput(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags to prevent XSS
    ALLOWED_ATTR: []
  });
}

export function detectSqlInjection(input: string): boolean {
  if (!input) return false;
  const sqlKeywords = /(\b(SELECT|UPDATE|DELETE|INSERT|DROP|ALTER|CREATE|EXEC|UNION|OR|AND)\b)|(--)/i;
  return sqlKeywords.test(input);
}
