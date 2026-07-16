import { MessageCircle, X, Sparkles, Send } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

export default function GlobalHelperBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'bot' | 'user', text: string}[]>([
    { role: 'bot', text: 'Greetings, User. I am the VantaOS Assistant. I can assist you with navigating the zero-cost decentralized mesh, setting up quantum-secure configurations, or writing TypeScript code. How may I serve you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);
    
    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: `Processing query: "${currentInput}". As your guide, I recommend exploring the Omni-AI to experience our universal compilation engine, or the Global Mesh to review your secure node deployment.` 
      }]);
    }, 1500);
  };

  return (
    <>
      {/* Floating Button with Cool Pulse Animation */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'scale-0 opacity-0 pointer-events-none translate-y-10' : 'scale-100 opacity-100 translate-y-0'}`}>
        <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
        <button 
          onClick={() => setIsOpen(true)}
          className="relative p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center group overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform relative z-10" />
        </button>
      </div>

      {/* Chat Window with Slide-up and Fade-in Animation */}
      <div className={`fixed bottom-6 right-6 w-80 md:w-96 bg-[#0D1117] border border-emerald-900/50 rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 pointer-events-none translate-y-10'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#161B22] rounded-t-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-full bg-emerald-950/50 flex items-center justify-center border border-emerald-800 relative">
              <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-[spin_3s_linear_infinite]"></div>
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">VantaOS Assistant</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_#10b981]"></span>
                <span className="text-[10px] text-emerald-500 uppercase tracking-widest font-mono font-semibold">Active Construct</span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors relative z-10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 h-96 overflow-y-auto flex flex-col gap-4 font-sans text-sm custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300 fade-in`}>
              <div className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-br-sm border border-emerald-500/20' 
                  : 'bg-[#161B22] text-slate-300 border border-slate-800 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-in fade-in duration-200">
              <div className="max-w-[85%] p-4 rounded-2xl rounded-bl-sm bg-[#161B22] border border-slate-800 flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-800 bg-[#161B22] rounded-b-2xl">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 bg-[#0D1117] p-1 border border-slate-700 rounded-xl focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all"
          >
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query the construct..."
              className="flex-1 bg-transparent text-white px-3 py-2.5 focus:outline-none text-sm placeholder:text-slate-500"
            />
            <button 
              type="submit" 
              disabled={!input.trim()}
              className="p-2.5 bg-emerald-600/10 text-emerald-500 rounded-lg hover:bg-emerald-600/30 transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600/10 mr-0.5"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
