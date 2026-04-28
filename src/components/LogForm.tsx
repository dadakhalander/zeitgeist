/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { LogType, TimeLog } from '../types';
import { checkCompliance } from '../lib/compliance';
import { Plus, X, Calendar, Clock, Coffee, Type, MessageSquare, Briefcase, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function LogForm({ onClose, logToEdit }: { onClose: () => void, logToEdit?: TimeLog }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    date: logToEdit?.date || new Date().toISOString().split('T')[0],
    startTime: logToEdit?.startTime || '09:00',
    endTime: logToEdit?.endTime || '17:30',
    breakMinutes: logToEdit?.breakMinutes ?? 30,
    type: logToEdit?.type || LogType.WORK,
    project: logToEdit?.project || '',
    comment: logToEdit?.comment || ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const compliance = checkCompliance(formData as any);
      const logData = {
        ...formData,
        userId: user.uid,
        isComplianceViolation: !compliance.isValid,
        violationDetails: compliance.violations,
        updatedAt: serverTimestamp()
      };

      if (logToEdit?.id) {
        await updateDoc(doc(db, 'logs', logToEdit.id), logData);
      } else {
        await addDoc(collection(db, 'logs'), {
          ...logData,
          createdAt: serverTimestamp()
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, logToEdit ? OperationType.UPDATE : OperationType.WRITE, 'logs');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-start justify-center p-4 overflow-y-auto pt-10 pb-24"
    >
      <motion.div
        initial={{ scale: 0.9, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 40 }}
        className="glass-card rounded-[48px] w-full max-w-xl overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
      >
        <div className="p-10 flex items-center justify-between border-b border-white/10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase molten-gradient-text">Transmission <span className="text-white">Log</span></h2>
            <p className="text-[10px] text-white/40 uppercase font-black tracking-[0.4em] mt-2">Initialize Data Stream</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-3xl transition-all text-white/40 hover:text-white active:scale-90">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
                <Calendar className="w-4 h-4 text-white/60" /> Temporal Point
              </label>
              <input
                type="date"
                required
                className="glass-input w-full text-white font-black"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
                <Briefcase className="w-4 h-4 text-white/60" /> Neural Sector
              </label>
              <input
                type="text"
                placeholder="Sector Designation"
                className="glass-input w-full text-white font-black"
                value={formData.project}
                onChange={e => setFormData({ ...formData, project: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
              <Type className="w-4 h-4 text-white/60" /> Sequence Mode
            </label>
            <div className="relative group">
              <select
                className="glass-input w-full appearance-none text-white font-black uppercase tracking-widest text-xs pr-12 cursor-pointer"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as LogType })}
              >
                <option value={LogType.WORK} className="bg-black text-white">Active Cycle</option>
                <option value={LogType.SICK} className="bg-black text-white">Biological Maintenance</option>
                <option value={LogType.VACATION} className="bg-black text-white">Neural Rest (Vacation)</option>
                <option value={LogType.HOLIDAY} className="bg-black text-white">Expansion Protocol (Holiday)</option>
              </select>
              <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 rotate-90 pointer-events-none" />
            </div>
          </div>

          {formData.type === LogType.WORK && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4"
              >
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
                    <Clock className="w-4 h-4 text-white/60" /> Start
                  </label>
                  <input
                    type="time"
                    required
                    className="glass-input w-full font-black text-white text-lg"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
                    <Clock className="w-4 h-4 text-white/60" /> Finish
                  </label>
                  <input
                    type="time"
                    required
                    className="glass-input w-full font-black text-white text-lg"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
                    <Coffee className="w-4 h-4 text-white/60" /> Buffer
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      required
                      className="glass-input w-full pr-12 font-black text-white text-lg"
                      value={formData.breakMinutes}
                      onChange={e => setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-white/20 font-black uppercase tracking-widest">min</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          <div className="space-y-4">
            <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-3 text-left">
              <MessageSquare className="w-4 h-4 text-white/60" /> Transmission Notes
            </label>
            <textarea
              className="glass-input w-full min-h-[120px] resize-none text-white font-bold placeholder:text-white/10"
              placeholder="Designate current mission parameters..."
              value={formData.comment}
              onChange={e => setFormData({ ...formData, comment: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="neon-button w-full py-6 active:scale-95 transition-all"
          >
            <span className="text-sm font-black uppercase tracking-[0.3em]">{submitting ? 'TRANSMITTING...' : 'COMMIT DATA'}</span>
          </button>
        </form>
      </motion.div>
    </motion.div>

  );
}
