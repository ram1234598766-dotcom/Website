import { BookOpen, PlayCircle, FileText, ChevronRight, Search, Terminal, Code, Cpu, Copy, Check } from 'lucide-react';
import React, { useState } from 'react';

const LION_SNIPPETS = [
  {
    title: "Example 1: Hello World Server",
    code: `Server.init(Protocol: "HTTP")\nServer.route(Path: "/", Response: "Hello World")\nServer.listen(Port: 3000)`
  },
  {
    title: "Example 2: Neural Net Instantiation",
    code: `Net.create(Layers: [128, 64, 10], Activation: "ReLU")\nNet.compile(Loss: "CrossEntropy", Optimizer: "Adam")`
  },
  {
    title: "Example 3: Decentralized Mesh Join",
    code: `Mesh.connect(Network: "OpenLayer-Global")\nMesh.broadcast(Message: "Node Online", Signed: 1)`
  },
  {
    title: "Example 4: Secure Data Vault",
    code: `Vault.open(Name: "User_Secrets")\nVault.store(Key: "API_KEY", Value: "xxx", Encryption: "AES-256")`
  },
  {
    title: "Example 5: Homomorphic Addition",
    code: `Math.FHE_Add(CipherA: 10482, CipherB: 99312)\nMath.decrypt(Result: "CipherSum")`
  },
  {
    title: "Example 6: API Fetcher",
    code: `Http.get(URL: "https://api.github.com/users", Timeout: 5000)\nData.parse(Format: "JSON")`
  },
  {
    title: "Example 7: File System I/O",
    code: `File.write(Path: "config.json", Content: "{\\"env\\": \\"prod\\"}")\nFile.setPermissions(Path: "config.json", Mode: "Read-Only")`
  },
  {
    title: "Example 8: Watchdog Policy",
    code: `ThreatWatchdog.definePolicy(Type: "XSS", Action: "Block")\nThreatWatchdog.definePolicy(Type: "SQLi", Action: "Block")\nThreatWatchdog.enable(Status: "Active")`
  },
  {
    title: "Example 9: UI Component Build",
    code: `UI.createComponent(Name: "Button", Type: "Primary")\nUI.style(Component: "Button", Color: "Emerald", Rounded: "Full")`
  },
  {
    title: "Example 10: Omni-Database Sync",
    code: `DB.connect(Driver: "Postgres", URI: "env.DATABASE_URL")\nDB.syncSchema(Force: 0)\nDB.watch(Table: "users", Callback: "onUserChange")`
  },
  {
    title: "Example 11: Real-Time WebSocket Channel",
    code: `Socket.open(Channel: "MarketData")\nSocket.onEvent(Event: "TICK", Callback: "updateTicker")\nSocket.broadcast(Payload: "Ready")`
  },
  {
    title: "Example 12: Machine Learning K-Means Clustering",
    code: `ML.cluster(Algorithm: "KMeans", Clusters: 5)\nML.fit(Dataset: "CustomerProfiles")\nML.exportModel(Format: "ONNX")`
  },
  {
    title: "Example 13: Quantum Circuit Simulator",
    code: `Quantum.initQubits(Count: 4)\nQuantum.applyGate(Gate: "Hadamard", Qubit: 0)\nQuantum.measureAll(Output: "BinaryVector")`
  },
  {
    title: "Example 14: Data Visualization (D3)",
    code: `Chart.create(Type: "ScatterPlot", Theme: "Midnight")\nChart.bindData(Source: "Sales2025")\nChart.render(Target: "DashboardRoot")`
  },
  {
    title: "Example 15: Blockchain Node Initialization",
    code: `Chain.initNode(Protocol: "Ethereum_L2")\nChain.syncLedger(GenesisBlock: "0x0000000000")\nChain.startMiner(Threads: 8)`
  }
];

const SnippetBlock: React.FC<{ title: string, code: string }> = ({ title, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden group">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
        <div className="text-sm font-bold text-slate-700">{title}</div>
        <button 
          onClick={handleCopy}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-4 bg-slate-900 text-indigo-300 font-mono text-sm overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

export default function Learn() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-in fade-in duration-500 pb-16">
      <div className="text-center space-y-4 py-8">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Lion Language Guide</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">Master the Lion programming language, the universal omni-language for AI mesh networking and full-stack development.</p>
      </div>

      {/* Guide Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 p-6">
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-indigo-600" /> Comprehensive Lion Specification
          </h3>
        </div>
        
        <div className="p-6 md:p-10 space-y-12">
          
          <section className="space-y-4">
            <h4 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">1. Core Philosophy</h4>
            <p className="text-slate-600 leading-relaxed">
              Lion is an <strong>omni-language</strong> designed to compile natively into any major programming language (Python, Rust, JavaScript, TypeScript, Go). It operates on a universal Abstract Syntax Tree (AST) model and prioritizes clarity, extreme modularity, and security via deep integration with Fully Homomorphic Encryption (FHE).
            </p>
          </section>

          <section className="space-y-4">
            <h4 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">2. Syntax Rules & Structure</h4>
            <ul className="list-disc list-inside text-slate-600 space-y-2 leading-relaxed">
              <li><strong>Dot-Method Chaining:</strong> All commands follow a strict `Object.method()` or `Object.method(Param: Value)` structure.</li>
              <li><strong>Named Parameters:</strong> Parameters must always be named with a colon (`:`). Unnamed parameters are not permitted in core API calls.</li>
              <li><strong>Blocks:</strong> Nested logic uses curly braces `{}`.</li>
              <li><strong>No Semicolons:</strong> Statements are separated by newlines.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h4 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">3. Cheat Sheet & Quick Reference</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Basic Initialization</div>
                <pre className="text-emerald-400 font-mono text-sm leading-relaxed">
                  App.build(UI: "Sleek", Theme: "Dark")<br/>
                  Server.start(Port: 8080)<br/>
                </pre>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Model Training</div>
                <pre className="text-emerald-400 font-mono text-sm leading-relaxed">
                  Model.train(<br/>
                  &nbsp;&nbsp;Data: "Corpus_1",<br/>
                  &nbsp;&nbsp;Architecture: "LLM"<br/>
                  )
                </pre>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">FHE Security</div>
                <pre className="text-emerald-400 font-mono text-sm leading-relaxed">
                  Data.encrypt(Algorithm: "FHE", KeySize: 4096)<br/>
                  ThreatWatchdog.enable(Status: "Active")
                </pre>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">CLI Commands</div>
                <pre className="text-emerald-400 font-mono text-sm leading-relaxed">
                  lion run main.lion<br/>
                  lion compile --target=Rust main.lion<br/>
                  lion install numpy_sim<br/>
                  lion secure --fhe
                </pre>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h4 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-2">4. Top 15 Copy-Paste Examples</h4>
            
            <div className="space-y-4">
              {LION_SNIPPETS.map((snippet, idx) => (
                <SnippetBlock key={idx} title={snippet.title} code={snippet.code} />
              ))}

            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
