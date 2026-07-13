/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { startAiTrainerWorker } from './utils/aiTrainerWorker';
import { ViewState } from './types';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Forum from './components/Forum';
import Showcase from './components/Showcase';
import Learn from './components/Learn';
import CloudInfrastructure from './components/CloudInfrastructure';
import Governance from './components/Governance';
import DecentralizedMesh from './components/DecentralizedMesh';
import LionSuite from './components/LionSuite';
import FortressMode from './components/FortressMode';
import AdminPanel from './components/AdminPanel';
import PrivacyPolicy from './components/PrivacyPolicy';
import OmniAI from './components/OmniAI';

import GlobalHelperBot from './components/GlobalHelperBot';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const userEmail = "ram1234598766@gmail.com";

  useEffect(() => {
    startAiTrainerWorker();
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navigation currentView={currentView} setCurrentView={setCurrentView} userEmail={userEmail} />
      
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-8">
        {currentView === 'home' && <Home setCurrentView={setCurrentView} />}
        {currentView === 'forum' && <Forum />}
        {currentView === 'showcase' && <Showcase />}
        {currentView === 'learn' && <Learn />}
        {currentView === 'ai-training' && <CloudInfrastructure />}
        {currentView === 'governance' && <Governance />}
        {currentView === 'mesh' && <DecentralizedMesh />}
        {currentView === 'lion-suite' && <LionSuite />}
        {currentView === 'fortress' && <FortressMode />}
        {currentView === 'admin' && <AdminPanel />}
        {currentView === 'privacy' && <PrivacyPolicy />}
        {currentView === 'omni-ai' && <OmniAI />}
      </main>

      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            OpenLayer ecosystem architected by <span className="font-bold text-slate-800">Mrityunjay K</span>
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-3">
            <span>Contact: <a href="mailto:ram1234598766@gmail.com" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">ram1234598766@gmail.com</a></span>
            <span className="text-slate-300">|</span>
            <span>Phone: <a href="tel:7981344431" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">7981344431</a></span>
          </div>
        </div>
      </footer>

      <GlobalHelperBot />
    </div>
  );
}
