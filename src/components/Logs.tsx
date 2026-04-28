/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { TimeLog } from '../types';
import { format, parseISO, differenceInHours } from 'date-fns';
import { Trash2, AlertTriangle, Plus, FileSpreadsheet, Edit3, Download } from 'lucide-react';
import { LogForm } from './LogForm';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function Logs() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [logToEdit, setLogToEdit] = useState<TimeLog | undefined>(undefined);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'logs'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'logs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `logs/${id}`);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Monthly Timesheet', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Employee: ${profile?.displayName || user?.email}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 35);

    const tableData = logs.map(log => [
      log.date,
      log.type.toUpperCase(),
      log.project || '-',
      log.startTime || '-',
      log.endTime || '-',
      `${log.breakMinutes}m`,
      log.comment || '-'
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Type', 'Project', 'Start', 'End', 'Break', 'Comment']],
      body: tableData,
    });

    doc.save(`Timesheet_${format(new Date(), 'yyyy_MM')}.pdf`);
  };

  const handleEdit = (log: TimeLog) => {
    setLogToEdit(log);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setLogToEdit(undefined);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-12 max-w-6xl mx-auto pb-32">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="text-left">
          <h1 className="text-4xl sm:text-5xl font-black leading-none tracking-tighter molten-gradient-text uppercase">Transmission <span className="text-white">Relay</span></h1>
          <p className="text-white/40 font-black mt-3 text-xs uppercase tracking-[0.3em] leading-none">Operational Sequence History</p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <button 
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none justify-center bg-white/10 hover:bg-white/20 text-white p-4 rounded-3xl border border-white/20 transition-all flex items-center gap-3 px-8 shadow-2xl active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-widest">Download Data</span>
          </button>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex-1 sm:flex-none justify-center neon-button p-4 flex items-center gap-3 px-10 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">New Sequence</span>
          </button>
        </div>
      </header>

      <div className="space-y-6">
        {logs.length === 0 ? (
          <div className="glass-card rounded-[40px] p-24 text-center border-dashed border-white/10">
            <p className="text-white/30 font-black uppercase tracking-[0.3em] text-xs">No active sequences detected in current sector.</p>
          </div>
        ) : (
          logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`glass-card p-6 sm:p-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-8 group hover:bg-white/5 border border-white/10 transition-all ${log.isComplianceViolation ? 'border-l-[6px] border-l-red-500 bg-red-500/5 shadow-[inset_0_0_20px_rgba(255,46,46,0.1)]' : ''}`}
            >
              <div className="flex items-center gap-8 w-full sm:w-auto">
                <div className="text-center min-w-[72px] bg-white/5 p-4 rounded-3xl border border-white/10 shadow-inner group-hover:bg-white/10 transition-colors">
                  <p className="text-2xl font-black text-white leading-none font-mono">{format(parseISO(log.date), 'dd')}</p>
                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-2">{format(parseISO(log.date), 'MMM')}</p>
                </div>
                
                <div className="space-y-3 flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-4 flex-wrap">
                    <p className="text-lg font-black text-white tracking-widest font-mono uppercase">
                      {log.type === 'work' ? `${log.startTime} — ${log.endTime}` : log.type}
                    </p>
                    {log.project && (
                      <span className="text-[9px] font-black bg-white/10 text-white px-3 py-1.5 rounded-full border border-white/20 uppercase tracking-widest leading-none">
                        @ {log.project}
                      </span>
                    )}
                    {log.isComplianceViolation && (
                      <div className="group/tip relative flex items-center">
                        <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 p-6 bg-black/95 border border-white/20 text-white text-[10px] rounded-[24px] shadow-2xl opacity-0 scale-95 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:scale-100 transition-all z-20 backdrop-blur-xl">
                           <p className="font-black text-red-500 uppercase tracking-widest mb-3">Security Breach</p>
                          <p className="leading-relaxed font-bold opacity-60 uppercase tracking-wide">{log.violationDetails?.join(' // ')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white/30 font-bold uppercase tracking-wide truncate max-w-[400px]">
                    {log.comment || 'System metadata omitted'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-10 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/10 pt-6 sm:pt-0">
                <div className="text-left sm:text-right space-y-1">
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Quantum Duration</p>
                  <p className="text-xl font-black text-white font-mono group-hover:molten-gradient-text transition-all tracking-tighter">
                    {log.type === 'work' ? `${((differenceInHours(new Date(`1970-01-01T${log.endTime}`), new Date(`1970-01-01T${log.startTime}`)) * 60 - log.breakMinutes) / 60).toFixed(1)}H` : '8.0H'}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleEdit(log)}
                    className="p-4 text-white/20 hover:text-white hover:bg-white/10 rounded-2xl transition-all active:scale-90"
                    title="Edit entry"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(log.id)}
                    className="p-4 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all active:scale-90"
                    title="Delete entry"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isFormOpen && <LogForm onClose={handleCloseForm} logToEdit={logToEdit} />}
      </AnimatePresence>
    </div>
  );
}
