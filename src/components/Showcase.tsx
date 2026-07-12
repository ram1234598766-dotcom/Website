import { AIModel } from '../types';
import { Search, Filter, Download, ExternalLink, Cpu, HardDrive } from 'lucide-react';

const mockModels: AIModel[] = [
  { id: '1', name: 'OpenChat-v1', description: 'A lightweight conversational model optimized for Edge devices.', architecture: 'Transformer (Decoder-only)', parameters: '7B', performance: 'MMLU: 68%', category: 'Language', downloads: '1.2M' },
  { id: '2', name: 'LionVision-Core', description: 'Computer vision foundation model capable of segmentation and classification.', architecture: 'ViT-Huge', parameters: '650M', performance: 'ImageNet: 89.2%', category: 'Vision', downloads: '850K' },
  { id: '3', name: 'AudioTranscription-Fast', description: 'Real-time multi-lingual audio transcription.', architecture: 'Conformer', parameters: '120M', performance: 'WER: 4.5%', category: 'Audio', downloads: '340K' },
  { id: '4', name: 'CodeAssist-Lion', description: 'Specifically trained to write and debug Lion language code.', architecture: 'Transformer', parameters: '13B', performance: 'HumanEval: 72%', category: 'Code', downloads: '2.1M' },
];

export default function Showcase() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Model Showcase</h2>
          <p className="text-slate-600 mt-1">Discover, deploy, and share open AI models.</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg shadow-md hover:bg-slate-800 transition-colors whitespace-nowrap">
          Upload Model
        </button>
      </div>

      <div className="flex gap-4 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, architecture, or category..." 
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <button className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium shadow-sm transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockModels.map(model => (
          <div key={model.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col">
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md uppercase tracking-wide">
                  {model.category}
                </span>
                <div className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                  <Download className="w-3.5 h-3.5" />
                  {model.downloads}
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{model.name}</h3>
              <p className="text-sm text-slate-600 line-clamp-2 mb-6 flex-1">{model.description}</p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
                    <Cpu className="w-3.5 h-3.5" /> Params
                  </div>
                  <div className="font-mono text-sm font-semibold text-slate-800">{model.parameters}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1 font-medium">
                    <HardDrive className="w-3.5 h-3.5" /> Arch
                  </div>
                  <div className="font-mono text-xs font-semibold text-slate-800 truncate" title={model.architecture}>{model.architecture}</div>
                </div>
              </div>

              <div className="text-xs font-medium text-slate-500 mb-4 bg-slate-50 p-2 rounded text-center border border-slate-100">
                Performance: <span className="font-bold text-slate-800">{model.performance}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50">
              <button className="py-3 text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-colors">
                View Details
              </button>
              <button className="py-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 flex justify-center items-center gap-1.5 transition-colors">
                <ExternalLink className="w-4 h-4" />
                Deploy Free
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
