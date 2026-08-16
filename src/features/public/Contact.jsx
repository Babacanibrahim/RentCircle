import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "../../utils/alerts"; // Yolunu kendi projene göre ayarla
import { authApi } from "../auth/services/authApi"; // authApi yolunu kendi projene göre ayarla

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 🎯 GERÇEK BACKEND İSTEĞİ: Servis katmanından çağrılıyor
      await authApi.contactMessage(formData);
      
      toast.fire({
        icon: "success",
        title: "Mesajınız Başarıyla İletildi",
        text: "Geri bildiriminiz için teşekkürler. En kısa sürede dönüş yapılacaktır.",
      });
      
      // İşlem başarılıysa formu temizle
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      toast.fire({
        icon: "error",
        title: "Gönderim Başarısız",
        text: "Mesajınız iletilemedi, lütfen e-posta üzerinden doğrudan ulaşmayı deneyin.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] selection:bg-blue-500/30 flex flex-col pt-16 pb-20 relative overflow-hidden">
      {/* Arka Plan Efektleri */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 flex-1">
        
        {/* Üst Başlık */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30 mx-auto mb-6">
            ✉️
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-100 tracking-tight mb-4">
            Bizimle <span className="text-blue-500">İletişime Geçin</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            RentCircle hakkında sorularınız, iş birliği teklifleriniz veya geri bildirimleriniz için formu doldurabilir veya doğrudan geliştirici ile irtibata geçebilirsiniz.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* SOL PANEL: HAKKIMDA VE İLETİŞİM BİLGİLERİ */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8">
            
            <div className="cyber-card p-8 border border-blue-500/20 bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 shadow-xl shadow-blue-900/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl transition-all group-hover:bg-blue-500/20" />
              
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-2 font-mono">Platform Geliştiricisi</h3>
              <h2 className="text-2xl font-bold text-slate-100 mb-1">İbrahim Babacan</h2>
              <p className="text-sm font-medium text-slate-400 mb-6">Bilgisayar Mühendisi | Backend & Siber Güvenlik</p>

              <div className="text-sm text-slate-300 leading-relaxed space-y-4 mb-8">
                <p>
                  RentCircle; veri güvenliğini, sıfır-güven (zero-trust) mimarisini ve modern web teknolojilerini bir araya getiren yeni nesil bir kiralama ekosistemidir.
                </p>
                <p>
                  Pamukkale Üniversitesi Bilgisayar Mühendisliği 4. sınıf öğrencisi olarak, Full-Stack geliştirme tecrübemi siber güvenlik prensipleriyle harmanlayarak bu platformu uçtan uca tasarladım.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
                    📧
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">E-Posta</div>
                    <a href="mailto:babacan-1907@outlook.com.tr" className="text-sm font-bold hover:text-blue-400 transition-colors">
                      babacan-1907@outlook.com.tr
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                    📱
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Telefon</div>
                    <a href="tel:+905533162352" className="text-sm font-bold hover:text-emerald-400 transition-colors">
                      +90 553 316 23 52
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                    📍
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Konum</div>
                    <span className="text-sm font-bold">
                      Denizli, Türkiye
                    </span>
                  </div>
                </div>
              </div>

              {/* Sosyal Medya */}
              <div className="mt-8 pt-6 border-t border-slate-700/50 flex gap-4">
                <a href="https://linkedin.com/in/20ibrahimbabacan20" target="_blank" rel="noopener noreferrer" className="btn-slate !px-4 !py-2 text-xs flex items-center gap-2 hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all">
                  <span>in</span> LinkedIn
                </a>
                <a href="https://github.com/Babacanibrahim" target="_blank" rel="noopener noreferrer" className="btn-slate !px-4 !py-2 text-xs flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-all">
                  <span>&lt;/&gt;</span> GitHub
                </a>
              </div>
            </div>
          </motion.div>

          {/* SAĞ PANEL: İLETİŞİM FORMU */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}>
            
            <div className="cyber-card p-8 border border-slate-700/50 bg-[#1e293b]/50 backdrop-blur-md">
              <h2 className="text-xl font-bold text-slate-100 mb-6">Mesaj Gönderin</h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Adınız Soyadınız</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="cyber-input w-full bg-slate-900/50 hover:border-blue-500/50 transition-colors"
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">E-Posta Adresiniz</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="cyber-input w-full bg-slate-900/50 hover:border-blue-500/50 transition-colors"
                    placeholder="ornek@email.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Konu</label>
                  <select
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="cyber-input w-full bg-slate-900/50 hover:border-blue-500/50 transition-colors cursor-pointer text-sm">
                    <option value="" disabled>Lütfen bir konu seçin</option>
                    <option value="Destek">Teknik Destek</option>
                    <option value="IsBirligi">İş Birliği / Proje</option>
                    <option value="HataBildirimi">Hata Bildirimi (Bug Report)</option>
                    <option value="Diger">Diğer</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Mesajınız</label>
                  <textarea
                    name="message"
                    required
                    rows="4"
                    value={formData.message}
                    onChange={handleChange}
                    className="cyber-input w-full bg-slate-900/50 hover:border-blue-500/50 transition-colors resize-none"
                    placeholder="Size nasıl yardımcı olabilirim?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gradient w-full !py-3.5 text-sm uppercase tracking-wider font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform disabled:opacity-50">
                  {isSubmitting ? "Gönderiliyor..." : "Mesajı Gönder 🚀"}
                </button>
              </form>
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Contact;