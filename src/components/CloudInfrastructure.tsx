import { Server, Cpu, HardDrive, Network, Zap, CheckCircle2 } from 'lucide-react';

export default function CloudInfrastructure() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full mb-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">100% Free Forever Tier</span>
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Global Free Cloud Infrastructure</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          We believe AI compute is a fundamental right. Our distributed cloud infrastructure allows any developer to deploy custom models at near-zero cost.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Compute', value: '2 vCPU', sub: 'Burstable up to 4x', icon: <Cpu className="w-5 h-5 text-indigo-500" /> },
          { title: 'Memory', value: '8 GB RAM', sub: 'High-speed DDR5', icon: <HardDrive className="w-5 h-5 text-indigo-500" /> },
          { title: 'Accelerator', value: '1x T4 GPU', sub: 'Time-sliced sharing', icon: <Zap className="w-5 h-5 text-amber-500" /> },
          { title: 'Bandwidth', value: '100 GB/mo', sub: 'Global CDN edges', icon: <Network className="w-5 h-5 text-emerald-500" /> },
        ].map((spec, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-start gap-3">
            <div className="p-2 bg-slate-50 rounded-lg">{spec.icon}</div>
            <div>
              <p className="text-sm font-medium text-slate-500">{spec.title}</p>
              <p className="text-2xl font-bold text-slate-900">{spec.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{spec.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 md:p-12 text-white overflow-hidden relative shadow-2xl">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-2xl font-bold mb-4">Zero-Friction Deployment</h3>
            <p className="text-slate-300 leading-relaxed mb-8">
              Deploying a model shouldn't require DevOps expertise. With OpenLayer, you can deploy a Lion model to our edge network with a single command. The infrastructure automatically handles load balancing, cold starts, and hardware acceleration.
            </p>
            <div className="space-y-4">
              {[
                'Automated Docker containerization',
                'Native ONNX/TensorRT optimization',
                'Global Edge routing (Sub 50ms latency)',
                'DDoS protection included'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-200">{feature}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 backdrop-blur-md font-mono text-sm shadow-xl">
            <div className="flex gap-2 mb-4 border-b border-slate-700 pb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
            </div>
            <div className="text-slate-300 space-y-2">
              <p><span className="text-indigo-400">$</span> lion deploy ./my-model</p>
              <p className="text-slate-500">&gt; Analyzing model architecture...</p>
              <p className="text-slate-500">&gt; Optimizing for T4 GPU...</p>
              <p className="text-slate-500">&gt; Provisioning container...</p>
              <p className="text-emerald-400 mt-4 font-bold">✓ Deployed successfully in 4.2s</p>
              <p className="text-indigo-300 mt-2 hover:underline cursor-pointer">https://api.openlayer.cloud/v1/m/my-model</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
      </div>
    </div>
  );
}
