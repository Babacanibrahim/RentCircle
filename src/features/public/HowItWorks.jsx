import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const HowItWorks = () => {
  const steps = [
    {
      icon: "🔍",
      title: "1. İhtiyacın Olanı Bul",
      desc: "Aradığın ürünü kolayca bul. İstersen hemen kirala, istersen ürün sahibiyle mesajlaşarak kendi fiyat veya tarih teklifini sun.",
      color: "from-blue-500 to-cyan-400"
    },
    {
      icon: "🛡️",
      title: "2. Güvenle Ödeme Yap",
      desc: "Paran anında karşı tarafa aktarılmaz. Sen ürünü fiziki olarak teslim alıp onaylayana kadar ödemen RentCircle güvencesiyle havuzda bekler.",
      color: "from-indigo-500 to-blue-500"
    },
    {
      icon: "🤝",
      title: "3. Buluş ve Teslim Al",
      desc: "Ürün sahibiyle anlaştığınız konumda buluşun. Ürünü kontrol edip sistem üzerinden teslim aldığını onayla ve rahatça kullanmaya başla.",
      color: "from-emerald-500 to-teal-400"
    },
    {
      icon: "✅",
      title: "4. İade Et ve Depozitona Kavuş",
      desc: "İşin bittiğinde ürünü sahibine sorunsuzca iade et. İade işlemi onaylandığı saniye, güvence bedelin (depozito) anında hesabına geri yatsın.",
      color: "from-amber-500 to-orange-400"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col pt-16 pb-20 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 flex-1">
        
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-black tracking-widest text-[10px] uppercase mb-6">
            %100 GÜVENLİ KİRALAMA DENEYİMİ
          </motion.div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight mb-6">
            RentCircle <span className="text-blue-500">Nasıl Çalışır?</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Eşya kiralamak hiç bu kadar kolay ve güvenli olmamıştı. Sadece birkaç tıkla ihtiyacınız olan ürüne ulaşın, paranızın ve eşyalarınızın güvenliğini bize bırakın.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              className="cyber-card p-8 border border-slate-700/50 bg-[#1e293b]/50 backdrop-blur-sm relative overflow-hidden group">
              <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${step.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
              
              <div className="text-4xl mb-6">{step.icon}</div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">{step.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center">
          <Link to="/dashboard" className="btn-gradient !px-8 !py-4 text-sm font-bold tracking-wider uppercase shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all inline-block">
            İlanları Keşfetmeye Başla 🚀
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default HowItWorks;