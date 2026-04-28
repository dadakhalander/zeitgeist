/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Clock, BarChart3, Settings, LogOut, User as UserIcon, Wallet, Calendar, Menu, X, FileText } from 'lucide-react';
import { logout } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { motion, AnimatePresence } from 'motion/react';

interface NavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Navigation({ activeTab, setActiveTab }: NavProps) {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'logs', label: 'Time Logs', icon: Clock },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'salary', label: 'Salary', icon: Wallet },
    { id: 'payslips', label: 'Payslips', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-12 px-4 py-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter molten-gradient-text uppercase">ZeitGeist</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="md:hidden p-2 text-white/40 hover:text-white transition-all">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col gap-3 flex-grow px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`flex flex-row items-center gap-4 px-5 py-4 rounded-3xl transition-all duration-500 group relative ${
                isActive 
                  ? 'text-white bg-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] border border-white/20' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-white/10 text-white' : 'group-hover:bg-white/5'}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-inherit'}`} />
              </div>
              <span className="text-sm font-extrabold uppercase tracking-[0.2em]">{item.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute left-0 w-1 h-8 bg-white rounded-r-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 mt-auto pt-8 border-t border-white/10">
        <div className="flex items-center gap-4 px-4 py-4 rounded-[28px] bg-white/5 border border-white/10">
          <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
            <UserIcon className="w-6 h-6" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-extrabold truncate text-white">{profile?.displayName || 'Set up profile'}</p>
            <p className="text-[10px] text-white/40 truncate font-black uppercase tracking-[0.2em]">{profile?.role || 'Operator'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-4 px-6 py-4 text-white/40 hover:text-orange-500 hover:bg-orange-500/10 rounded-2xl transition-all group"
        >
          <LogOut className="w-5 h-5 group-hover:animate-pulse" />
          <span className="text-xs font-black uppercase tracking-[0.15em]">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="fixed top-6 right-6 z-[60] md:hidden">
        <button 
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-slate-950/60 backdrop-blur-3xl border border-white/20 rounded-2xl flex items-center justify-center shadow-2xl text-white hover:scale-110 active:scale-95 transition-all"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex md:relative md:border-r md:w-72 md:h-screen p-4 flex-col z-50 bg-slate-950/60 backdrop-blur-[32px] border-white/10">
        <NavContent />
      </nav>

      {/* Mobile Sliding Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] md:hidden"
            />
            <motion.nav 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-slate-900 border-r border-white/10 p-4 z-[80] md:hidden overflow-y-auto custom-scrollbar"
            >
              <NavContent />
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
