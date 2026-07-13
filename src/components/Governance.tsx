import { Users, Vote, FileText, AlertCircle, TrendingUp, Check } from 'lucide-react';

export default function Governance() {
  return (
    <div className="flex flex-col gap-10 w-full max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8 pt-4">
        <div className="flex-1 space-y-4">
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">Community Governance</h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            OpenLayer is governed by its users. We believe that foundational AI infrastructure should be guided by a decentralized, transparent, and inclusive community, not a closed boardroom.
          </p>
          <div className="pt-2 pb-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">How It Works:</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              <li><strong>Propose Features:</strong> Any active community member can draft an OpenLayer Improvement Proposal (OIP) outlining a new feature or architectural change.</li>
              <li><strong>Vote on Priorities:</strong> Tokenized voting weights ensure that both beginners and advanced contributors have a voice in prioritizing the roadmap.</li>
              <li><strong>Contribute Directly:</strong> Approved OIPs are immediately added to the public Lion repository where anyone can contribute code.</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="text-3xl font-black text-indigo-600 mb-1">24.5k</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Voters</div>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="text-3xl font-black text-emerald-600 mb-1">142</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Passed Proposals</div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-2xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              The Open Manifesto
            </h3>
            <ul className="space-y-3">
              {[
                'Radical transparency in model training.',
                '100% data ownership remains with the creator.',
                'Free access to basic compute is a right.',
                'Community vote overrides corporate directive.'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-indigo-800 font-medium">
                  <Check className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="absolute right-0 bottom-0 text-indigo-100/50 transform translate-x-1/4 translate-y-1/4">
            <Vote className="w-48 h-48" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-900">Active Proposals</h3>
          <button className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors">
            Submit Proposal
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { id: 'OIP-42', title: 'Increase Free Tier GPU allocation to 2x T4', status: 'Voting', votes: '12,450', yes: 82, daysLeft: 3, type: 'Infrastructure' },
            { id: 'OIP-43', title: 'Add native support for MoE in Lion compiler', status: 'Discussion', votes: '4,120', yes: 95, daysLeft: 7, type: 'Language' },
            { id: 'OIP-44', title: 'Revise Q3 Data Privacy ledger requirements', status: 'Voting', votes: '8,900', yes: 51, daysLeft: 1, type: 'Policy' },
          ].map(prop => (
            <div key={prop.id} className="p-6 flex flex-col md:flex-row gap-6 items-center hover:bg-slate-50 transition-colors">
              <div className="w-full md:w-auto flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{prop.id}</span>
                  <span className="text-xs font-bold text-slate-500 uppercase">{prop.type}</span>
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {prop.status} ({prop.daysLeft} days left)
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900">{prop.title}</h4>
              </div>
              
              <div className="w-full md:w-64">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-emerald-600">{prop.yes}% Yes</span>
                  <span className="text-xs text-slate-500">{prop.votes} votes</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${prop.yes}%` }}></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 font-semibold text-sm rounded border border-emerald-100 hover:bg-emerald-100 transition-colors">Vote Yes</button>
                  <button className="flex-1 py-1.5 bg-red-50 text-red-700 font-semibold text-sm rounded border border-red-100 hover:bg-red-100 transition-colors">Vote No</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
