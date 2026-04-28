/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { TimeLog, PayrollResult } from '../types';
import { calculateGermanPayroll, PayrollParams } from '../lib/payroll';
import { calculatePay } from '../lib/compliance';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  User, 
  Building2, 
  Coins, 
  ChevronRight,
  Info,
  ExternalLink,
  Target,
  ChevronLeft,
  Clock,
  Zap,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Download,
  Briefcase
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getFinancialInsights, FinancialInsight } from '../services/insightService';
import { generatePayslipPDF } from '../services/pdfService';

export function Salary() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [params, setParams] = useState<PayrollParams>({
    grossPay: 0,
    taxClass: 1,
    hasChurchTax: false,
    hasChildren: false,
    isChildlessOver23: true,
    state: 'BY',
    isPublicInsurance: true
  });

  useEffect(() => {
    if (profile) {
      setParams(prev => ({
        ...prev,
        taxClass: (profile.taxClass as any) || 1,
        hasChurchTax: profile.hasChurchTax || false,
        hasChildren: profile.hasChildren || false,
        isChildlessOver23: profile.isChildlessOver23 !== undefined ? profile.isChildlessOver23 : true,
        state: profile.state || 'BY'
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);

    const q = query(
      collection(db, 'logs'),
      where('userId', '==', user.uid),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog));
      setLogs(logData);
      setLoading(false);
    }, (error) => {
      console.error("Salary onSnapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, viewDate]);

  const totalBreakdown = React.useMemo(() => {
    return logs.reduce((acc, log) => {
      const { taxable, taxFree } = calculatePay(log, profile?.hourlyRate || 0, profile?.state);
      return {
        taxable: acc.taxable + taxable,
        taxFree: acc.taxFree + taxFree
      };
    }, { taxable: 0, taxFree: 0 });
  }, [logs, profile?.hourlyRate, profile?.state]);

  const projectBreakdown = React.useMemo(() => {
    const projects: Record<string, { total: number; taxable: number; taxFree: number; hours: number }> = {};
    logs.forEach(log => {
      const pName = log.project || 'Unassigned';
      if (!projects[pName]) projects[pName] = { total: 0, taxable: 0, taxFree: 0, hours: 0 };
      
      const { taxable, taxFree } = calculatePay(log, profile?.hourlyRate || 0, profile?.state);
      projects[pName].total += taxable + taxFree;
      projects[pName].taxable += taxable;
      projects[pName].taxFree += taxFree;
      
      if (log.startTime && log.endTime) {
        try {
          const startStr = log.startTime.includes(':') ? log.startTime : '00:00';
          const endStr = log.endTime.includes(':') ? log.endTime : '00:00';
          const start = parseISO(`2000-01-01T${startStr}`);
          const end = parseISO(`2000-01-01T${endStr}`);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const mins = (end.getTime() - start.getTime()) / (1000 * 60) - (log.breakMinutes || 0);
            projects[pName].hours += mins / 60;
          }
        } catch (e) { /* skip malformed */ }
      }
    });
    return Object.entries(projects).map(([name, data]) => ({ name, ...data }));
  }, [logs, profile?.hourlyRate, profile?.state]);

  const calcParams: PayrollParams = React.useMemo(() => ({
    grossPay: totalBreakdown.taxable + totalBreakdown.taxFree,
    taxableGross: totalBreakdown.taxable,
    taxFreeBonus: totalBreakdown.taxFree,
    taxClass: params.taxClass,
    hasChurchTax: params.hasChurchTax,
    hasChildren: params.hasChildren,
    isChildlessOver23: params.isChildlessOver23,
    state: params.state,
    isPublicInsurance: params.isPublicInsurance
  }), [totalBreakdown, params]);

  useEffect(() => {
    let isMounted = true;
    const runCalc = async () => {
      if (calcParams.taxableGross === 0 && calcParams.taxFreeBonus === 0) {
        setResult(null);
        return;
      }
      const res = await calculateGermanPayroll(calcParams);
      if (isMounted) setResult(res);
    };
    runCalc();
    return () => { isMounted = false; };
  }, [calcParams]);

  useEffect(() => {
    if (!result || logs.length === 0) {
      setInsights([]);
      return;
    }

    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const data = await getFinancialInsights(result, logs, profile);
        setInsights(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchInsights();
  }, [result, logs, profile]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center space-y-8">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
      <p className="text-white/40 text-sm font-black uppercase tracking-[0.3em] animate-pulse">Calculating Matrix...</p>
    </div>
  );

  const chartColors = ['#fff', '#1e90ff', '#f9a826', '#ff2e2e', '#ff00ff'];

  const chartData = result ? [
    { name: 'Net Pay', value: result.net - result.taxFreeBonus },
    { name: 'Tax-Free Bonus', value: result.taxFreeBonus },
    { name: 'Income Tax', value: result.taxes.incomeTax },
    { name: 'Social Security', value: result.socialSecurity.total },
    { name: 'Church/Soli', value: result.taxes.churchTax + result.taxes.solidaritySurcharge },
  ] : [];

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-6xl mx-auto pb-32">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
        <div className="text-left">
          <h1 className="text-4xl sm:text-5xl font-black leading-none tracking-tighter molten-gradient-text uppercase">Earnings <span className="text-white">Projection</span></h1>
          <div className="flex items-center gap-1 mt-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-1.5 w-fit shadow-2xl">
             <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-3 hover:bg-white/10 hover:text-white transition-all rounded-xl text-white/40 active:scale-90">
               <ChevronLeft className="w-4 h-4" />
             </button>
             <p className="text-white font-black uppercase tracking-[0.2em] text-[10px] px-4">{format(viewDate, 'MMMM yyyy')}</p>
             <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-3 hover:bg-white/10 hover:text-white transition-all rounded-xl text-white/40 active:scale-90">
               <ChevronRight className="w-4 h-4" />
             </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <button 
            disabled={!result}
            onClick={() => result && generatePayslipPDF(result, logs, profile, viewDate)}
            className="flex items-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-3xl text-[11px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-30"
          >
            <Download className="w-5 h-5" />
            Export Protocol
          </button>
          <div className="flex items-center gap-6 glass-card p-6 rounded-[36px] border border-white/20">
            <div className="bg-white/10 border border-white/20 p-3 rounded-2xl text-white shadow-xl">
              <Coins className="w-7 h-7" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] leading-none mb-2">Net Distribution</p>
              <p className="text-4xl font-black text-white leading-none font-mono">{result?.net.toFixed(2)}€</p>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {insights.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {insights.map((insight, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -6 }}
                className={`p-6 rounded-[32px] border transition-all glass-card ${
                  insight.type === 'success' ? 'border-[#10b981]/40' :
                  insight.type === 'warning' ? 'border-[#ff2e2e]/40' :
                  insight.type === 'optimization' ? 'border-[#1e90ff]/40' :
                  'border-white/10'
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-2 rounded-xl shadow-lg ${
                    insight.type === 'success' ? 'bg-[#10b981] text-white' :
                    insight.type === 'warning' ? 'bg-[#ff2e2e] text-white' :
                    insight.type === 'optimization' ? 'bg-[#1e90ff] text-white' :
                    'bg-white/10 text-white'
                  }`}>
                    {insight.type === 'success' ? <TrendingUp className="w-4 h-4" /> :
                     insight.type === 'warning' ? <Info className="w-4 h-4" /> :
                     insight.type === 'optimization' ? <Zap className="w-4 h-4" /> :
                     <Sparkles className="w-4 h-4" />}
                  </div>
                  <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-white">{insight.title}</h4>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed font-bold text-left">{insight.description}</p>
              </motion.div>
            ))}
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-10 flex flex-col justify-between">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 text-left">Taxable Base</p>
              <h2 className="text-4xl font-black text-white tracking-tighter font-mono text-left">{result?.taxableGross.toFixed(2)}€</h2>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="glass-card p-10 border-[#10b981]/30 flex flex-col justify-between">
              <p className="text-[10px] font-black text-[#10b981] uppercase tracking-[0.3em] mb-4 text-left">Tax-Free Boost</p>
              <h2 className="text-4xl font-black text-white tracking-tighter font-mono text-left">{result?.taxFreeBonus.toFixed(2)}€</h2>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="glass-card p-10 border-[#1e90ff]/30 sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
              <p className="text-[10px] font-black text-[#1e90ff] uppercase tracking-[0.3em] mb-4 text-left">Net Resolution</p>
              <h2 className="text-4xl font-black text-white tracking-tighter font-mono text-left">{result?.net.toFixed(2)}€</h2>
            </motion.div>
          </div>

          {projectBreakdown.length > 0 && (
            <div className="glass-card p-12 space-y-10">
              <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-4 text-left">
                <Briefcase className="w-5 h-5 text-white/40" />
                Revenue Matrix by Sector
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projectBreakdown.map((project, idx) => (
                  <div key={idx} className="p-8 bg-white/5 border border-white/10 rounded-[32px] flex items-center justify-between group hover:bg-white hover:shadow-2xl transition-all duration-500">
                    <div className="text-left">
                      <p className="text-base font-black text-white group-hover:text-black transition-colors">{project.name}</p>
                      <p className="text-[10px] text-white/30 group-hover:text-black/40 uppercase font-black tracking-widest mt-2">{project.hours.toFixed(1)} Cycles Logged</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white group-hover:text-black transition-colors font-mono">{project.total.toFixed(2)}€</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card p-12 space-y-12">
            <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-4 text-left">
              <Info className="w-5 h-5 text-white/40" />
              Taxation Spectrum
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="h-[350px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={90} outerRadius={120} paddingAngle={8} dataKey="value">
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} stroke="none" fillOpacity={0.8} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(10,10,20,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '24px', backdropFilter: 'blur(20px)' }} itemStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-8 text-left">
                <div>
                  <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] mb-6">Governmental Slice</p>
                  <div className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/10 shadow-inner">
                    <span className="text-[10px] text-white/60 font-black uppercase tracking-widest">Income Diversion</span>
                    <span className="font-black text-xs text-red-500">-{result?.taxes.incomeTax.toFixed(2)}€</span>
                  </div>
                </div>
                <div className="space-y-4 pt-4">
                   <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] mb-6">Social Shield Contributions</p>
                   <div className="flex justify-between items-center px-4"><span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Pension (RV)</span><span className="font-black text-xs text-white">-{result?.socialSecurity.pension.toFixed(2)}€</span></div>
                   <div className="flex justify-between items-center px-4"><span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Medical (KV)</span><span className="font-black text-xs text-white">-{result?.socialSecurity.health.toFixed(2)}€</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          <div className="glass-card p-10 space-y-8">
            <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] text-left">Sector Tax Class</h3>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((tc) => (
                <button
                  key={tc}
                  onClick={() => setParams(p => ({ ...p, taxClass: tc as any }))}
                  className={`py-5 rounded-2xl text-[11px] font-black border transition-all active:scale-95 ${params.taxClass === tc ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'}`}
                >
                  {tc}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#10b981]/20 to-transparent border border-[#10b981]/30 p-10 rounded-[44px] space-y-8 group transition-all">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-white rounded-2xl text-black shadow-2xl group-hover:scale-110 transition-transform"><Target className="w-6 h-6" /></div>
               <h4 className="text-[12px] font-black text-white uppercase tracking-[0.2em] leading-none text-left">Refund Protocol</h4>
             </div>
             <div className="py-8 border-y border-white/10">
                <div className="flex items-center justify-between"><span className="text-[10px] text-white/30 font-black uppercase tracking-widest text-left">Potential <br/> Recovery</span><span className="text-4xl font-black text-[#10b981] font-mono">{result ? (result.taxes.incomeTax * 0.15).toFixed(2) : '0.00'}€</span></div>
             </div>
             <p className="text-[10px] text-white/20 italic text-left font-bold tracking-wide">Estimated 15% recovery potential based on computational standard deductions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsOverlay() { return null; }
