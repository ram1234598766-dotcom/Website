import { Shield, Lock, ShieldCheck, Activity, Key, Database, ChevronRight, Share2, Terminal, RefreshCw, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';

// Toy Integer FHE Scheme (DGHV inspired)
// Secret key p (large prime), but we use a small one for demo
const p = 137;

function fheEncrypt(m: number): number {
  // m must be 0 or 1
  const q = Math.floor(Math.random() * 100) + 1; // random q
  const r = Math.floor(Math.random() * 3); // small noise r
  return q * p + 2 * r + m;
}

function fheDecrypt(c: number): number {
  return (c % p) % 2;
}

export default function FortressMode() {
  const [pipelineState, setPipelineState] = useState<'idle' | 'encrypting' | 'routing' | 'secure'>('idle');
  const [demoState, setDemoState] = useState<'input' | 'encrypted' | 'computed' | 'decrypted'>('input');
  const [bit1, setBit1] = useState<number>(0);
  const [bit2, setBit2] = useState<number>(1);
  const [c1, setC1] = useState<number | null>(null);
  const [c2, setC2] = useState<number | null>(null);
  const [cSum, setCSum] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    let timeout1: any;
    let timeout2: any;
    let timeout3: any;

    if (pipelineState === 'encrypting') {
      timeout1 = setTimeout(() => setPipelineState('routing'), 2000);
      timeout2 = setTimeout(() => setPipelineState('secure'), 4000);
      timeout3 = setTimeout(() => setPipelineState('idle'), 8000);
    }

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, [pipelineState]);

  const runToyFHE = () => {
    // Encrypt
    const cipher1 = fheEncrypt(bit1);
    const cipher2 = fheEncrypt(bit2);
    setC1(cipher1);
    setC2(cipher2);
    setDemoState('encrypted');
  };

  const computeToyFHE = () => {
    // Compute on ciphertext (Addition)
    if (c1 !== null && c2 !== null) {
      setCSum(c1 + c2);
      setDemoState('computed');
    }
  };

  const decryptToyFHE = () => {
    if (cSum !== null) {
      setResult(fheDecrypt(cSum));
      setDemoState('decrypted');
    }
  };

  return (
    <div className="flex flex-col gap-10 w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col items-center text-center gap-6 py-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">Quantum-Secure FHE</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 drop-shadow-md">
          Fortress Mode
        </h1>
        
        <p className="text-xl text-slate-600 max-w-3xl leading-relaxed">
          OpenLayer uses <span className="text-emerald-600 font-bold">Fully Homomorphic Encryption (FHE)</span>. Your data is mathematically encrypted on your local machine before touching the global mesh. We never see it, we never decrypt it.
        </p>
      </div>

      {/* Visual Pipeline */}
      <div className="bg-[#0a0d12] rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl relative overflow-hidden">
        
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col items-center gap-12">
          
          <button 
            onClick={() => setPipelineState('encrypting')}
            disabled={pipelineState !== 'idle'}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50 disabled:text-emerald-600 text-white font-bold rounded-xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-95 disabled:active:scale-100 flex items-center gap-3"
          >
            {pipelineState !== 'idle' ? <Activity className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
            {pipelineState === 'idle' ? 'Simulate FHE Pipeline' : 'Pipeline Active...'}
          </button>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl relative">
            
            {/* Connecting Lines (Desktop) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-slate-800 -translate-y-1/2 z-0 rounded-full overflow-hidden">
              <div className={`h-full bg-emerald-500 transition-all duration-[2000ms] ease-linear ${pipelineState === 'idle' ? 'w-0' : pipelineState === 'encrypting' ? 'w-1/2' : 'w-full'}`}></div>
            </div>

            {/* Step 1: Raw Data */}
            <div className={`bg-slate-900 border ${pipelineState === 'encrypting' ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'border-slate-700'} p-6 rounded-2xl flex flex-col items-center text-center gap-4 relative z-10 transition-all`}>
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                <Database className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Local Data</h3>
                <p className="text-xs text-slate-400">Raw tensors (Plaintext)</p>
              </div>
              {pipelineState === 'encrypting' && (
                <div className="absolute inset-0 border-2 border-indigo-500 rounded-2xl animate-pulse"></div>
              )}
            </div>

            {/* Step 2: FHE Encryption */}
            <div className={`bg-slate-900 border ${pipelineState === 'routing' ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : pipelineState === 'secure' ? 'border-emerald-500' : 'border-slate-700'} p-6 rounded-2xl flex flex-col items-center text-center gap-4 relative z-10 transition-all`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${pipelineState === 'routing' ? 'bg-amber-900/50' : pipelineState === 'secure' ? 'bg-emerald-900/50' : 'bg-slate-800'}`}>
                {pipelineState === 'secure' ? <ShieldCheck className="w-8 h-8 text-emerald-400" /> : <Key className={`w-8 h-8 ${pipelineState === 'routing' ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />}
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Quantum Encryption</h3>
                <p className="text-xs text-slate-400">4096-bit Lattice Cryptography</p>
              </div>
            </div>

            {/* Step 3: Global Mesh */}
            <div className={`bg-slate-900 border ${pipelineState === 'secure' ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-slate-700'} p-6 rounded-2xl flex flex-col items-center text-center gap-4 relative z-10 transition-all`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${pipelineState === 'secure' ? 'bg-emerald-900/50' : 'bg-slate-800'}`}>
                <Share2 className={`w-8 h-8 ${pipelineState === 'secure' ? 'text-emerald-400' : 'text-slate-400'}`} />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">P2P Mesh Training</h3>
                <p className="text-xs text-slate-400">Computing on Ciphertext</p>
              </div>
            </div>

          </div>
          
          <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-800 w-full max-w-4xl font-mono text-sm text-slate-400">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-emerald-500" /> 
              <span className="text-emerald-500 font-bold uppercase tracking-wider text-xs">Security Log</span>
            </div>
            {pipelineState === 'idle' && <div>Waiting for pipeline initiation...</div>}
            {pipelineState === 'encrypting' && <div className="text-indigo-400">&gt; Generating post-quantum lattice keys... Encrypting local tensors...</div>}
            {pipelineState === 'routing' && <div className="text-amber-400">&gt; Tensors encrypted. Distributing FHE ciphertext shards to Global Mesh...</div>}
            {pipelineState === 'secure' && <div className="text-emerald-400">&gt; Mesh is computing gradient updates natively on ciphertext. Zero data leakage.</div>}
          </div>

        </div>
      </div>
      
      {/* Interactive FHE Sandbox */}
      <div className="bg-[#161B22] border border-slate-800 rounded-3xl p-8 max-w-4xl mx-auto w-full shadow-2xl flex flex-col gap-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-500"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              <Key className="w-6 h-6 text-emerald-400" /> Live FHE Sandbox
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-lg">
              Verify the math yourself. Encrypt two plaintext bits, compute their addition homomorphically on the ciphertext, and decrypt to get the correct result without ever exposing the underlying data.
            </p>
          </div>
          <button 
            onClick={() => {
              setDemoState('input');
              setC1(null);
              setC2(null);
              setCSum(null);
              setResult(null);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Reset Sandbox
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Plaintext Input */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
            <h3 className="text-slate-200 font-bold border-b border-slate-800 pb-2 text-sm uppercase tracking-wider">1. Plaintext</h3>
            <div className="flex flex-col gap-3">
              <label className="text-xs text-slate-400 font-bold flex items-center justify-between">
                Bit A:
                <select 
                  disabled={demoState !== 'input'}
                  value={bit1}
                  onChange={(e) => setBit1(parseInt(e.target.value))}
                  className="bg-slate-800 text-white rounded p-1 px-2 focus:outline-none border border-slate-600"
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                </select>
              </label>
              <label className="text-xs text-slate-400 font-bold flex items-center justify-between">
                Bit B:
                <select 
                  disabled={demoState !== 'input'}
                  value={bit2}
                  onChange={(e) => setBit2(parseInt(e.target.value))}
                  className="bg-slate-800 text-white rounded p-1 px-2 focus:outline-none border border-slate-600"
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                </select>
              </label>
            </div>
            {demoState === 'input' && (
              <button 
                onClick={runToyFHE}
                className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow-md transition-colors"
              >
                Encrypt
              </button>
            )}
          </div>

          {/* Ciphertexts */}
          <div className={`bg-slate-900 border ${demoState === 'encrypted' ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-slate-700'} rounded-xl p-5 flex flex-col gap-4`}>
            <h3 className="text-slate-200 font-bold border-b border-slate-800 pb-2 text-sm uppercase tracking-wider">2. Ciphertext</h3>
            <div className="flex flex-col gap-3 font-mono text-[10px] text-indigo-300 break-all">
              <div><span className="text-slate-500">E(A) = </span> {c1 !== null ? c1 : '???'}</div>
              <div><span className="text-slate-500">E(B) = </span> {c2 !== null ? c2 : '???'}</div>
            </div>
            {demoState === 'encrypted' && (
              <button 
                onClick={computeToyFHE}
                className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow-md transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add E(A) + E(B)
              </button>
            )}
          </div>

          {/* Computation */}
          <div className={`bg-slate-900 border ${demoState === 'computed' ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-slate-700'} rounded-xl p-5 flex flex-col gap-4`}>
            <h3 className="text-slate-200 font-bold border-b border-slate-800 pb-2 text-sm uppercase tracking-wider">3. Mesh Compute</h3>
            <div className="font-mono text-[10px] text-amber-400 break-all">
              <span className="text-slate-500 block mb-1">E(Sum) = E(A) + E(B)</span>
              {cSum !== null ? cSum : '???'}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              The mesh server added the ciphertexts together. It does not know the values of A, B, or the Sum.
            </p>
            {demoState === 'computed' && (
              <button 
                onClick={decryptToyFHE}
                className="mt-auto w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow-md transition-colors"
              >
                Decrypt locally
              </button>
            )}
          </div>

          {/* Decryption */}
          <div className={`bg-slate-900 border ${demoState === 'decrypted' ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-slate-700'} rounded-xl p-5 flex flex-col gap-4`}>
            <h3 className="text-slate-200 font-bold border-b border-slate-800 pb-2 text-sm uppercase tracking-wider">4. Result</h3>
            <div className="flex-1 flex flex-col items-center justify-center">
              {result !== null ? (
                <div className="text-center">
                  <div className="text-4xl font-black text-emerald-400 mb-1">{result}</div>
                  <div className="text-[10px] font-mono text-emerald-600/50">Decrypted value</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-2 block">
                    Expected: {bit1} + {bit2} = {(bit1 + bit2) % 2} (mod 2)
                  </div>
                </div>
              ) : (
                <Lock className="w-8 h-8 text-slate-700" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
