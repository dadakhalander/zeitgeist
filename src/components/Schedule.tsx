import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { ScheduledShift } from '../types';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Briefcase,
  Zap,
  Edit3,
  X
} from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  addDays, 
  isSameDay, 
  parseISO, 
  addWeeks, 
  subWeeks 
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export function Schedule() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<ScheduledShift[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [isBulkImport, setIsBulkImport] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [newShift, setNewShift] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '17:00',
    sector: '',
    notes: ''
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'schedules'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScheduledShift[];
      // Sort manually to avoid needing composite indexes in Firestore
      data.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });
      setShifts(data);
      setLoading(false);
    }, (error) => {
      console.error("Schedule loading error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    setStatusMsg(null);

    try {
      if (editingShiftId) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'schedules', editingShiftId), {
          ...newShift,
          updatedAt: Date.now()
        });
        setStatusMsg({ type: 'success', text: 'Shift protocol updated.' });
      } else {
        await addDoc(collection(db, 'schedules'), {
          ...newShift,
          userId: user.uid,
          createdAt: Date.now()
        });
        setStatusMsg({ type: 'success', text: 'Shift committed to matrix.' });
      }
      
      setIsAdding(false);
      setEditingShiftId(null);
      setNewShift({
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '17:00',
        sector: '',
        notes: ''
      });
    } catch (error) {
      console.error("Save shift error:", error);
      setStatusMsg({ type: 'error', text: 'Failed to sync shift. Check permissions.' });
      handleFirestoreError(error, OperationType.WRITE, 'schedules');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (shift: ScheduledShift) => {
    setNewShift({
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      sector: shift.sector || '',
      notes: shift.notes || ''
    });
    setEditingShiftId(shift.id);
    setIsAdding(true);
    setIsBulkImport(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsAdding(false);
    setEditingShiftId(null);
    setNewShift({
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '17:00',
      sector: '',
      notes: ''
    });
  };

  const handleBulkImport = async () => {
    if (!user || !bulkData.trim()) return;

    const lines = bulkData.split('\n');
    let count = 0;

    for (const line of lines) {
      const match = line.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})(?:\s+(.*))?/);
      if (match) {
        try {
          await addDoc(collection(db, 'schedules'), {
            userId: user.uid,
            date: match[1],
            startTime: match[2],
            endTime: match[3],
            sector: match[4] || '',
            createdAt: Date.now()
          });
          count++;
        } catch (e) {
          console.error("Bulk add failed", e);
        }
      }
    }

    setIsBulkImport(false);
    setBulkData('');
    alert(`Successfully processed ${count} shifts.`);
  };

  const handleDeleteShift = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `schedules/${id}`);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center space-y-8">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      <p className="text-white/40 text-sm font-black uppercase tracking-[0.3em] animate-pulse">Syncing Protocols...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-6xl mx-auto pb-32">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="text-left">
          <h1 className="text-4xl sm:text-5xl font-black leading-none tracking-tighter molten-gradient-text uppercase">Duty <span className="text-white">Matrix</span></h1>
          <p className="text-white/40 font-black mt-3 text-xs uppercase tracking-[0.3em] leading-none">Temporal Shift Planning</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-1.5 shadow-2xl">
            <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-3 hover:bg-white/10 hover:text-white transition-all rounded-xl text-white/40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-white font-black uppercase tracking-[0.2em] text-[10px] px-4 min-w-[120px] text-center">
              Week {format(weekStart, 'dd MMM')}
            </p>
            <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-3 hover:bg-white/10 hover:text-white transition-all rounded-xl text-white/40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="relative flex items-center bg-white/5 border border-white/10 rounded-[28px] p-1.5">
            <button 
              onClick={() => { if (isAdding) handleCancelEdit(); else { setIsAdding(true); setIsBulkImport(false); } }}
              className={`relative z-10 px-6 h-11 flex items-center gap-2 transition-all duration-500 ${isAdding ? 'text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Plus className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{editingShiftId ? 'Edit' : 'Add'}</span>
            </button>
            <button 
              onClick={() => { setIsBulkImport(!isBulkImport); setIsAdding(false); setEditingShiftId(null); }}
              className={`relative z-10 px-6 h-11 flex items-center gap-2 transition-all duration-500 ${isBulkImport ? 'text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Briefcase className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Bulk</span>
            </button>
            {(isAdding || isBulkImport) && (
              <motion.div 
                layoutId="modeToggle"
                className="absolute h-11 bg-white rounded-[22px] shadow-xl"
                style={{ 
                  left: isAdding ? '6px' : 'auto', 
                  right: isBulkImport ? '6px' : 'auto',
                  width: 'calc(50% + 20px)' 
                }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-10 border-white/20 bg-white/5"
          >
            <form onSubmit={handleAddShift} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="space-y-3">
                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] text-left block">Target Date</label>
                <input 
                  type="date"
                  required
                  className="glass-input w-full"
                  value={newShift.date}
                  onChange={e => setNewShift({...newShift, date: e.target.value})}
                />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] text-left block">Time Flux (Start-End)</label>
                <div className="flex gap-2">
                  <input 
                    type="time" 
                    required
                    className="glass-input w-full" 
                    value={newShift.startTime}
                    onChange={e => setNewShift({...newShift, startTime: e.target.value})}
                  />
                  <input 
                    type="time" 
                    required
                    className="glass-input w-full" 
                    value={newShift.endTime}
                    onChange={e => setNewShift({...newShift, endTime: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] text-left block">Sector Designation</label>
                <input 
                  type="text" 
                  placeholder="Sector Code"
                  className="glass-input w-full"
                  value={newShift.sector}
                  onChange={e => setNewShift({...newShift, sector: e.target.value})}
                />
              </div>
              <button type="submit" disabled={isSaving} className="neon-button w-full h-[54px] disabled:opacity-50 disabled:cursor-not-allowed">
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isSaving ? 'Saving...' : (editingShiftId ? 'Update Shift' : 'Save Shift')}
                </span>
              </button>
            </form>
            
            {statusMsg && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-center p-3 rounded-xl border ${
                  statusMsg.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {statusMsg.text}
              </motion.div>
            )}
          </motion.div>
        )}

        {isBulkImport && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-10 border-white/20 bg-white/5 space-y-6"
          >
            <div className="space-y-3">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] text-left block">
                Bulk Protocol Input (Format: YYYY-MM-DD HH:MM HH:MM Sector)
              </label>
              <textarea 
                className="glass-input w-full min-h-[150px] font-mono text-xs leading-relaxed"
                placeholder={`2026-05-01 09:00 17:00 Sector-A\n2026-05-02 10:00 18:00 Sector-B`}
                value={bulkData}
                onChange={e => setBulkData(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 items-center">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                Format: YYYY-MM-DD HH:MM HH:MM Sector
              </p>
              <button 
                onClick={handleBulkImport}
                className="neon-button px-10 h-[54px]"
              >
                <Zap className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Process Import</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day, idx) => {
          const dayShifts = shifts.filter(s => isSameDay(parseISO(s.date), day));
          const isToday = isSameDay(day, new Date());
          
          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex flex-col min-h-[300px] glass-card p-6 border-white/5 hover:border-white/20 transition-all ${isToday ? 'bg-white/10 ring-1 ring-white/30' : 'bg-white/5'}`}
            >
              <div className="text-center mb-6">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isToday ? 'text-white' : 'text-white/30'}`}>
                  {format(day, 'EEE')}
                </p>
                <p className={`text-4xl font-black ${isToday ? 'molten-gradient-text' : 'text-white/60'}`}>
                  {format(day, 'dd')}
                </p>
              </div>

              <div className="flex-1 space-y-4">
                {dayShifts.map(shift => (
                  <div key={shift.id} className="group relative bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                       <Clock className="w-3 h-3 text-white/40" />
                       <span className="text-[10px] font-black text-white font-mono">{shift.startTime}—{shift.endTime}</span>
                    </div>
                    {shift.sector && (
                      <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="w-3 h-3 text-white/40" />
                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest truncate">{shift.sector}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                      <button 
                        onClick={() => handleEditClick(shift)}
                        className="p-1.5 text-white/20 hover:text-white transition-all bg-white/5 rounded-lg"
                        title="Edit Shift"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleDeleteShift(shift.id)}
                        className="p-1.5 text-white/20 hover:text-red-500 transition-all bg-white/5 rounded-lg"
                        title="Delete Shift"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {dayShifts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full opacity-10">
                    <Zap className="w-8 h-8" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
