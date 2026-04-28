/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { loginWithGoogle } from '../lib/firebase';
import { Clock, ShieldCheck, Euro, FileText } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/network-request-failed') {
        setError("Network error. Please check your connection and try again.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in window was closed. Please try again.");
      } else {
        setError("AUTHENTICATION FAILED. Please try once more.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 glass-card rounded-[48px] relative z-10 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-white/20">
        <div className="p-12 md:p-16 flex flex-col justify-center space-y-12 relative overflow-hidden group bg-black/40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.05),transparent)]" />
          
          <div className="relative z-10 space-y-6 text-left">
            <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center shadow-2xl mb-8 border border-white/10 group-hover:border-white/30 transition-all duration-700">
               <Clock className="w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            </div>
            <h1 className="text-3xl font-black tracking-[0.2em] text-white/40 mb-2 uppercase">ZeitGeist</h1>
            <h2 className="text-5xl md:text-7xl font-black leading-none tracking-tighter text-white">
              Shatter the <br/> <span className="molten-gradient-text uppercase">standard.</span> <br/> Log reality.
            </h2>
          </div>
          
          <div className="relative z-10 space-y-6 pt-12 border-t border-white/10">
            <FeatureItem icon={ShieldCheck} text="Protocol Compliance: Active" />
            <FeatureItem icon={Euro} text="Emerald Engine: Online" />
            <FeatureItem icon={FileText} text="Neural Logs: Synchronized" />
          </div>
        </div>

        <div className="p-12 md:p-16 flex flex-col justify-center items-center space-y-12 bg-[#0a0a0a]">
           <div className="text-center space-y-6">
            <div className="inline-block px-6 py-2 rounded-full bg-white text-[10px] font-black text-black uppercase tracking-[0.4em] mb-4 shadow-xl">
              Secure Gateway
            </div>
            <h3 className="text-4xl font-black text-white leading-none uppercase tracking-tighter">Initial Access</h3>
            <p className="text-white/40 text-xs font-black uppercase tracking-widest mt-4">Authenticate via Google SSO node</p>
          </div>

          <div className="w-full space-y-8">
            <button
               onClick={handleLogin}
              className="flex items-center gap-5 bg-white hover:bg-neutral-200 text-black px-10 py-6 rounded-3xl transition-all active:scale-[0.98] w-full justify-center group shadow-[0_20px_40px_rgba(255,255,255,0.05)] border border-neutral-700"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6 opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="font-black tracking-[0.2em] text-xs uppercase text-black">Connect to Cluster</span>
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-red-500 text-white rounded-[24px] text-center shadow-xl border border-red-600"
              >
                <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">{error}</p>
              </motion.div>
            )}
          </div>

          <p className="text-[10px] text-center text-white/20 max-w-[300px] font-black uppercase tracking-[0.2em] leading-relaxed">
            Encrypted session protocols active. <br/> Integrated with ArbZG & GDPR standards.
          </p>
        </div>
      </div>
    </div>

  );
}

function FeatureItem({ icon: Icon, text }: { icon: any, text: string }) {
  return (
    <div className="flex items-center gap-4 group">
      <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:bg-[#00f2ff]/10 group-hover:border-[#00f2ff]/30 transition-all duration-500">
        <Icon className="w-4 h-4 text-white/20 group-hover:text-[#00f2ff]" />
      </div>
      <p className="font-bold text-xs tracking-wide text-white/40 group-hover:text-white/80 transition-colors">{text}</p>
    </div>
  );
}
