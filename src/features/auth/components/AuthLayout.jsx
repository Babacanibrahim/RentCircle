import React from "react";
import { motion } from "framer-motion";

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="page-layout flex flex-col lg:flex-row antialiased selection:bg-blue-500/30">
      {/* SOL BLOK: Premium Güven & Topluluk İllüstrasyon Alanı */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between bg-slate-800/20 p-16 relative overflow-hidden border-r border-slate-700/50">
        {/* Arka Plan Modern Küre Efektleri */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px]" />

        {/* Logo Area */}
        <div className="flex items-center space-x-3 z-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/30">
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-100">RentCircle</span>
        </div>

        {/* Dinamik Grafik / Soyut Çizim Alanı */}
        <div className="relative w-full max-w-sm mx-auto my-auto aspect-square z-10 flex items-center justify-center">
          <svg
            className="w-4/5 h-4/5 animate-[spin_120s_linear_infinite]"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" stroke="url(#paint0_linear)" strokeWidth="2" strokeDasharray="8 8" />
            <circle cx="100" cy="100" r="55" stroke="url(#paint1_linear)" strokeWidth="1.5" />
            <path d="M65 100C65 80.67 80.67 65 100 65C119.33 65 135 80.67 135 100" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <path d="M135 100C135 119.33 119.33 135 100 135" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
            <defs>
              <linearGradient id="paint0_linear" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="paint1_linear" x1="100" y1="45" x2="100" y2="155" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#3b82f6" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-2">
            <div className="cyber-card !rounded-full p-4 border border-slate-600 shadow-xl">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Motto */}
        <div className="space-y-4 z-10 max-w-md">
          <h1 className="text-4xl font-black tracking-tight leading-tight text-slate-100">
            Yılda Birkaç Kez Kullanacağın <br /> Eşyaları Güvenle Kirala.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            RentCircle ile topluluğunun gücünü keşfet. İhtiyacın olan eşyaları yanı başındaki insanlardan kiralayarak hem tasarruf et, hem
            güvenli ticaretin keyfini çıkar, hem de israfın önüne geç.
          </p>
        </div>

        <div className="text-xs text-slate-500 z-10">© {new Date().getFullYear()} RentCircle. Paylaşım Ekonomisi Ağı.</div>
      </div>

      {/* SAĞ BLOK: Animasyonlu Form Alanı */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 sm:p-12 lg:p-16">
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-slate-100">{title}</h2>
            <p className="text-slate-400 text-sm">{subtitle}</p>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;
