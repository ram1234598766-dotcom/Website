const fs = require('fs');
let code = fs.readFileSync('src/components/PrivacyPolicy.tsx', 'utf8');

const target = `          <p className="mb-4">
            You retain 100% ownership of your weights, datasets, and runtime code. When you utilize the Decentralized Compute Mesh or train models using the VantaOS Platform, your data never leaves your client context unencrypted. We utilize Fully Homomorphic Encryption (FHE) to guarantee that operations are performed on mathematically encrypted state space tensors.
          </p>
          <div className="bg-[#0a0a0c] p-4 rounded-xl border border-slate-100 font-mono text-sm text-slate-600">
            <span className="block text-xs text-slate-400 mb-2">// Mathematical Guarantee of Privacy</span>
            E(m₁) ⊗ E(m₂) = E(m₁ ⊙ m₂)
          </div>`;

const replacement = `          <p className="mb-4">
            You retain 100% ownership of your data and runtime configurations. Your interactions with the platform are secured in transit via standard TLS encryption, and data stored in our database is protected using robust Row Level Security (RLS) policies in Supabase. This ensures that your private data is strictly accessible only to your authenticated user session.
          </p>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/PrivacyPolicy.tsx', code);
