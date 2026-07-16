const fs = require('fs');
let code = fs.readFileSync('src/components/Forum.tsx', 'utf8');

// Add states for search and filter
code = code.replace(/const \[activeThread, setActiveThread\] = useState<Thread \| null>\(null\);/g, `const [activeThread, setActiveThread] = useState<Thread | null>(null);\n  const [searchQuery, setSearchQuery] = useState('');\n  const [activeCategory, setActiveCategory] = useState(categories[0]);\n  const [showFilters, setShowFilters] = useState(false);\n  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');`);

// Update sidebar categories
code = code.replace(/\{categories\.map\(\(cat, i\) => \(\n\s*<button \n\s*key=\{cat\}\n\s*className=\{\`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors \$\{i === 0 \? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-white'\}\`\}\n\s*>\n\s*\{cat\}\n\s*<\/button>\n\s*\)\)\}/g, `{categories.map((cat, i) => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={\`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors \${activeCategory === cat ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}\`}
              >
                {cat}
              </button>
            ))}`);

// Update search input
code = code.replace(/<input \n\s*type="text" \n\s*placeholder="Search discussions..." \n\s*className="w-full pl-9 pr-4 py-2 bg-\[#0a0a0c\] border border-white\/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500\/20 focus:border-indigo-500 transition-all"\n\s*\/>/g, `<input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search discussions..." 
                  className="w-full pl-9 pr-4 py-2 bg-[#0a0a0c] border border-white/10 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />`);

// Update filter button
code = code.replace(/<button className="p-2 border border-white\/10 rounded-lg text-slate-600 hover:bg-\[#0a0a0c\]">\n\s*<Filter className="w-4 h-4" \/>\n\s*<\/button>/g, `<button onClick={() => setShowFilters(!showFilters)} className={\`p-2 border border-white/10 rounded-lg transition-colors \${showFilters ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-[#0a0a0c]'}\`}>
                <Filter className="w-4 h-4" />
              </button>`);

// Filter threads array
code = code.replace(/threads\.length === 0/g, `(() => {
                let filtered = threads;
                if (activeCategory !== 'All Topics') {
                  filtered = filtered.filter(t => t.category === activeCategory);
                }
                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase();
                  filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q));
                }
                if (sortBy === 'popular') {
                   filtered = [...filtered].sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0));
                } else {
                   filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
                
                return filtered.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No threads found matching your filters.</div>
                ) : (
                  filtered.map(thread => (
                    <div key={thread.id} className="p-4 sm:p-5 hover:bg-[#0a0a0c] transition-colors flex gap-4">
                      <div className="flex flex-col items-center justify-center gap-1 min-w-[3rem]">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUpvote(thread.id, undefined); }}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <ArrowUp className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-bold text-slate-300">{thread.upvotes_count || 0}</span>
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-center">
                        <h3 
                          onClick={() => setActiveThread(thread)}
                          className="font-semibold text-white text-base leading-tight mb-1 cursor-pointer hover:text-indigo-400 transition-colors"
                        >
                          {thread.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="font-medium px-2 py-0.5 bg-white/5 rounded text-slate-400">
                            {thread.category}
                          </span>
                          <span>Posted by <span className="font-medium text-slate-300">{thread.author?.username || 'Unknown'}</span></span>
                          <span>&bull;</span>
                          <span>{formatDistanceToNow(new Date(thread.created_at))} ago</span>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm font-medium">{thread.replies_count || 0}</span>
                      </div>
                    </div>
                  ))
                )
              })()`);

code = code.replace(/threads\.map\(thread => \(/g, `(() => null)() /* `);
code = code.replace(/<MessageSquare className="w-4 h-4" \/>\n\s*<span className="text-sm font-medium">\{thread\.replies_count \|\| 0\}<\/span>\n\s*<\/div>\n\s*<\/div>\n\s*\)\)\n\s*\)/g, ``);

// Add filter panel under search bar
code = code.replace(/<div className="divide-y divide-slate-100">/g, `{showFilters && (
              <div className="px-4 py-3 border-b border-white/10 bg-[#0a0a0c] flex items-center gap-4 text-sm text-slate-400">
                <span>Sort by:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-transparent border-none text-slate-200 focus:outline-none">
                  <option value="newest">Newest First</option>
                  <option value="popular">Most Popular</option>
                </select>
              </div>
            )}
            <div className="divide-y divide-white/5">`);

fs.writeFileSync('src/components/Forum.tsx', code);
