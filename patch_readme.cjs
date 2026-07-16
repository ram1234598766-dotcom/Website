const fs = require('fs');
let code = fs.readFileSync('README.md', 'utf8');

const target = `- **Fully Homomorphic Encryption (FHE)**: Compute on encrypted data without ever decrypting it in transit or at rest.`;
const replacement = `- **Transit & Storage Security**: All data is encrypted in transit using standard TLS, and protected at rest via Supabase Row Level Security (RLS) policies.`;

code = code.replace(target, replacement);
fs.writeFileSync('README.md', code);
