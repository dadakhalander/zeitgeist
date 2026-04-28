import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  ArrowRight, 
  ChevronRight, 
  BarChart3, 
  PieChart as PieChartIcon,
  AlertCircle,
  CheckCircle2,
  Zap,
  Clock,
  Euro,
  Scale,
  TrendingUp,
  ShieldCheck,
  FileSearch,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Heart,
  Briefcase,
  Users,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './FirebaseProvider';
import { parsePayslipText, ParsedPayslip } from '../services/payslipService';
import { 
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { format, parse } from 'date-fns';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker with a specific version to ensure compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export function Payslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<(ParsedPayslip & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<(ParsedPayslip & { id: string }) | null>(null);
  const [pendingParsedData, setPendingParsedData] = useState<ParsedPayslip | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prepare comparison benchmarks
  const averages = useMemo(() => {
    if (payslips.length === 0) return null;
    return {
      net: payslips.reduce((acc, s) => acc + s.netAmount, 0) / payslips.length,
      gross: payslips.reduce((acc, s) => acc + s.grossAmount, 0) / payslips.length,
      tax: payslips.reduce((acc, s) => acc + s.taxAmount, 0) / payslips.length,
      social: payslips.reduce((acc, s) => acc + s.socialAmount, 0) / payslips.length,
      efficiency: (payslips.reduce((acc, s) => acc + (s.netAmount / (s.grossAmount || 1)), 0) / payslips.length) * 100
    };
  }, [payslips]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'payslips'),
      where('userId', '==', user.uid),
      orderBy('period', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (ParsedPayslip & { id: string })[];
      setPayslips(data);
      setLoading(false);
    }, (error) => {
      console.error("Payslips loading error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    setProcessStatus('Accessing Neural Core...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use standard loading Task with legacy support options for version 3.x
      const loadingTask = pdfjs.getDocument({ 
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
        disableFontFace: true,
        disableRange: true,
        disableAutoFetch: true
      });
      
      const pdf = await loadingTask.promise;
      setProcessStatus(`Mapping ${pdf.numPages} Nodes...`);
      let fullText = '';
      
      const maxPages = Math.min(pdf.numPages, 3);
      for (let i = 1; i <= maxPages; i++) {
        setProcessStatus(`Decoding Layer ${i}/${maxPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      if (!fullText.trim()) throw new Error("Empty Extraction Result");
      return fullText;
    } catch (err) {
      console.error("PDF.js Extraction Fault:", err);
      throw new Error("Local extraction protocol restricted. Please use 'Manual Input' to paste the text directly for safety.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsParsing(true);
    setStatusMsg(null);
    setPendingParsedData(null);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else {
        setProcessStatus('Reading Protocol...');
        text = await file.text();
      }

      setProcessStatus('AI Matrix Analysis...');
      const parsedData = await parsePayslipText(text);
      setPendingParsedData(parsedData);
      setProcessStatus('');
    } catch (e) {
      console.error(e);
      setStatusMsg({ type: 'error', text: e instanceof Error ? e.message : 'Upload protocol failure.' });
      setIsParsing(false);
      setProcessStatus('');
    }
  };

  const handleConfirmSync = async () => {
    if (!pendingParsedData || !user) return;
    
    const dataToSync = { ...pendingParsedData };
    setPendingParsedData(null); 
    setInputText('');
    setIsParsing(true);
    setProcessStatus('Archiving Quantum Data...');
    
    try {
      // Check for duplicates in local state first
      const exists = payslips.find(p => p.period === dataToSync.period);
      if (exists) {
        setPendingParsedData(dataToSync);
        throw new Error(`Temporal Conflict: Entry for ${dataToSync.period} already persists.`);
      }

      await addDoc(collection(db, 'payslips'), {
        ...dataToSync,
        userId: user.uid,
        createdAt: Date.now()
      });

      setStatusMsg({ type: 'success', text: 'Financial Matrix Synchronized Successfully.' });
    } catch (e) {
      console.error(e);
      setPendingParsedData(dataToSync); // Rollback on failure
      setStatusMsg({ type: 'error', text: e instanceof Error ? e.message : 'Sync failure.' });
    } finally {
      setIsParsing(false);
      setProcessStatus('');
    }
  };

  const handleManualParse = async () => {
    if (!inputText.trim() || !user) return;
    setIsParsing(true);
    setStatusMsg(null);
    setProcessStatus('AI Matrix Analysis...');
    try {
      const parsedData = await parsePayslipText(inputText);
      setPendingParsedData(parsedData);
    } catch (e) {
      console.error(e);
      setStatusMsg({ type: 'error', text: e instanceof Error ? e.message : 'Analysis failure.' });
    } finally {
      setIsParsing(false);
      setProcessStatus('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'payslips', id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin shadow-[0_0_20px_rgba(255,255,255,0.3)]"></div>
        <p className="text-white/40 font-black uppercase tracking-[0.3em] animate-pulse">Syncing Treasury...</p>
      </div>
    </div>
  );

  const COLORS = ['#1e90ff', '#f9a826', '#ff2e2e', '#a855f7'];

  const safeFormatPeriod = (period: string, outputFormat: string) => {
    try {
      if (!period || typeof period !== 'string') return 'N/A';
      const parsed = parse(period, 'yyyy-MM', new Date());
      if (isNaN(parsed.getTime())) return period; 
      return format(parsed, outputFormat);
    } catch (e) {
      return period;
    }
  };

  // Prepare chart data
  const historicalData = [...payslips].reverse().map(s => ({
    name: safeFormatPeriod(s.period, 'MMM yy'),
    Net: s.netAmount,
    Gross: s.grossAmount,
    Tax: s.taxAmount,
    Social: s.socialAmount,
    Health: s.healthIns || 0,
    Pension: s.pensionIns || 0,
    Unemployment: s.unemploymentIns || 0,
    Nursing: s.nursingIns || 0,
    Efficiency: (s.netAmount / s.grossAmount) * 100
  }));

  const latestSlip = payslips[0];
  const distributionData = latestSlip ? [
    { name: 'Net Pay', value: latestSlip.netAmount },
    { name: 'Income Tax', value: latestSlip.taxAmount },
    { name: 'Social Sec', value: latestSlip.socialAmount },
    { name: 'Others', value: Math.max(0, latestSlip.grossAmount - latestSlip.netAmount - latestSlip.taxAmount - latestSlip.socialAmount) }
  ] : [];

  // Comparison logic
  const getComparison = (current: ParsedPayslip, previous: ParsedPayslip | undefined) => {
    if (!previous) return null;
    const diff = current.netAmount - previous.netAmount;
    const percent = (diff / previous.netAmount) * 100;
    return { diff, percent };
  };

  return (
    <div className="p-4 md:p-8 space-y-12 max-w-7xl mx-auto pb-32">
      <AnimatePresence>
        {selectedSlip && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 overflow-y-auto bg-black/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar relative p-8 md:p-12 border-white/20 bg-slate-950"
            >
              <button 
                onClick={() => setSelectedSlip(null)}
                className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-12">
                <header className="space-y-4">
                  <div className="flex items-center gap-4 text-blue-400">
                    <Clock className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-[0.3em]">Historical Archive Result</span>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black molten-gradient-text uppercase">
                    {safeFormatPeriod(selectedSlip.period, 'MMMM yyyy')}
                  </h2>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="glass-card p-8 bg-white/5 border-white/10">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Net Revenue</p>
                    <p className="text-4xl font-black text-white font-mono">{selectedSlip.netAmount.toFixed(2)}€</p>
                    {payslips.indexOf(selectedSlip) < payslips.length - 1 && (() => {
                      const prev = payslips[payslips.indexOf(selectedSlip) + 1];
                      const comp = getComparison(selectedSlip, prev);
                      if (!comp) return null;
                      return (
                        <div className={`flex items-center gap-2 mt-4 text-[10px] font-black uppercase tracking-widest ${comp.diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {comp.diff >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {Math.abs(comp.percent).toFixed(1)}% vs Prev
                        </div>
                      );
                    })()}
                  </div>
                  <div className="glass-card p-8 bg-white/5 border-white/10">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Gross Theoretical</p>
                    <p className="text-4xl font-black text-white font-mono">{selectedSlip.grossAmount.toFixed(2)}€</p>
                  </div>
                  <div className="glass-card p-8 bg-white/5 border-white/10">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">Efficiency Rating</p>
                    <p className="text-4xl font-black text-white font-mono">{((selectedSlip.netAmount / selectedSlip.grossAmount) * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-8">
                     <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3">
                       <BarChart3 className="w-5 h-5" /> Deduction Distribution
                     </h3>
                     <div className="space-y-6">
                        {[
                          { label: 'Income Tax', val: selectedSlip.taxAmount || 0, color: 'bg-orange-500', icon: Scale, key: 'taxAmount' },
                          { label: 'Health Insurance', val: selectedSlip.healthIns || 0, color: 'bg-blue-500', icon: Stethoscope, key: 'healthIns' },
                          { label: 'Pension Fund', val: selectedSlip.pensionIns || 0, color: 'bg-purple-500', icon: ShieldCheck, key: 'pensionIns' },
                          { label: 'Unemployment', val: selectedSlip.unemploymentIns || 0, color: 'bg-red-500', icon: Briefcase, key: 'unemploymentIns' },
                          { label: 'Nursing Care', val: selectedSlip.nursingIns || 0, color: 'bg-emerald-500', icon: Heart, key: 'nursingIns' },
                        ].map((item, idx) => {
                          const prev = payslips[payslips.indexOf(selectedSlip) + 1];
                          const diff = prev ? (item.val - (prev[item.key as keyof ParsedPayslip] as number || 0)) : null;
                          
                          return (
                            <div key={idx} className="space-y-3">
                              <div className="flex justify-between items-end">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-lg ${item.color} bg-opacity-20 flex items-center justify-center`}>
                                    <item.icon className={`w-4 h-4 ${item.color.replace('bg-', 'text-')}`} />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60 block leading-none">{item.label}</span>
                                    {diff !== null && diff !== 0 && (
                                      <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}€
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm font-black text-white font-mono">{Number(item.val).toFixed(2)}€</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${item.color}`} 
                                  style={{ width: `${(Number(item.val) / selectedSlip.grossAmount) * 100}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                     </div>
                   </div>

                      {/* Benchmark Comparison Matrix */}
                      <div className="glass-card p-10 bg-white/2 space-y-10 h-fit self-start border-blue-500/10">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Benchmark Analysis</h3>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#1e90ff]" />
                            <span className="text-[8px] font-black text-white/40 uppercase">Current</span>
                            <div className="w-2 h-2 rounded-full bg-white/10" />
                            <span className="text-[8px] font-black text-white/40 uppercase">Average</span>
                          </div>
                        </div>
                        
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              layout="vertical"
                              data={[
                                { name: 'NET', current: selectedSlip.netAmount, avg: averages?.net },
                                { name: 'GROSS', current: selectedSlip.grossAmount, avg: averages?.gross },
                                { name: 'TAX', current: selectedSlip.taxAmount, avg: averages?.tax },
                                { name: 'SOC', current: selectedSlip.socialAmount, avg: averages?.social },
                              ]}
                              margin={{ left: 0, right: 30 }}
                            >
                              <XAxis type="number" hide />
                              <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900 }}
                                width={60}
                              />
                              <Tooltip 
                                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                              />
                              <Bar dataKey="avg" fill="rgba(255,255,255,0.05)" radius={[0, 4, 4, 0]} barSize={12} />
                              <Bar dataKey="current" fill="#1e90ff" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="h-[150px] w-full border-t border-white/5 pt-8">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: 'ST', val: selectedSlip.taxAmount, fill: '#f9a826' },
                              { name: 'KV', val: selectedSlip.healthIns, fill: '#1e90ff' },
                              { name: 'RV', val: selectedSlip.pensionIns, fill: '#a855f7' },
                              { name: 'AV', val: selectedSlip.unemploymentIns, fill: '#ff2e2e' },
                              { name: 'PV', val: selectedSlip.nursingIns, fill: '#10b981' }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} />
                              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#000', border: 'none' }} />
                              <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                                { [0,1,2,3,4].map((_entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#f9a826','#1e90ff','#a855f7','#ff2e2e','#10b981'][index]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">ST/SOLI (Tax)</p>
                          <p className="text-sm font-black text-orange-400 font-mono">{(selectedSlip.taxAmount || 0).toFixed(2)}€</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Total Social</p>
                          <p className="text-sm font-black text-red-500 font-mono">{(selectedSlip.socialAmount || 0).toFixed(2)}€</p>
                        </div>
                      </div>
                      
                      <p className="text-[9px] text-white/20 italic leading-relaxed">
                        *Spectral analysis indicates {((selectedSlip.taxAmount || 0) / (selectedSlip.grossAmount || 1) * 100).toFixed(1)}% Tax Leakage and {((selectedSlip.socialAmount || 0) / (selectedSlip.grossAmount || 1) * 100).toFixed(1)}% Social Contribution Overhead.
                      </p>
                      </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter molten-gradient-text uppercase">Spectral <span className="text-white">Treasury</span></h1>
          <p className="text-white/40 font-black mt-3 text-xs uppercase tracking-[0.3em] leading-none">Quantum Financial Analysis</p>
        </div>
        
        {latestSlip && (
          <div className="flex flex-wrap gap-4">
             <div className="glass-card px-8 py-4 bg-blue-500/10 border-blue-500/20 text-blue-400">
                <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50 text-left">Latest Net</p>
                <p className="text-2xl font-black font-mono">{latestSlip.netAmount.toFixed(2)}€</p>
             </div>
             <div className="glass-card px-8 py-4 bg-white/5 border-white/10 text-white">
                <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50 text-left">Yearly Accumulation</p>
                <p className="text-2xl font-black font-mono text-white">
                  {payslips.reduce((acc, curr) => acc + curr.netAmount, 0).toFixed(0)}€
                </p>
             </div>
             <div className="glass-card px-8 py-4 bg-purple-500/10 border-purple-500/20 text-purple-400">
                <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50 text-left">Avg Efficiency</p>
                <p className="text-2xl font-black font-mono">
                  {(payslips.reduce((acc, s) => acc + (s.netAmount / (s.grossAmount || 1)), 0) / (payslips.length || 1) * 100).toFixed(1)}%
                </p>
             </div>
          </div>
        )}
      </header>

      {/* Historical Trend Visualization */}
      {payslips.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 bg-white/2 border-white/5"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Financial Trajectory</h3>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1">Multi-month comparative analysis</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Gross</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Net</span>
              </div>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...payslips].reverse()}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e90ff" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1e90ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="period" 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={10} 
                  axisLine={false} 
                  tickFormatter={(val) => val.split('-')[1]}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="grossAmount" 
                  stroke="#1e90ff" 
                  fillOpacity={1} 
                  fill="url(#colorGross)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="netAmount" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorNet)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {pendingParsedData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card w-full max-w-2xl p-8 border-white/20 bg-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <FileSearch className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Confirm AI Extraction</h3>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mt-1">Review the identified protocol parameters</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-white/5 p-6 rounded-3xl border border-white/10 mb-8 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Period</p>
                    <p className="text-lg font-black text-white">{safeFormatPeriod(pendingParsedData.period, 'MMMM yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Gross Yield</p>
                    <p className="text-lg font-black text-white font-mono">{pendingParsedData.grossAmount.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Net Actual</p>
                    <p className="text-lg font-black text-blue-400 font-mono">{pendingParsedData.netAmount.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Lohnsteuer</p>
                    <p className="text-lg font-black text-orange-400 font-mono">{pendingParsedData.taxAmount.toFixed(2)}€</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Health (KV)</p>
                    <p className="text-lg font-black text-white font-mono">{pendingParsedData.healthIns.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Pension (RV)</p>
                    <p className="text-lg font-black text-white font-mono">{pendingParsedData.pensionIns.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Unemployment (AV)</p>
                    <p className="text-lg font-black text-white font-mono">{pendingParsedData.unemploymentIns.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Nursing (PV)</p>
                    <p className="text-lg font-black text-white font-mono">{pendingParsedData.nursingIns.toFixed(2)}€</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Hours / Rate</p>
                    <p className="text-lg font-black font-mono text-purple-400">
                      {pendingParsedData.hoursWorked.toFixed(1)}h / {pendingParsedData.hourlyRate.toFixed(2)}€
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setPendingParsedData(null)}
                  className="flex-1 h-[60px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Discard
                </button>
                <button 
                  disabled={isParsing}
                  onClick={handleConfirmSync}
                  className="flex-[2] neon-button h-[60px]"
                >
                  {isParsing ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {isParsing ? 'Syncing...' : 'Commit to Vault'}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload/Parse Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-8 border-white/20 bg-white/5 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/10 rounded-xl">
                <FileSearch className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Neural Uplink</h3>
            </div>
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-white/10 hover:border-white/30 rounded-3xl p-10 flex flex-col items-center gap-4 transition-all cursor-pointer bg-white/[0.02]"
            >
              <div className="p-4 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-white/40 group-hover:text-white" />
              </div>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-widest group-hover:text-white/60">
                Drop PDF Protocol or Click to Sync
              </p>
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept=".pdf,.txt"
                onChange={handleFileUpload}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[8px] uppercase font-black tracking-widest text-white/20">
                <span className="bg-slate-950 px-2 leading-none">Alternative Input</span>
              </div>
            </div>

            <textarea 
              className="glass-input w-full min-h-[150px] font-mono text-[9px] leading-tight p-4"
              placeholder="Paste raw matrix data..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />

            <button 
              disabled={isParsing || !inputText.trim()}
              onClick={handleManualParse}
              className="neon-button w-full h-[60px] disabled:opacity-50"
            >
              {isParsing ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isParsing ? processStatus || 'Processing...' : 'Manual Matrix Sync'}
              </span>
            </button>

            {statusMsg && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  statusMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-500'
                }`}
              >
                {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-[10px] font-black uppercase tracking-widest">{statusMsg.text}</span>
              </motion.div>
            )}
          </div>

          <div className="glass-card p-8 border-white/20 bg-white/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-8 text-left">Latest Breakdown</h3>
            {latestSlip ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {distributionData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '10px', color: '#fff' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="rect"
                      formatter={(value) => <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-white/10">
                <PieChartIcon className="w-12 h-12" />
              </div>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        <div className="lg:col-span-2 space-y-8">
          {payslips.length === 0 ? (
            <div className="glass-card p-20 flex flex-col items-center justify-center text-center space-y-6">
              <FileText className="w-16 h-16 text-white/10" />
              <p className="text-white/20 font-black uppercase tracking-[0.3em]">Temporal vault empty</p>
            </div>
          ) : (
            <>
              {/* Comparative Growth Chart */}
              <div className="glass-card p-10 border-white/20 bg-white/5 space-y-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em]">Spectral Growth Trajectory</h3>
                  </div>
                </div>
                
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      />
                      <Legend 
                         iconType="circle"
                         formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{value}</span>}
                      />
                      <Bar dataKey="Net" fill="#1e90ff" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Tax" fill="#f9a826" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Health" fill="#3b82f6" stackId="deductions" />
                      <Bar dataKey="Pension" fill="#a855f7" stackId="deductions" />
                      <Bar dataKey="Unemployment" fill="#ef4444" stackId="deductions" />
                      <Bar dataKey="Nursing" fill="#10b981" stackId="deductions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Deduction Analysis */}
              <div className="glass-card p-10 border-white/20 bg-white/5 space-y-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Scale className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em]">Efficiency Analysis</h3>
                </div>
                
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicalData}>
                      <defs>
                        <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1e90ff" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#1e90ff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      />
                      <Area type="monotone" dataKey="Efficiency" stroke="#1e90ff" strokeWidth={3} fillOpacity={1} fill="url(#colorEff)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Records List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {payslips.map((slip) => (
                  <motion.div 
                    layout
                    key={slip.id}
                    onClick={() => setSelectedSlip(slip)}
                    className="glass-card overflow-hidden group hover:bg-white/[0.07] transition-all cursor-pointer shadow-2xl hover:scale-[1.02] active:scale-95"
                  >
                    <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-widest">
                            {safeFormatPeriod(slip.period, 'MMMM yyyy')}
                          </p>
                          <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mt-1">Certified Revenue Protocol</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(slip.id)}
                        className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-8 grid grid-cols-2 gap-8 text-left">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Gross Matrix</p>
                        <p className="text-2xl font-black text-white font-mono">{slip.grossAmount.toFixed(2)}€</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Actual Yield</p>
                        <p className="text-2xl font-black text-white font-mono">{slip.netAmount.toFixed(2)}€</p>
                      </div>
                    </div>

                    {/* Breakdown bars */}
                    <div className="px-8 pb-8 space-y-6">
                       <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest leading-none">
                            <span className="text-white/40">Deduction Leakage</span>
                            <span className="text-white">{((1 - slip.netAmount / slip.grossAmount) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                            <div style={{ width: `${(slip.taxAmount / slip.grossAmount) * 100}%` }} className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,168,38,0.5)]" />
                            <div style={{ width: `${(slip.socialAmount / slip.grossAmount) * 100}%` }} className="h-full bg-red-500 shadow-[0_0_10px_rgba(255,46,46,0.5)]" />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Taxation</p>
                            <p className="text-sm font-black text-orange-400 font-mono">{slip.taxAmount.toFixed(2)}€</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Social</p>
                            <p className="text-sm font-black text-red-500 font-mono">{slip.socialAmount.toFixed(2)}€</p>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
