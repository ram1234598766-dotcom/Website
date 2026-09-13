import DOMPurify from 'dompurify';

/**
 * Sanitize HTML input by stripping all tags and attributes.
 * Use this ONLY for user-provided content that will be rendered as HTML.
 * For database queries, use parameterized queries instead.
 * For plain text, use textContent (no sanitization needed).
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags to prevent XSS
    ALLOWED_ATTR: []
  });
}

// Deprecated: was a no-op security control. Use parameterized queries
// for SQL safety — never regex-based detection.
// @deprecated No security value; kept for API compatibility.
export function detectSqlInjection(): false {
  return false;
}
