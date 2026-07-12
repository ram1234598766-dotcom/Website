import { Topic } from '../types';
import { MessageSquare, ArrowUp, Plus, Search, Filter } from 'lucide-react';

const mockTopics: Topic[] = [
  { id: '1', title: 'Getting started with Lion compiler', author: 'alice_dev', replies: 34, upvotes: 142, category: 'Lion Language', timeAgo: '2h ago' },
  { id: '2', title: 'Proposal: Native support for Transformer blocks', author: 'core_team_bob', replies: 128, upvotes: 450, category: 'Feature Requests', timeAgo: '5h ago' },
  { id: '3', title: 'How to deploy models on the Free Cloud tier?', author: 'newbie101', replies: 12, upvotes: 45, category: 'Infrastructure', timeAgo: '1d ago' },
  { id: '4', title: 'Fine-tuning standard models - Best practices', author: 'ml_guru', replies: 89, upvotes: 320, category: 'Tutorials', timeAgo: '2d ago' },
  { id: '5', title: 'Data Privacy Ledger audit results (Q2)', author: 'open_governance', replies: 56, upvotes: 890, category: 'Announcements', timeAgo: '1w ago' },
];

export default function Forum() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Community Forum</h2>
          <p className="text-slate-600 mt-1">Discuss OpenLayer tools, models, and governance.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4" />
          New Discussion
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Categories Sidebar */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Categories</div>
          {['All Discussions', 'Announcements', 'Lion Language', 'Infrastructure', 'Tutorials', 'Feature Requests', 'Governance'].map((cat, i) => (
            <button 
              key={cat}
              className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${i === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              {cat}
            </button>
          ))}
        </aside>

        {/* Topics List */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search discussions..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              <Filter className="w-4 h-4" />
            </button>
          </div>
          
          <div className="divide-y divide-slate-100">
            {mockTopics.map(topic => (
              <div key={topic.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex gap-4">
                <div className="flex flex-col items-center justify-center gap-1 min-w-[3rem]">
                  <button className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <ArrowUp className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold text-slate-700">{topic.upvotes}</span>
                </div>
                
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-semibold text-slate-900 text-base leading-tight mb-1 cursor-pointer hover:text-indigo-600 transition-colors">
                    {topic.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                      {topic.category}
                    </span>
                    <span>Posted by <span className="font-medium text-slate-700">{topic.author}</span></span>
                    <span>&bull;</span>
                    <span>{topic.timeAgo}</span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm font-medium">{topic.replies}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-4 border-t border-slate-100 text-center">
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
              Load More Discussions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
