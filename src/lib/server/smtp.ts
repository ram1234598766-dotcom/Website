/**
 * Minimal SMTP client for the VantaOS Worker.
 *
 * Runs inside the OpenNext Node.js runtime (wrangler `nodejs_compat`,
 * route `runtime: 'nodejs'`), so it uses `node:net` / `node:tls` only — no
 * third-party mail dependency and no adapter for a cloud email API.
 *
 * Delivery is one-shot and single-recipient (the compose panel sends one
 * prepared message at a time). TLS is implicit over 465 or STARTTLS over 587;
 * `SMTP_USER`/`SMTP_PASS` enable AUTH LOGIN. All header/envelope values pass
 * through `sanitizeHeader` so user-supplied text can never inject commands
 * or extra headers, and the body is base64 (no dot-stuffing, 8-bit safe).
 */
import net from 'node:net';
import tls from 'node:tls';

const CONNECT_TIMEOUT_MS = 15_000;
const DELIVERY_TIMEOUT_MS = 30_000;
const HELO_NAME = 'vantaos.local';

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  messageId?: string;
}

export interface SmtpDelivery {
  messageId: string;
}

/** Strip control chars, CR/LF and angle brackets so text can never inject SMTP commands or headers. */
export function sanitizeHeader(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\r\n]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ASCII-safe subject: RFC 2047 UTF-8 B-word when the subject is not pure ASCII. */
export function encodeSubject(subject: string, maxBytes = 300): string {
  const clean = sanitizeHeader(subject);
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return clean.slice(0, maxBytes);
  }
  const encoded = `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
  return encoded.length > maxBytes ? `${encoded.slice(0, maxBytes - 4)}...` : encoded;
}

/** RFC 2822 date header, always UTC (+0000). Uses English day/month names to match the RFC. */
export function rfc2822Date(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = days[date.getUTCDay()];
  const d = String(date.getUTCDate()).padStart(2, '0');
  const mon = months[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${day}, ${d} ${mon} ${y} ${hh}:${mm}:${ss} +0000`;
}

