import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center p-4 selection:bg-rose-500/30">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-500/10 blur-[100px] pointer-events-none" />

        <h1 className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-100 to-slate-800 tracking-tighter">
          404
        </h1>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-200 uppercase tracking-widest">Sistem Uyarısı</h2>
          <p className="text-slate-400 font-mono text-sm max-w-sm mx-auto">
            Aradığınız sayfa veritabanımızda bulunamadı veya hiç var olmadı.
          </p>
        </div>

        <div className="pt-8">
          <Link
            to="/dashboard"
            className="btn-slate inline-flex bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 px-8 py-3 rounded-xl font-bold transition-all shadow-xl">
            Ana Sayfaya Dön
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
