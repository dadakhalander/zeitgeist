/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FirebaseProvider, useAuth } from './components/FirebaseProvider';
import { Login } from './components/Login';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Logs } from './components/Logs';
import { Schedule } from './components/Schedule';
import { Salary } from './components/Salary';
import { Settings } from './components/Settings';
import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-8">
          <div className="w-16 h-16 border-8 border-white/10 border-t-white animate-spin"></div>
          <p className="text-white font-black uppercase tracking-[0.3em] animate-pulse">BOOTING_PROTOCOL...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-transparent text-white font-sans selection:bg-white selection:text-black">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'logs' && <Logs />}
            {activeTab === 'schedule' && <Schedule />}
            {activeTab === 'salary' && <Salary />}
            {activeTab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}

