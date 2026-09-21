'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Search, FileText, ArrowLeft } from 'lucide-react';
import DOMPurify from 'dompurify';

interface DocPage {
  slug: string;
  title: string;
  content: string;
}

const DOC_PAGES: DocPage[] = [
  {
    slug: 'overview',
    title: 'Overview',
    content: `# VantaOS Overview

VantaOS is a browser-based cloud IDE that runs entirely in your browser.

## Key Features

- **File Manager** — Tabbed file explorer with split views
- **CodeMirror 6 Editor** — 15+ language support with syntax highlighting
- **xterm.js Terminal** — Sandboxed JavaScript execution
- **Omni-AI** — Chat with cloud AI or run models locally
- **WebModel Manager** — Browse and download HuggingFace models
- **Google Drive** — Read-only integration with Firebase auth
- **GitHub** — Import repos and push changes

## Getting Started

\`\`\`bash
npm ci
npm run dev
\`\`\`

Everything works offline by default. Your files live in IndexedDB.`,
  },
  {
    slug: 'workspace',
    title: 'Workspace',
    content: `# Workspace

Your workspace files are stored in IndexedDB under the key namespace \`vantaos_cloudos_files_v2\`.

## File Operations

- **Create** — New files and folders via the file explorer
- **Edit** — Click any file to view and edit content
- **Delete** — Remove files from the workspace
- **Search** — Use the search bar to find files by name

## Persistence

Files persist automatically via idb-keyval. No server storage required for local development.`,
  },
  {
    slug: 'terminal',
    title: 'Terminal',
    content: `# Terminal

The terminal runs code in a sandboxed Web Worker using \`SandboxRunner\` (\`new Function\`).

## Safety

- **No filesystem access** inside the sandbox
- **No network access** inside the sandbox
- **No ambient authority** — the runner has no credentials or I/O permissions
- Each execution gets a fresh worker

## Available Commands

- \`js\` — Run JavaScript
- \`calc\` — Mathematical expressions
- \`ls\` — List workspace files
- \`cat <path>\` — Read file content
- \`write <path> <content>\` — Write file content`,
  },
  {
    slug: 'security',
    title: 'Security',
    content: `# Security

- Keys are environment-only — never printed or logged
- HTML from users is sanitized with DOMPurify
- API routes are rate-limited (100 req/60s)
- Terminal code runs in a sandboxed Web Worker
- All secrets are stored as Cloudflare Worker env vars
- Firebase RTDB rules are the security boundary for data access`,
  },
];

export default function DocsPage() {
  const [activeSlug, setActiveSlug] = useState<string>('overview');
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  const activePage = DOC_PAGES.find((p) => p.slug === activeSlug);

  const filteredDocs = query
    ? DOC_PAGES.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.content.toLowerCase().includes(query.toLowerCase())
      )
    : DOC_PAGES;

  const sanitize = useCallback((html: string) => {
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }, []);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Documentation</h1>
          <p className="text-slate-400 text-sm mt-1">
            VantaOS guides and reference
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search docs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            aria-label="Search documentation"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <nav className="rounded-xl border border-white/10 bg-white/5 lg:col-span-1" aria-label="Documentation navigation">
          <div className="p-3 border-b border-white/10">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" /> Pages
            </span>
          </div>
          <div className="p-2">
            {filteredDocs.map((page) => (
              <button
                key={page.slug}
                onClick={() => setActiveSlug(page.slug)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSlug === page.slug
                    ? 'bg-indigo-900/40 text-indigo-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
                aria-current={activeSlug === page.slug ? 'page' : undefined}
              >
                <FileText className="w-4 h-4 shrink-0" />
                {page.title}
              </button>
            ))}
            {filteredDocs.length === 0 && (
              <p className="text-slate-500 text-sm p-4">No results</p>
            )}
          </div>
        </nav>

        {/* Content */}
        <motion.div
          key={activeSlug}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-white/10 bg-white/5 lg:col-span-2"
        >
          {loaded && activePage ? (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-6">{activePage.title}</h2>
              <div
                className="prose prose-invert max-w-none
                  prose-headings:text-white prose-p:text-slate-300
                  prose-code:text-indigo-300 prose-code:bg-white/5
                  prose-pre:text-slate-300 prose-pre:bg-black/40
                  prose-pre:rounded-lg prose-pre:p-4
                  prose-pre:font-mono prose-pre:text-sm
                  prose-blockquote:border-l-4 prose-blockquote:border-indigo-500
                  prose-blockquote:bg-white/3 prose-blockquote:px-4 prose-blockquote:py-2"
                dangerouslySetInnerHTML={{ __html: sanitize(activePage.content) }}
              />
            </div>
          ) : (
            <div className="p-6 text-slate-500">Select a page</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
