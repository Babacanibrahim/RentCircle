import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const PaymentFailed = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-slate-200 selection:bg-rose-500/30">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="cyber-card p-10 max-w-lg w-full text-center border-rose-500/30 shadow-2xl shadow-rose-500/10">
        <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
          <span className="text-5xl">❌</span>
        </div>

        <h1 className="text-2xl font-black text-rose-400 mb-3 tracking-wide uppercase">Ödeme Başarısız</h1>

        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Kiralama işleminiz sırasında bankanız veya ödeme altyapısı kaynaklı bir sorun oluştu. Kart limitinizi veya internet alışverişi
          onayınızı kontrol edip tekrar deneyebilirsiniz.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => navigate("/dashboard")} className="btn-slate px-6 py-3">
            Ana Sayfaya Dön
          </button>
          <button
            onClick={() => navigate(-1)} // Bir önceki sayfaya (İlan detayına) geri döndürür
            className="btn-gradient !bg-rose-500 !border-rose-400 px-6 py-3 shadow-lg shadow-rose-500/20">
            Tekrar Dene
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentFailed;
