import { Play, FileCode, Cpu, ArrowDown, CloudUpload, Activity, FolderTree, Network, Settings, Terminal, Database, Sparkles, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const INITIAL_CODE = `import Lion.Vision
import Lion.Attention

// Define a state-of-the-art vision model with minimal boilerplate
network AdvancedVisionBrain {
  input: Vision.Image(resolution=224, channels=3)

  // The Lion flow syntax: Automatic dimension inference
  flow:
    Vision.ResNet(depth=50, pretrained="imagenet")
    >> Attention.SelfAttention(heads=8, dim=512)
    >> Dense(1024, activation="mish")
    >> Dropout(0.3)
    >> Softmax(1000)

  optimizer: AdamW(lr=1e-4, weight_decay=0.01)
  loss: CrossEntropy()
}

// Deploy to distributed cluster with one command
run train_cluster(AdvancedVisionBrain, dataset="ImageNet", gpus=4)
`;

export default function LionSuite() {
  const [code, setCode] = useState(INITIAL_CODE);
  const [output, setOutput] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'graph' | 'metrics'>('editor');
  const [runStatus, setRunStatus] = useState<'idle' | 'compiling' | 'training' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState({ epoch: 0, loss: 2.4500, accuracy: 12.50 });
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let interval: any;
    if (runStatus === 'training') {
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setRunStatus('completed');
            setOutput(prev => [...prev, '✓ Training completed successfully.', '✓ Model weights saved to cloud vault (Version: v1.0.4).']);
            return 100;
          }
          return p + 1;
        });
        setMetrics(m => ({
          epoch: Math.floor(progress / 1) + 1, // mapping 0-100 to 1-100 epochs
          loss: Math.max(0.0412, m.loss * 0.965),
          accuracy: Math.min(99.8, m.accuracy + 0.95)
        }));
      }, 60); // 6 seconds total training animation
    }
    return () => clearInterval(interval);
  }, [runStatus, progress]);

  const handleRun = () => {
    if (runStatus === 'compiling' || runStatus === 'training') return;
    setRunStatus('compiling');
    setActiveTab('metrics');
    setProgress(0);
    setMetrics({ epoch: 1, loss: 2.4500, accuracy: 12.50 });
    setOutput(['> Initializing Lion compiler v2.0...', '> Parsing network topology...', '> Allocating 4x A100 GPU cluster (EU-West-1)...']);
    
    setTimeout(() => {
      setOutput(prev => [...prev, '✓ Cluster allocated and optimized via TensorRT.', '> Starting distributed training loop...']);
      setRunStatus('training');
    }, 1500);
  };

  const handleExport = () => {
    if (isExporting) return;
    setIsExporting(true);
    setOutput(prev => [...prev, '> Connecting to OpenLayer Cloud...', '> Authenticating secure session...']);
    
    setTimeout(() => {
      setOutput(prev => [...prev, '> Uploading Lion schema to private vault...']);
    }, 800);
    
    setTimeout(() => {
      setOutput(prev => [...prev, '✓ Successfully exported to project: "advanced-vision-core"']);
      setIsExporting(false);
    }, 1800);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b border-slate-200 pb-6 mt-2">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full mb-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-700">Lion IDE Pro</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Lion Language Suite</h2>
          <p className="text-slate-600 max-w-2xl text-base">
            Write ultra-concise, high-performance neural networks. Lion handles dimension inference, hardware optimization, and distributed cluster deployment natively.
          </p>
        </div>
      </div>

      {/* IDE Container */}
      <div className="bg-[#0D1117] rounded-2xl border border-slate-800 shadow-2xl flex flex-col lg:flex-row overflow-hidden min-h-[750px] text-slate-300 font-sans">
        
        {/* Left Sidebar - Explorer */}
        <div className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#161B22] flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FolderTree className="w-4 h-4" /> Workspace
            </span>
          </div>
          <div className="flex-1 p-3 space-y-1.5">
            <div className="px-3 py-2 bg-indigo-500/10 text-indigo-400 rounded-lg text-sm font-medium flex items-center gap-2 border border-indigo-500/20 cursor-pointer">
              <FileCode className="w-4 h-4" /> main.lion
            </div>
            <div className="px-3 py-2 hover:bg-slate-800/50 text-slate-400 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors">
              <Database className="w-4 h-4" /> imagenet_cfg.yaml
            </div>
            <div className="px-3 py-2 hover:bg-slate-800/50 text-slate-400 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors">
              <Settings className="w-4 h-4" /> cluster_env.toml
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0D1117]">
          {/* Editor Tabs */}
          <div className="h-14 bg-[#0D1117] flex items-center border-b border-slate-800 overflow-x-auto hide-scrollbar shrink-0">
            <button 
              onClick={() => setActiveTab('editor')}
              className={`px-6 h-full flex items-center gap-2 border-r border-slate-800 transition-colors ${activeTab === 'editor' ? 'bg-[#1F242C] text-indigo-400 border-t-2 border-t-indigo-500' : 'hover:bg-[#161B22] text-slate-400'}`}
            >
              <FileCode className="w-4 h-4"/> main.lion
            </button>
            <button 
              onClick={() => setActiveTab('graph')}
              className={`px-6 h-full flex items-center gap-2 border-r border-slate-800 transition-colors ${activeTab === 'graph' ? 'bg-[#1F242C] text-emerald-400 border-t-2 border-t-emerald-500' : 'hover:bg-[#161B22] text-slate-400'}`}
            >
              <Network className="w-4 h-4"/> Architecture Graph
            </button>
            <button 
              onClick={() => setActiveTab('metrics')}
              className={`px-6 h-full flex items-center gap-2 border-r border-slate-800 transition-colors ${activeTab === 'metrics' ? 'bg-[#1F242C] text-amber-400 border-t-2 border-t-amber-500' : 'hover:bg-[#161B22] text-slate-400'}`}
            >
              <Activity className="w-4 h-4"/> Training Metrics
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 relative flex flex-col overflow-hidden">
            {activeTab === 'editor' && (
              <div className="flex-1 flex overflow-auto">
                <div className="w-12 shrink-0 py-6 text-right pr-4 text-slate-700 font-mono text-sm select-none border-r border-slate-800/50 bg-[#0D1117]">
                  {code.split('\\n').map((_, i) => <div key={i} className="h-7">{i + 1}</div>)}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 p-6 py-6 bg-transparent font-mono text-sm resize-none focus:outline-none text-slate-200"
                  spellCheck="false"
                  style={{ lineHeight: '1.75rem', minHeight: '100%' }}
                />
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="flex-1 overflow-y-auto p-10 flex flex-col items-center bg-[#0a0d12] inset-shadow-sm">
                <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 w-full max-w-lg">
                  
                  <div className="w-full px-6 py-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col items-center shadow-lg">
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Input Layer</span>
                    <span className="font-mono text-slate-200">Vision.Image(224, 224, 3)</span>
                  </div>
                  
                  <div className="h-8 w-px bg-slate-700 relative">
                    <ArrowDown className="absolute -bottom-3 -translate-x-1/2 left-1/2 w-4 h-4 text-slate-500" />
                  </div>
                  
                  <div className="w-full px-6 py-4 bg-indigo-900/40 border border-indigo-700/50 rounded-2xl flex flex-col items-center shadow-lg">
                    <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">Feature Extractor</span>
                    <span className="font-mono text-slate-200 font-bold">Vision.ResNet</span>
                    <span className="font-mono text-indigo-300/80 text-xs mt-2">depth=50, weights="imagenet"</span>
                  </div>

                  <div className="h-8 w-px bg-slate-700 relative">
                    <ArrowDown className="absolute -bottom-3 -translate-x-1/2 left-1/2 w-4 h-4 text-slate-500" />
                  </div>

                  <div className="w-full px-6 py-4 bg-purple-900/40 border border-purple-700/50 rounded-2xl flex flex-col items-center shadow-lg">
                    <span className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Attention Mechanism</span>
                    <span className="font-mono text-slate-200 font-bold">Attention.SelfAttention</span>
                    <span className="font-mono text-purple-300/80 text-xs mt-2">heads=8, dim=512</span>
                  </div>

                  <div className="h-8 w-px bg-slate-700 relative">
                    <ArrowDown className="absolute -bottom-3 -translate-x-1/2 left-1/2 w-4 h-4 text-slate-500" />
                  </div>

                  <div className="w-full px-6 py-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col items-center shadow-lg">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Dense Representation</span>
                    <span className="font-mono text-slate-200">Dense(1024, act="mish")</span>
                  </div>

                  <div className="h-8 w-px bg-slate-700 relative">
                    <ArrowDown className="absolute -bottom-3 -translate-x-1/2 left-1/2 w-4 h-4 text-slate-500" />
                  </div>

                  <div className="w-full px-6 py-4 bg-amber-900/40 border border-amber-700/50 rounded-2xl flex flex-col items-center shadow-lg">
                    <span className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">Regularization</span>
                    <span className="font-mono text-slate-200">Dropout(0.3)</span>
                  </div>

                  <div className="h-8 w-px bg-slate-700 relative">
                    <ArrowDown className="absolute -bottom-3 -translate-x-1/2 left-1/2 w-4 h-4 text-slate-500" />
                  </div>

                  <div className="w-full px-6 py-4 bg-emerald-900/40 border border-emerald-700/50 rounded-2xl flex flex-col items-center shadow-lg">
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Output & Loss</span>
                    <span className="font-mono text-slate-200 font-bold mb-1">Softmax(1000)</span>
                    <span className="font-mono text-emerald-300/80 text-xs">CrossEntropy()</span>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="flex-1 p-6 md:p-10 flex flex-col gap-6 bg-[#0a0d12] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 shrink-0">
                  <div className="bg-slate-800/40 border border-slate-700/60 p-6 rounded-2xl shadow-inner">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Current Epoch</div>
                    <div className="text-4xl font-black text-white">{metrics.epoch}<span className="text-lg font-medium text-slate-500">/100</span></div>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700/60 p-6 rounded-2xl shadow-inner">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Validation Loss</div>
                    <div className="text-4xl font-black text-amber-400">{metrics.loss.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700/60 p-6 rounded-2xl shadow-inner">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Accuracy</div>
                    <div className="text-4xl font-black text-emerald-400">{metrics.accuracy.toFixed(2)}%</div>
                  </div>
                </div>

                <div className="flex-1 bg-slate-800/20 border border-slate-700/50 rounded-2xl p-6 md:p-8 flex flex-col min-h-[250px]">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                    <div>
                      <h3 className="text-slate-200 font-bold text-lg">Cluster Progress</h3>
                      <p className="text-slate-500 text-sm mt-1">4x NVIDIA A100 (80GB) &bull; Distributed Data Parallel</p>
                    </div>
                    <span className="text-indigo-400 font-mono font-bold text-xl">{progress}%</span>
                  </div>
                  
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-300 ease-out rounded-full" style={{width: `${progress}%`}}></div>
                  </div>
                  
                  <div className="mt-auto pt-8">
                    {runStatus === 'idle' && (
                      <div className="text-slate-500 font-mono text-sm text-center">Ready to allocate cluster resources.</div>
                    )}
                    {runStatus === 'compiling' && (
                      <div className="flex items-center justify-center gap-3 text-indigo-400 animate-pulse">
                        <Cpu className="w-5 h-5" />
                        <span className="font-mono text-sm">Allocating node resources and compiling computation graph...</span>
                      </div>
                    )}
                    {runStatus === 'training' && (
                      <div className="flex items-center justify-center gap-3 text-amber-400 animate-pulse">
                        <Activity className="w-5 h-5" />
                        <span className="font-mono text-sm">Epoch {metrics.epoch}/100 &bull; Processing Batch 1,024/4,500 &bull; 4,120 img/s</span>
                      </div>
                    )}
                    {runStatus === 'completed' && (
                      <div className="flex items-center justify-center gap-3 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-mono text-sm font-bold">Training complete! Model converged successfully.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Actions & Console */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#161B22] flex flex-col shrink-0">
          <div className="p-5 flex flex-col gap-4 border-b border-slate-800 bg-[#161B22] shadow-sm z-10">
            <button
              onClick={handleRun}
              disabled={runStatus === 'compiling' || runStatus === 'training'}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/30 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20 active:scale-95 disabled:active:scale-100"
            >
              {runStatus === 'compiling' || runStatus === 'training' ? <Activity className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {runStatus === 'idle' ? 'Run Cluster Training' : runStatus === 'completed' ? 'Re-run Training' : 'Training Active...'}
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-colors active:scale-95 disabled:active:scale-100"
            >
              {isExporting ? <Activity className="w-5 h-5 animate-spin text-slate-400" /> : <CloudUpload className="w-5 h-5 text-slate-400" />} 
              Export to Cloud Vault
            </button>
          </div>
          <div className="flex-1 flex flex-col bg-[#0a0d12] min-h-[250px]">
            <div className="p-4 border-b border-slate-800/50 bg-[#0a0d12]/90 sticky top-0 backdrop-blur-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4"/> Compiler Output
              </h3>
            </div>
            <div className="flex-1 p-4 font-mono text-[11px] leading-loose overflow-y-auto text-slate-400 space-y-1.5">
              {output.length === 0 && (
                <div className="text-slate-600 italic">No output. Waiting for compilation...</div>
              )}
              {output.map((line, idx) => (
                <div key={idx} className={line.startsWith('✓') ? 'text-emerald-400 font-semibold' : line.startsWith('>') ? 'text-indigo-300' : 'text-slate-300'}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
