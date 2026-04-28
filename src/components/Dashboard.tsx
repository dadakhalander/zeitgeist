/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { TimeLog } from '../types';
import { calculatePay } from '../lib/compliance';
import { isPublicHoliday, getHolidayName } from '../lib/holidays';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, TrendingUp, Wallet, Clock, Info, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths, eachDayOfInterval, isSameDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

export function Dashboard() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'logs'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog));
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error("Dashboard onSnapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'logs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const monthInterval = {
    start: startOfMonth(viewDate),
    end: endOfMonth(viewDate)
  };

  const monthLogs = logs.filter(l => {
    if (!l.date) return false;
    try {
      const d = parseISO(l.date);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    } catch (e) {
      return false;
    }
  });

  // Prepare chart data
  const daysInMonth = eachDayOfInterval(monthInterval);
  const chartData = daysInMonth.map(day => {
    const dayLog = monthLogs.find(l => {
      try {
        const d = parseISO(l.date);
        return !isNaN(d.getTime()) && isSameDay(d, day);
      } catch (e) {
        return false;
      }
    });

    let hours = 0;
    if (dayLog) {
      if (dayLog.type === 'work' && dayLog.startTime && dayLog.endTime) {
        try {
          const start = new Date(`1970-01-01T${dayLog.startTime}:00`);
          const end = new Date(`1970-01-01T${dayLog.endTime}:00`);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            hours = ((end.getTime() - start.getTime()) / 60000 - dayLog.breakMinutes) / 60;
          }
        } catch (e) {
          console.error("Date calc error:", e);
        }
      } else if (dayLog.type !== 'work') {
        hours = 8; // Standard credit
      }
    }
    return {
      name: format(day, 'dd'),
      hours: parseFloat(hours.toFixed(1)),
      type: dayLog?.type || 'none',
      isViolation: dayLog?.isComplianceViolation || false
    };
  });

  // Prepare project data
  const projectStats = monthLogs.reduce((acc: any, log) => {
    const name = log.project || 'Uncategorized';
    if (!acc[name]) acc[name] = 0;
    acc[name]++;
    return acc;
  }, {});
  const projectChartData = Object.entries(projectStats).map(([name, value]) => ({ name, value }));

  const totalMinutes = monthLogs.reduce((acc, log) => {
    // If it's a holiday/vacation/sick day, it usually counts as 8h (480 min)
    if (log.type !== 'work') {
      return acc + 480;
    }
    
    if (!log.startTime || !log.endTime) return acc;
    try {
      const start = new Date(`1970-01-01T${log.startTime.includes(':') ? log.startTime : '00:00'}:00`);
      const end = new Date(`1970-01-01T${log.endTime.includes(':') ? log.endTime : '00:00'}:00`);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
      let diff = (end.getTime() - start.getTime()) / 60000;
      return acc + (diff - log.breakMinutes);
    } catch (e) {
      return acc;
    }
  }, 0);

  const totalPayBreakdown = monthLogs.reduce((acc, log) => {
    const { taxable, taxFree } = calculatePay(log, profile?.hourlyRate || 0, profile?.state);
    return {
      taxable: acc.taxable + taxable,
      taxFree: acc.taxFree + taxFree,
      total: acc.total + taxable + taxFree
    };
  }, { taxable: 0, taxFree: 0, total: 0 });

  const totalPay = totalPayBreakdown.total;
  const totalHours = totalMinutes / 60;
  
  // Example expected hours: 40h/week * 4 weeks = 160h
  const expectedHours = (profile?.weeklyContractHours || 40) * 4;
  const overtime = Math.max(0, totalHours - expectedHours);
  const violations = logs.filter(l => l.isComplianceViolation).length;

  const usedVacationDays = logs.filter(l => l.type === 'vacation').length;
  const remainingVacation = (profile?.vacationDaysPerYear || 20) - usedVacationDays;

  const stats = [
    { label: 'WORK_HOURS', value: `${totalHours.toFixed(1)}H`, target: `${expectedHours}H`, icon: Clock },
    { label: 'EST_GROSS', value: `${totalPay.toFixed(2)}€`, icon: Wallet },
    { label: 'VACATION', value: `${remainingVacation}D`, target: `OF ${profile?.vacationDaysPerYear || 20}D`, icon: TrendingUp },
    { label: 'VIOLATIONS', value: violations, icon: AlertCircle },
  ];

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'logs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `logs/${id}`);
    }
  };  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center space-y-8">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
      <p className="text-white/40 text-sm font-black uppercase tracking-[0.3em] animate-pulse">Synchronizing Cycle...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-6xl mx-auto pb-32">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="text-left">
          <h1 className="text-4xl sm:text-5xl font-black leading-none tracking-tighter molten-gradient-text uppercase">Operational <span className="text-white">Grid</span></h1>
          <p className="text-white/40 font-black mt-3 text-xs uppercase tracking-[0.3em] leading-none">Cycle Window: {format(viewDate, 'MMMM yyyy')}</p>
        </div>
        <div className="flex items-center bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-1.5 shadow-2xl w-full sm:w-auto">
          <button 
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className="p-3 hover:bg-white/10 text-white/40 hover:text-white transition-all rounded-2xl active:scale-90"
          >
            &larr;
          </button>
          <span className="px-8 text-xs font-black text-white uppercase tracking-[0.25em] flex-1 text-center min-w-[140px]">
            {format(viewDate, 'MMM yyyy')}
          </span>
          <button 
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className="p-3 hover:bg-white/10 text-white/40 hover:text-white transition-all rounded-2xl active:scale-90"
          >
            &rarr;
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-8 flex flex-col group"
          >
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-hover:text-white/60 transition-colors">{stat.label}</p>
              <div className={`p-2.5 rounded-2xl transition-all shadow-lg ${
                stat.label === 'VIOLATIONS' && violations > 0 
                  ? 'bg-red-500/20 text-red-500 border border-red-500/30' 
                  : 'bg-white/10 text-white border border-white/20'
              }`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-auto">
              <span className="text-4xl font-black tracking-tighter text-white font-mono">{stat.value}</span>
              {stat.target && <p className="text-[9px] mt-2 font-black text-white/20 uppercase tracking-[0.15em]">{stat.target}</p>}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-10 h-[400px]">
          <h2 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-10 text-left">Neural Frequency Distribution</h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="rgba(255,255,255,0.2)" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.2)" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ backgroundColor: 'rgba(10,10,20,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '24px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                labelStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontWeight: 'bold' }}
              />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isViolation ? '#ff2e2e' : entry.type === 'work' ? '#fff' : '#1e90ff'} 
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-10 h-[400px] hidden lg:block">
          <h2 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-10 text-left">Asset Matrix</h2>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={projectChartData}
                cx="50%"
                cy="50%"
                innerRadius={85}
                outerRadius={120}
                paddingAngle={8}
                dataKey="value"
              >
                {projectChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#fff', '#1e90ff', '#f9a826', '#ff2e2e', '#ff00ff'][index % 5]} stroke="none" fillOpacity={0.7} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(10,10,20,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '24px', backdropFilter: 'blur(20px)' }}
                itemStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-black flex items-center gap-4 text-white uppercase tracking-tighter text-left">
            Recent Transmissions
            <div className="h-4 w-[2px] bg-white/10" />
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Live Stream</span>
          </h2>
          
          <div className="space-y-4">
            {logs.length === 0 ? (
              <div className="glass-card p-20 text-center border-dashed border-white/10">
                <Info className="w-16 h-16 text-white/10 mx-auto mb-6" />
                <p className="text-white/40 font-black uppercase tracking-[0.2em] text-xs">No active sequences detected.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="glass-card p-6 flex items-center justify-between group hover:bg-white/5 border border-white/10 transition-all">
                    <div className="flex items-center gap-6">
                      <div className="text-center min-w-[60px] bg-white/5 p-3 rounded-2xl border border-white/10">
                        <p className="text-xl font-black text-white leading-none">
                          {(() => {
                            try {
                              const d = parseISO(log.date);
                              return isNaN(d.getTime()) ? '??' : format(d, 'dd');
                            } catch (e) { return '??'; }
                          })()}
                        </p>
                        <p className="text-[9px] text-white/40 uppercase font-black mt-1">
                          {(() => {
                            try {
                              const d = parseISO(log.date);
                              return isNaN(d.getTime()) ? '???' : format(d, 'MMM');
                            } catch (e) { return '???'; }
                          })()}
                        </p>
                      </div>
                      <div className="space-y-2 text-left">
                        <p className="text-sm font-black text-white tracking-widest font-mono uppercase">
                          {log.startTime && log.endTime ? `${log.startTime} — ${log.endTime}` : log.type}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border leading-none tracking-widest ${
                            log.type === 'work' ? 'border-white/20 text-white bg-white/10' :
                            log.type === 'vacation' ? 'border-[#1e90ff]/20 text-[#1e90ff] bg-[#1e90ff]/10' :
                            'border-[#f9a826]/20 text-[#f9a826] bg-[#f9a826]/10'
                          }`}>
                            {log.type}
                          </span>
                          {profile?.state && isPublicHoliday(log.date, profile.state) && (
                            <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg border border-orange-500/40 text-orange-400 bg-orange-500/20 leading-none tracking-widest">
                              Double Boost
                            </span>
                          )}
                          {log.project && <span className="text-[9px] text-white/20 uppercase font-black tracking-widest leading-none">@ {log.project}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {log.isComplianceViolation && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />}
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-3 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all active:scale-90"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter text-left">Protocol Guard</h2>
          <div className="bg-gradient-to-br from-[#1e90ff]/20 to-transparent border border-[#1e90ff]/30 p-8 rounded-[40px] relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <p className="text-[10px] font-black text-[#1e90ff] uppercase tracking-[0.4em] text-left">
                Safety Core: ArbZG
              </p>
              <div className="space-y-4">
                <LegalPoint text="11h Neural Rest Period required" />
                <LegalPoint text="30m Buffer after 6h active cycle" />
                <LegalPoint text="45m Buffer after 9h active cycle" />
                <LegalPoint text="Max 10h Peak Output per day" />
              </div>
            </div>
            <Clock className="absolute -bottom-12 -right-12 w-48 h-48 text-[#1e90ff] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000" />
          </div>

          <h2 className="text-2xl font-black text-white pt-4 uppercase tracking-tighter text-left">Bio Metrics</h2>
          <div className="glass-card p-10 space-y-10">
            <div className="flex items-center justify-between">
              <div className="space-y-2 text-left">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Rest Cycles Remaining</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-white leading-none font-mono">{remainingVacation}</span>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Days</span>
                </div>
              </div>
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="8"
                    className="transition-all"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    fill="none"
                    stroke="white"
                    strokeWidth="8"
                    strokeDasharray={263.9}
                    strokeDashoffset={263.9 * (1 - Math.min(1, remainingVacation / (profile?.vacationDaysPerYear || 20)))}
                    className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                   <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] text-left">Integrity Level</p>
                <span className="text-xs font-black text-white">{Math.max(0, 100 - (violations * 10))}%</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10">
                <div 
                   className="h-full bg-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.8)]" 
                   style={{ width: `${Math.max(0, 100 - (violations * 10))}%` }} 
                />
              </div>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] text-left">Cycle Projection</p>
                <span className="text-xs font-black text-[#1e90ff]">{(totalHours / expectedHours * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden border border-white/10">
                <div 
                   className="h-full bg-[#1e90ff] shadow-[0_0_20px_rgba(30,144,255,0.5)] transition-all" 
                   style={{ width: `${Math.min(100, (totalHours / expectedHours) * 100)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegalPoint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-4 text-xs leading-relaxed text-white font-bold text-left">
      <div className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
      <span className="tracking-wide uppercase text-[10px]">{text}</span>
    </div>
  );
}
