/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ViewState } from './types';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Forum from './components/Forum';
import Showcase from './components/Showcase';
import Learn from './components/Learn';
import CloudInfrastructure from './components/CloudInfrastructure';
import Governance from './components/Governance';
import Monetization from './components/Monetization';
import LionSuite from './components/LionSuite';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navigation currentView={currentView} setCurrentView={setCurrentView} />
      
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-8">
        {currentView === 'home' && <Home setCurrentView={setCurrentView} />}
        {currentView === 'forum' && <Forum />}
        {currentView === 'showcase' && <Showcase />}
        {currentView === 'learn' && <Learn />}
        {currentView === 'cloud' && <CloudInfrastructure />}
        {currentView === 'governance' && <Governance />}
        {currentView === 'enterprise' && <Monetization />}
        {currentView === 'lion-suite' && <LionSuite />}
      </main>
    </div>
  );
}