/** Builds the RFC 5322 DATA payload (headers + base64 body). Body is base64 so no dot-stuffing is needed. */
export function buildMailPayload(opts: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  messageId: string;
  date?: Date;
}): string {
  const wrapped = Buffer.from(opts.text, 'utf8').toString('base64').match(/.{1,76}/g) ?? [];
  const headers = [
    `From: ${sanitizeHeader(opts.from)}`,
    `To: ${sanitizeHeader(opts.to)}`,
    ...(opts.replyTo ? [`Reply-To: ${sanitizeHeader(opts.replyTo)}`] : []),
    `Subject: ${encodeSubject(opts.subject)}`,
    `Date: ${rfc2822Date(opts.date ?? new Date())}`,
    `Message-ID: <${sanitizeHeader(opts.messageId)}@vantaos>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapped.join('\r\n'),
    '',
  ];
  return headers.join('\r\n');
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Buffered CRLF line reader over a (possibly TLS-upgraded) socket. */
class LineReader {
  private buffer = '';
  private queue: string[] = [];
  private waiters: Array<{ resolve: (line: string) => void; reject: (err: Error) => void }> = [];
  private streamError: Error | null = null;

  attach(socket: net.Socket | tls.TLSSocket): void {
    socket.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      this.flush();
    });
    socket.on('error', (err) => {
      this.streamError = err;
      this.drainWaiters();
    });
    socket.on('close', () => {
      this.streamError = this.streamError ?? new Error('smtp connection closed');
      this.drainWaiters();
    });
  }

  next(): Promise<string> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    if (this.streamError) return Promise.reject(this.streamError);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  private flush(): void {
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '');
      this.buffer = this.buffer.slice(idx + 1);
      const waiter = this.waiters.shift();
      if (waiter) waiter.resolve(line);
      else this.queue.push(line);
    }
  }

  private drainWaiters(): void {
    const err = this.streamError ?? new Error('smtp stream closed');
    for (const waiter of this.waiters.splice(0)) waiter.reject(err);
  }
}

function connectSocket(
  host: string,
  port: number,
  secure: boolean
): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('smtp connect timeout')), CONNECT_TIMEOUT_MS);
    const settle = (err?: Error) => {
      clearTimeout(timer);
      if (err) reject(err);
    };
    if (secure) {
      const sock = tls.connect({ host, port, servername: host, rejectUnauthorized: true }, () => {
        sock.removeListener('error', onError);
        settle();
        resolve(sock);
      });
      const onError = (err: Error) => settle(err);
      sock.once('error', onError);
    } else {
      const sock = net.connect({ host, port }, () => {
        sock.removeListener('error', onError);
        settle();
        resolve(sock);
      });
      const onError = (err: Error) => settle(err);
      sock.once('error', onError);
    }
  });
}

function upgradeTls(raw: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secured = tls.connect({ socket: raw, servername: host, rejectUnauthorized: true }, () => {
      secured.removeListener('error', onError);
      resolve(secured);
    });
    const onError = (err: Error) => reject(err);
    secured.once('error', onError);
    raw.once('error', onError);
  });
}

async function readReply(reader: LineReader): Promise<{ code: number; ok: boolean }> {
  const first = await reader.next();
  const match = /^(\d{3})(?:([ -])(.*))?$/.exec(first);
  if (!match) throw new Error('malformed SMTP reply');
  const code = Number(match[1]);
  let cont = match[2] === '-';
  while (cont) {
    const next = await reader.next();
    const nextMatch = /^(\d{3})(?:([ -])(.*))?$/.exec(next);
    cont = nextMatch !== null && nextMatch[1] === String(code) && nextMatch[2] === '-';
  }
  return { code, ok: code >= 200 && code < 300 };
}

async function command(
  socket: net.Socket | tls.TLSSocket,
  reader: LineReader,
  line: string,
  accept: number[]
): Promise<void> {
  socket.write(`${line}\r\n`);
  const reply = await readReply(reader);
  if (!accept.includes(reply.code)) {
    throw new Error(`smtp ${line.split(' ')[0]} refused (${reply.code})`);
  }
}

async function deliverInternal(opts: SmtpOptions): Promise<void> {
  let socket: net.Socket | tls.TLSSocket = await connectSocket(opts.host, opts.port, opts.secure);
  const reader = new LineReader();
  reader.attach(socket);

  try {
    const greeting = await readReply(reader);
    if (!greeting.ok) throw new Error('smtp greeting refused');

    await command(socket, reader, `EHLO ${HELO_NAME}`, [250]);

    if (!opts.secure) {
      await command(socket, reader, 'STARTTLS', [220]);
      socket = await upgradeTls(socket, opts.host);
      reader.attach(socket);
      await command(socket, reader, `EHLO ${HELO_NAME}`, [250]);
    }

    if (opts.user) {
      await command(socket, reader, 'AUTH LOGIN', [334]);
      await command(socket, reader, Buffer.from(opts.user, 'utf8').toString('base64'), [334]);
      await command(socket, reader, Buffer.from(opts.pass ?? '', 'utf8').toString('base64'), [235]);
    }

    const envFrom = sanitizeHeader(opts.from).replace(/[<>]/g, '');
    const envTo = sanitizeHeader(opts.to).replace(/[<>]/g, '');
    await command(socket, reader, `MAIL FROM:<${envFrom}>`, [250]);
    await command(socket, reader, `RCPT TO:<${envTo}>`, [250, 251]);

    await command(socket, reader, 'DATA', [354]);
    const messageId = opts.messageId || crypto.randomUUID();
    const payload = buildMailPayload({
      from: opts.from,
      to: opts.to,
      replyTo: opts.replyTo && opts.replyTo !== opts.from ? opts.replyTo : undefined,
      subject: opts.subject,
      text: opts.text,
      messageId,
    });
    socket.write(`${payload}\r\n.\r\n`);
    const dataReply = await readReply(reader);
    if (!dataReply.ok) throw new Error(`smtp DATA rejected (${dataReply.code})`);

    try {
      await command(socket, reader, 'QUIT', [221]);
    } catch {
      // server may drop the socket before replying — delivery already accepted
    }
  } finally {
    socket.destroy();
  }
}

/** Deliver one message over SMTP. Resolves with the assigned Message-ID on success. */
export function deliverSmtp(opts: SmtpOptions): Promise<SmtpDelivery> {
  const messageId = opts.messageId || crypto.randomUUID();
  return withTimeout(
    deliverInternal({ ...opts, messageId }).then(() => ({ messageId })),
    DELIVERY_TIMEOUT_MS,
    'smtp delivery timeout'
  );
}