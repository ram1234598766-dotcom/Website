import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Settings, Activity, Zap } from 'lucide-react';
import { get, set } from 'idb-keyval';

const HISTORY_KEY = 'vantaos_omni_ai_history';

export default function OmniAI() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelType, setModelType] = useState<'deep' | 'quick'>('deep');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get(HISTORY_KEY).then((val) => {
      if (val && Array.isArray(val)) {
        setMessages(val);
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage = { role: 'user' as const, content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);
    set(HISTORY_KEY, newMessages);

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          modelType: modelType 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to connect to Omni-AI server: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.text }];
      setMessages(finalMessages);
      set(HISTORY_KEY, finalMessages);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [...prev, { role: 'assistant', content: `[API ERROR]: ${err.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearHistory = async (e: React.MouseEvent) => {
    e.preventDefault();
    await set(HISTORY_KEY, []);
    setMessages([]);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-[85vh] bg-[#0a0d12] rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      
      {/* Header */}
      <div className="bg-[#161B22] border-b border-slate-800 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-900/40 rounded-xl border border-emerald-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Omni-AI Terminal</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end text-right gap-3">
          
          {/* Model Switcher */}
          <div className="flex bg-slate-950/80 rounded-lg p-1 border border-slate-800/80 shadow-inner">
            <button
              onClick={() => setModelType('deep')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${modelType === 'deep' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              <BrainCircuit className="w-4 h-4" />
              Deep Thinking
            </button>
            <button
              onClick={() => setModelType('quick')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${modelType === 'quick' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              <Zap className="w-4 h-4" />
              Quick Reply
            </button>
          </div>

          <div className="text-[10px] text-slate-500 max-w-[300px] leading-tight flex items-center justify-end gap-1">
            <Activity className="w-3 h-3 text-emerald-500" />
            Connected to Gemini
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <BrainCircuit className="w-12 h-12 text-slate-800 mb-4" />
              <p>Cloud Engine connected. Ask anything.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-sm md:text-base leading-relaxed shadow-md ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm' 
                      : 'bg-[#161B22] text-slate-200 border border-slate-700/50 rounded-tl-sm font-sans'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content as string}</div>
                </div>
              </div>
            ))
          )}
          
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-[#161B22] border border-slate-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 bg-[#161B22] border-t border-slate-800">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the Omni-AI..."
              disabled={isGenerating}
              className="w-full bg-[#0a0d12] border border-slate-700 text-white text-sm md:text-base rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-indigo-500 shadow-inner disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isGenerating}
              className="absolute right-2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          <div className="flex justify-between items-center mt-3 px-2">
            <div className="text-[10px] text-slate-500">
              Press Enter to send. Cloud inference is highly optimized for complex logic.
            </div>
            <button 
              type="button"
              onClick={clearHistory}
              disabled={messages.length === 0 || isGenerating}
              className="text-[10px] text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Clear History
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
