/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { BUNDESLAND_NAMES, Bundesland, UserProfile } from '../types';
import { Save, User as UserIcon, Euro, Briefcase, MapPin, Calculator, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export function Settings() {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState<Partial<UserProfile>>(profile || {
    state: 'BE',
    hourlyRate: 12.41, // 2024 Min wage
    weeklyContractHours: 40,
    vacationDaysPerYear: 30,
    role: 'employee',
    displayName: user?.displayName || ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage('');

    try {
      const userRef = doc(db, 'users', user.uid);
      const dataToSave = {
        ...formData,
        uid: user.uid,
        email: user.email,
        displayName: formData.displayName || user.displayName || '',
        role: profile?.role || 'employee' // Logic prevents self-promotion if profile exists
      };

      await setDoc(userRef, dataToSave, { merge: true });
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-2xl mx-auto pb-32">
      <header className="text-left">
        <h1 className="text-4xl sm:text-5xl font-black leading-none tracking-tighter molten-gradient-text uppercase">Control <span className="text-white">Panel</span></h1>
        <p className="text-white/40 font-black mt-3 text-xs uppercase tracking-[0.3em] leading-none">Personal System Configuration</p>
      </header>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSave}
        className="glass-card p-10 md:p-12 space-y-12 relative overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-10">
           <div className="space-y-4">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
              <UserIcon className="w-5 h-5 text-white/60" /> Identity Matrix
            </label>
            <input
              type="text"
              className="glass-input w-full font-bold"
              value={formData.displayName}
              onChange={e => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Designate Full Name"
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
              <MapPin className="w-5 h-5 text-white/60" /> Statistical Sector (State)
            </label>
            <div className="relative group">
              <select
                className="glass-input w-full appearance-none pr-12 font-bold cursor-pointer transition-all focus:bg-white/10"
                value={formData.state}
                onChange={e => setFormData({ ...formData, state: e.target.value as Bundesland })}
              >
                {Object.entries(BUNDESLAND_NAMES).map(([code, name]) => (
                  <option key={code} value={code} className="bg-black text-white">{name}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-hover:text-white transition-colors pointer-events-none rotate-90" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
                <Euro className="w-5 h-5 text-white/60" /> Hourly Flux (€)
              </label>
              <input
                type="number"
                step="0.01"
                className="glass-input w-full font-mono font-black text-lg"
                value={formData.hourlyRate}
                onChange={e => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
                <Briefcase className="w-5 h-5 text-white/60" /> Cycle Capacity (W)
              </label>
              <input
                type="number"
                className="glass-input w-full font-mono font-black text-lg"
                value={formData.weeklyContractHours}
                onChange={e => setFormData({ ...formData, weeklyContractHours: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="pt-10 border-t border-white/10 space-y-10">
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] bg-white/10 px-6 py-2.5 rounded-full w-fit">Taxation Spectrum</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] leading-none text-left block">Tax Class Tier</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFormData({ ...formData, taxClass: v as any })}
                      className={`py-4 rounded-2xl text-xs font-black border transition-all active:scale-95 ${formData.taxClass === v ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <label className="flex items-center gap-6 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer hidden"
                      checked={formData.hasChurchTax || false}
                      onChange={e => setFormData({ ...formData, hasChurchTax: e.target.checked })}
                    />
                    <div className="w-14 h-7 bg-white/10 border border-white/20 rounded-full peer-checked:bg-white transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white peer-checked:after:bg-black after:w-5 after:h-5 after:rounded-full after:transition-all peer-checked:after:left-8 shadow-inner" />
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Digital Church Tax</span>
                </label>
                <label className="flex items-center gap-6 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer hidden"
                      checked={formData.hasChildren || false}
                      onChange={e => setFormData({ ...formData, hasChildren: e.target.checked })}
                    />
                    <div className="w-14 h-7 bg-white/10 border border-white/20 rounded-full peer-checked:bg-white transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white peer-checked:after:bg-black after:w-5 after:h-5 after:rounded-full after:transition-all peer-checked:after:left-8 shadow-inner" />
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Neural Dependents</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col gap-6">
          <button
            type="submit"
            disabled={saving}
            className="neon-button w-full py-5 active:scale-95 transition-all"
          >
            <Save className="w-6 h-6" />
            <span className="text-sm font-black uppercase tracking-[0.25em]">{saving ? 'Transmitting...' : 'Commit Configuration'}</span>
          </button>
          
          {message && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-[11px] text-white font-black uppercase tracking-[0.4em] animate-pulse glow-text"
            >
              {message}
            </motion.p>
          )}
        </div>
      </motion.form>

      <section className="glass-card p-10 rounded-[40px] border-white/5 space-y-6">
        <h3 className="font-black flex items-center gap-4 tracking-tighter text-white uppercase text-left">
          <Calculator className="w-6 h-6 text-white/40" /> Computational Pay Engine
        </h3>
        <p className="text-[11px] font-bold text-white/30 leading-relaxed uppercase tracking-wider text-left">
          Distributions are calculated via contract flux. 
          Buffer cycles, vacation, and legislative holidays are 
          standardized as 8.0H active sequences under ArbZG protocol.
        </p>
      </section>
    </div>

  );
}
