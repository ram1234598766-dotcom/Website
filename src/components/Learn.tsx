import { Tutorial } from '../types';
import { BookOpen, PlayCircle, FileText, ChevronRight, Search } from 'lucide-react';

const mockTutorials: Tutorial[] = [
  { id: '1', title: 'Introduction to Lion Syntax', level: 'Beginner', category: 'Language', readTime: '5 min' },
  { id: '2', title: 'Building your first Neural Network', level: 'Beginner', category: 'Tutorial', readTime: '12 min' },
  { id: '3', title: 'Optimizing inference on Free Cloud', level: 'Intermediate', category: 'Deployment', readTime: '8 min' },
  { id: '4', title: 'Custom CUDA kernels in Lion', level: 'Advanced', category: 'Language', readTime: '20 min' },
];

export default function Learn() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="text-center space-y-4 py-8">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Educational Hub</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">Master the Lion programming language, explore open-source model architectures, and learn how to deploy on the Free Cloud.</p>
        <div className="max-w-xl mx-auto mt-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search documentation, tutorials, and examples..." 
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { title: 'Documentation', icon: <FileText className="w-6 h-6 text-indigo-600" />, desc: 'Comprehensive API references for Lion and the OpenLayer stack.' },
          { title: 'Interactive Tutorials', icon: <PlayCircle className="w-6 h-6 text-emerald-600" />, desc: 'Step-by-step guides to building and deploying models.' },
          { title: 'Example Projects', icon: <BookOpen className="w-6 h-6 text-amber-600" />, desc: 'Open-source reference implementations and use cases.' }
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
            <p className="text-sm text-slate-600">{item.desc}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Featured Tutorials</h3>
          <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">View All</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mockTutorials.map(tutorial => (
            <div key={tutorial.id} className="flex items-center p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                    tutorial.level === 'Beginner' ? 'bg-emerald-50 text-emerald-700' :
                    tutorial.level === 'Intermediate' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {tutorial.level}
                  </span>
                  <span className="text-xs font-medium text-slate-400">{tutorial.readTime} read</span>
                </div>
                <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{tutorial.title}</h4>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
