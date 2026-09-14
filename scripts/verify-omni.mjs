#!/usr/bin/env node
/**
 * verify-omni.mjs — verify HuggingFace reachability for the Omni AI WebModel
 * provider (VantaOS). Server-side bare GET/HEAD probes with a neutral
 * User-Agent; prints status, Access-Control-Allow-Origin, Content-Length,
 * and whether the body is real JSON config vs an error page.
 *
 * Run: node scripts/verify-omni.mjs
 */

const UA = 'VantaOS-model-reachability-verify/1.0 (n/a)';
const TIMEOUT_MS = 15000;
const RANGE = 'bytes=0-4095';

function headers(extra = {}) {
  return { 'User-Agent': UA, ...extra };
}

function looksLike(text) {
  const head = text.trimStart();
  if (head.startsWith('{') || head.startsWith('[')) {
    try {
      const parsed = JSON.parse(head);
      if (parsed && typeof parsed === 'object' && parsed.error) return 'json-error';
      return 'json';
    } catch {
      return 'json??';
    }
  }
  if (head.startsWith('<')) return 'html-error-page';
  return 'binary/other';
}

async function probe(url, { method = 'GET', range = false, decode = false } = {}) {
  const started = Date.now();
  const res = await fetch(url, {
    method,
    headers: headers(range ? { Range: RANGE } : {}),
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ms = Date.now() - started;
  let bytes = null;
  let bodyType = null;
  if (method === 'GET') {
    const buf = await res.arrayBuffer();
    bytes = buf.byteLength;
    bodyType = looksLike(new TextDecoder().decode(buf.slice(0, 4096)));
  }
  return {
    url,
    status: res.status,
    cors: res.headers.get('access-control-allow-origin') ?? '(none)',
    contentType: res.headers.get('content-type') ?? '(none)',
    contentLength: res.headers.get('content-length') ?? '(none)',
    bytesRead: bytes,
    bodyType,
    ms,
  };
}

async function probeSize(url) {
  const started = Date.now();
  const res = await fetch(url, {
    method: 'HEAD',
    headers: headers(),
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ms = Date.now() - started;
  return {
    url,
    status: res.status,
    cors: res.headers.get('access-control-allow-origin') ?? '(none)',
    contentLength: res.headers.get('content-length') ?? '(none)',
    bytesRead: null,
    ms,
  };
}

async function probeApi(url) {
  const started = Date.now();
  const res = await fetch(url, { headers: headers(), redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  const ms = Date.now() - started;
  const buf = await res.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return {
    url,
    status: res.status,
    cors: res.headers.get('access-control-allow-origin') ?? '(none)',
    contentLength: res.headers.get('content-length') ?? '(none)',
    bytesRead: buf.byteLength,
    isJson: parsed !== null,
    parsed,
    ms,
  };
}

function fmtBytes(n) {
  if (n === null || n === undefined) return 'n/a';
  return `${(n / 1048576).toFixed(1)} MB (${n.toLocaleString()} bytes)`;
}

function line(r) {
  const out = [
    `URL:        ${r.url}`,
    `HTTP:       ${r.status}`,
    `CORS:       ${r.cors}`,
    `Content-Type: ${r.contentType}`,
    `Content-Length: ${r.contentLength}`,
    `Bytes read: ${r.bytesRead ?? 'n/a'}`,
  ];
  if (r.bodyType) out.push(`Body:       ${r.bodyType}`);
  out.push(`Latency:    ${r.ms} ms`);
  return out.join('\n');
}

console.log('=== Omni WebModel — HuggingFace reachability probes ===\n');

const results = {};

try {
  const r = await probe('https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/config.json');
  results.flag4 = r;
  console.log('--- 1. onnx-community/SmolLM2-135M-ONNX config.json ---');
  console.log(line(r));
} catch (e) {
  console.log(`--- 1. onnx-community/SmolLM2-135M-ONNX config.json ---\nFAILED: ${e.message}`);
}
console.log();

try {
  const api = await probeApi('https://huggingface.co/api/models/onnx-community/SmolLM2-135M-ONNX');
  results.flag1 = api;
  console.log('--- 2a. api/models/onnx-community/SmolLM2-135M-ONNX (file listing) ---');
  const listing = [
    `URL:        ${api.url}`,
    `HTTP:       ${api.status}`,
    `CORS:       ${api.cors}`,
    `Bytes read: ${api.bytesRead}`,
    api.parsed ? `gated:  ${api.parsed.gated ?? 'false'}` : '',
  ];
  console.log(listing.filter(Boolean).join('\n'));
  if (api.parsed && Array.isArray(api.parsed.siblings)) {
    console.log('siblings:');
    for (const s of api.parsed.siblings) {
      console.log(`  - ${s.rfilename}${s.size != null ? '   ' + fmtBytes(s.size) : ''}`);
    }
    const onnx = api.parsed.siblings.find((s) => /\.onnx$/i.test(s.rfilename));
    if (onnx) {
      const r = await probe(`https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/${onnx.rfilename}`, { method: 'GET', range: true });
      results.flag6 = r;
      console.log('\n--- 2b. onnx file range probe (first 4 KiB) ---');
      console.log(line(r));
    }
    const smolCandidates = ['model.onnx', 'model.onnx_data', 'model_quantized.onnx', 'model_quantized.onnx_data', 'model_q4.onnx', 'model_q4.onnx_data', 'model_q4f16.onnx', 'model_q4f16.onnx_data', 'model_fp16.onnx', 'model_fp16.onnx_data', 'model_int8.onnx', 'model_uint8.onnx'];
    const smolSizes = [];
    console.log('\n--- 2c. SmolLM2 onnx file sizes (HEAD Content-Length) ---');
    for (const f of smolCandidates) {
      if (!api.parsed.siblings.some((s) => s.rfilename === `onnx/${f}`)) { console.log(`  - onnx/${f}: (not in repo)`); continue; }
      const h = await probeSize(`https://huggingface.co/onnx-community/SmolLM2-135M-ONNX/resolve/main/onnx/${f}`);
      smolSizes.push({ file: f, size: h.contentLength });
      console.log(`  - onnx/${f}: HTTP ${h.status}  Content-Length: ${h.contentLength}`);
    }
    results.smolSizes = smolSizes;
  }
} catch (e) {
  console.log(`FAILED: ${e.message}`);
}
console.log();

try {
  const r = await probe('https://huggingface.co/Xenova/gpt2/resolve/main/config.json');
  results.flag2 = r;
  console.log('--- 3a. Xenova/gpt2 config.json ---');
  console.log(line(r));
  const api = await probeApi('https://huggingface.co/api/models/Xenova/gpt2');
  results.flag3 = api;
  console.log('\n--- 3b. api/models/Xenova/gpt2 (file listing) ---');
  const listing = [
    `URL:        ${api.url}`,
    `HTTP:       ${api.status}`,
    `CORS:       ${api.cors}`,
    `Bytes read: ${api.bytesRead}`,
    api.parsed ? `gated:  ${api.parsed.gated ?? 'false'}` : '',
  ];
  console.log(listing.filter(Boolean).join('\n'));
  if (api.parsed && Array.isArray(api.parsed.siblings)) {
    console.log('siblings:');
    for (const s of api.parsed.siblings) {
      console.log(`  - ${s.rfilename}${s.size != null ? '   ' + fmtBytes(s.size) : ''}`);
    }
    const onnx = api.parsed.siblings.find((s) => /\.onnx$/i.test(s.rfilename));
    if (onnx) {
      const r = await probe(`https://huggingface.co/Xenova/gpt2/resolve/main/${onnx.rfilename}`, { method: 'GET', range: true });
      results.flag7 = r;
      console.log('\n--- 3c. Xenova/gpt2 onnx range probe (first 4 KiB) ---');
      console.log(line(r));
    }
    const gpt2Candidates = ['decoder_model.onnx', 'decoder_model_merged.onnx', 'decoder_model_quantized.onnx', 'decoder_model_merged_quantized.onnx', 'model.onnx', 'model_fp16.onnx', 'model_int8.onnx', 'model_q4.onnx'];
    const gpt2Sizes = [];
    console.log('\n--- 3d. Xenova/gpt2 onnx file sizes (HEAD Content-Length) ---');
    for (const f of gpt2Candidates) {
      if (!api.parsed.siblings.some((s) => s.rfilename === `onnx/${f}`)) { console.log(`  - onnx/${f}: (not in repo)`); continue; }
      const h = await probeSize(`https://huggingface.co/Xenova/gpt2/resolve/main/onnx/${f}`);
      gpt2Sizes.push({ file: f, size: h.contentLength });
      console.log(`  - onnx/${f}: HTTP ${h.status}  Content-Length: ${h.contentLength}`);
    }
    results.gpt2Sizes = gpt2Sizes;
  }
} catch (e) {
  console.log(`FAILED: ${e.message}`);
}
console.log();

try {
  const r = await probe('https://huggingface.co/onnx-community/gpt-2/resolve/main/config.json');
  results.flag5 = r;
  console.log('--- 4. onnx-community/gpt-2 config.json (expected 401 gated) ---');
  console.log(line(r));
} catch (e) {
  console.log(`FAILED: ${e.message}`);
}

console.log(
  '\n=== VERDICT ===\n' +
  'Model id  -> repo pairing status (for the model ids in src/lib/models/adapter.ts):\n',
);

function verdictFor(label, good, note) {
  console.log(`- ${label}: ${good ? 'SAFE' : 'NOT SAFE'}${note ? ` — ${note}` : ''}`);
}

const s = results;
const smol = s.flag1 && s.flag1.parsed;
const xenova = s.flag3 && s.flag3.parsed;

verdictFor(
  'gpt2 (adapter maps to onnx-community/gpt-2)',
  s.flag5 && s.flag5.status === 200 && s.flag5.bodyType === 'json',
  s.flag5 ? `HTTP ${s.flag5.status} (${s.flag5.bodyType}) — ${s.flag5.status >= 400 ? 'gated/HTTP error, do not use as default' : 'unexpected'}` : 'probe failed',
);

verdictFor(
  'gpt2 -> Xenova/gpt2 (candidate replacement)',
  s.flag2 && s.flag2.status === 200 && s.flag2.bodyType === 'json',
  s.flag2 ? `config HTTP ${s.flag2.status} (${s.flag2.bodyType})` : 'probe failed',
);

verdictFor(
  'tinyllama / webmodel (adapter maps to onnx-community/SmolLM2-135M-ONNX)',
  s.flag4 && s.flag4.status === 200 && s.flag4.bodyType === 'json',
  s.flag4 ? `config HTTP ${s.flag4.status} (${s.flag4.bodyType})` : 'probe failed',
);

console.log('\nApproximate model file sizes (relevant to the ~100MB Worker response limit):');
const sizeLines = [];
function mkMegs(h) {
  const raw = typeof h.contentLength === 'string' ? parseInt(h.contentLength, 10) : NaN;
  return Number.isFinite(raw) ? raw / 1048576 : null;
}
for (const { file, size } of (results.gpt2Sizes ?? [])) {
  const mb = mkMegs({ contentLength: size });
  const note = mb === null ? 'Content-Length unknown' : (mb > 100 ? 'EXCEEDS ~100MB — would fail through the Worker' : 'within ~100MB');
  sizeLines.push(`- Xenova/gpt2 onnx/${file}: ${fmtBytes(typeof size === 'string' ? parseInt(size, 10) : size)}  [${note}]`);
}
for (const { file, size } of (results.smolSizes ?? [])) {
  const mb = mkMegs({ contentLength: size });
  const note = mb === null ? 'Content-Length unknown' : (mb > 100 ? 'EXCEEDS ~100MB — would fail through the Worker' : 'within ~100MB');
  sizeLines.push(`- onnx-community/SmolLM2-135M-ONNX onnx/${file}: ${fmtBytes(typeof size === 'string' ? parseInt(size, 10) : size)}  [${note}]`);
}
if (sizeLines.length === 0) sizeLines.push('- no size data collected');
console.log(sizeLines.join('\n'));