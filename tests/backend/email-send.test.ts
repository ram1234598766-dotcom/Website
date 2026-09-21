import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../../src/lib/server/api-router';
import {
  sanitizeHeader,
  encodeSubject,
  rfc2822Date,
  buildMailPayload,
} from '../../src/lib/server/smtp';

const BASE = 'https://example.com';

async function post(
  path: string,
  body: unknown,
  env: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const res = await handleApiRequest(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env
  );
  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

describe('SMTP message helpers', () => {
  it('sanitizeHeader strips CR/LF and other control chars (header injection)', () => {
    const clean = sanitizeHeader('a@b.com\r\nBcc: attacker@x.com');
    expect(clean).not.toMatch(/[\r\n\x00-\x1F]/);
    expect(clean).toBe('a@b.com Bcc: attacker@x.com');
  });

  it('sanitizeHeader removes angle brackets and collapses whitespace', () => {
    expect(sanitizeHeader('  <bob@example.com>  ')).toBe('bob@example.com');
  });

  it('encodeSubject keeps pure-ASCII subjects as plain text', () => {
    expect(encodeSubject('Hello world')).toBe('Hello world');
  });

  it('encodeSubject wraps non-ASCII subjects in an RFC 2047 UTF-8 B-word', () => {
    const encoded = encodeSubject('Héllo — wörld');
    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    expect(encoded.endsWith('?=')).toBe(true);
    expect(encoded).not.toMatch(/[\r\n\x00-\x1F]/);
    expect(Buffer.byteLength(encoded, 'utf8')).toBeGreaterThanOrEqual(Buffer.byteLength('Héllo — wörld', 'utf8'));
  });

  it('encodeSubject caps the encoded subject at 300 bytes on one line', () => {
    const encoded = encodeSubject('à'.repeat(500));
    expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThanOrEqual(300);
    expect(encoded).not.toContain('\n');
  });

  it('rfc2822Date emits a UTC date header as +0000', () => {
    expect(rfc2822Date(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('Fri, 02 Jan 2026 03:04:05 +0000');
  });

  it('buildMailPayload produces headers plus a base64 body without dot-interference', () => {
    const payload = buildMailPayload({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      replyTo: 'reply@example.com',
      subject: 'Test subject',
      text: 'Hello everyone.\r\nFrom the cloud IDE.\r\n.This line is not a dot terminator.',
      messageId: 'msg-123',
      date: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
    });
    expect(payload).toContain('From: sender@example.com');
    expect(payload).toContain('To: recipient@example.com');
    expect(payload).toContain('Reply-To: reply@example.com');
    expect(payload).toContain('Subject: Test subject');
    expect(payload).toContain('Content-Transfer-Encoding: base64');
    expect(payload).toContain('Message-ID: <msg-123@vantaos>');
    const bodyLines = payload.split('\r\n').filter((line) => /^[A-Za-z0-9+/=]*$/.test(line) && line.length > 0);
    // no payload line may begin with '.' (the DATA terminator is appended separately)
    for (const line of payload.split('\r\n')) {
      expect(line.startsWith('.')).toBe(false);
    }
    expect(bodyLines.length).toBeGreaterThan(0);
  });
});

describe('POST /api/email/send', () => {
  it('rejects an invalid recipient address', async () => {
    const { status, body } = await post('/api/email/send', {
      to: 'not-an-address',
      subject: 'Hi',
      content: 'body',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('A valid recipient address is required.');
  });

  it('rejects content over the size cap', async () => {
    const { status, body } = await post('/api/email/send', {
      to: 'a@b.com',
      subject: 'Hi',
      content: 'x'.repeat(100_001),
    });
    expect(status).toBe(400);
    expect(body.error).toBe('Message content is too large.');
  });

  it('rejects subject over 300 characters', async () => {
    const { status, body } = await post('/api/email/send', {
      to: 'a@b.com',
      subject: 'x'.repeat(301),
      content: 'body',
    });
    expect(status).toBe(400);
    expect(body.error).toBe('Subject must be 300 characters or fewer.');
  });

  it('returns 401 when Firebase is configured but no valid ID token is supplied', async () => {
    const { status, body } = await post(
      '/api/email/send',
      { to: 'a@b.com', subject: 'Hi', content: 'body', firebaseToken: '' },
      { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'website-6e8b1' }
    );
    expect(status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('gracefully skips external delivery when SMTP is not configured', async () => {
    const { status, body } = await post('/api/email/send', {
      to: 'a@b.com',
      subject: 'Hi',
      content: 'body',
    });
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, delivered: false, skipped: true });
  });

  it('fails closed with a generic envelope on invalid SMTP configuration', async () => {
    const { status, body } = await post(
      '/api/email/send',
      { to: 'a@b.com', subject: 'Hi', content: 'body' },
      { SMTP_HOST: 'invalid host', SMTP_PASS: 'top-secret' }
    );
    expect(status).toBe(502);
    expect(body.error).toBe('Email delivery failed');
    expect(body).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toContain('top-secret');
    expect(JSON.stringify(body)).not.toContain('invalid host');
  });
});