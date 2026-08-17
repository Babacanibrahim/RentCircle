import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqData = [
    {
      category: "Kiralama ve İlan Süreci",
      icon: "📦",
      questions: [
        {
          q: "RentCircle'da kiralama süreci nasıl işliyor?",
          a: "Sadece 4 kolay adımda: 1) Ürünü bulup teklif gönderin. 2) Ürün sahibi onayladığında ödemenizi güvenle havuza yapın. 3) Anlaştığınız yerde buluşup ürünü teslim alın. 4) İşiniz bitince ürünü iade edin ve güvence bedeliniz (depozitonuz) hemen hesabınıza dönsün.",
        },
        {
          q: "Fiyatlarda veya tarihlerde pazarlık yapabilir miyim?",
          a: "Kesinlikle! İlan detayındaki mesajlaşma özelliğiyle ürün sahibine ulaşıp kendi bütçenize veya farklı tarihlere göre yeni bir teklif sunabilirsiniz. Karşı taraf kabul ettiğinde sistem hemen güncellenir.",
        },
        {
          q: "İlanım neden 'Askıya Alındı' olarak görünüyor?",
          a: "İlanınızda telefon numarası paylaşmak veya kurallarımıza uymayan bir ürün eklemek gibi bir durum fark edilmiş olabilir. Sorunu öğrenmek ve hızlıca çözmek için bize bir destek mesajı gönderebilirsiniz.",
        },
      ],
    },
    {
      category: "Ödeme ve Güvence Bedeli",
      icon: "💳",
      questions: [
        {
          q: "Ödeme yaparken param güvende mi? Havuz sistemi ne demek?",
          a: "Paranız %100 güvende. Ödeme yaptığınızda paranız hemen ürün sahibine aktarılmaz, güvenli havuz hesabımızda bekletilir. Siz ürünü elden ve sorunsuzca teslim aldığınızı onayladığınızda, kira bedeli ürün sahibine geçer.",
        },
        {
          q: "Depozitom (Güvence bedelim) ne zaman iade edilir?",
          a: "Kiralama süresi bitip ürünü sahibine sağlam bir şekilde teslim ettiğinizde, ürün sahibi sistemden iade onayını verir vermez depozitonuz anında cüzdanınıza geri yüklenir.",
        },
        {
          q: "Cüzdanımdaki parayı banka hesabıma nasıl aktarırım?",
          a: "Cüzdanım sayfasındaki 'Para Çek' butonuna tıklayarak kendi adınıza ait bir IBAN girebilirsiniz. Ekibimiz kısa bir güvenlik kontrolü yaptıktan sonra paranızı banka hesabınıza hızlıca gönderir.",
        },
      ],
    },
    {
      category: "Güvenlik ve Hesap İşlemleri",
      icon: "🛡️",
      questions: [
        {
          q: "Telefondan ekstra güvenlik onayı yapmak zorunlu mu?",
          a: "Sisteme normal girişlerde zorunlu değildir. Ancak kazancınızı banka hesabınıza çekerken, paranızın başkasının eline geçmesini engellemek için telefonunuzla ekstra bir doğrulama yapmanızı istiyoruz.",
        },
        {
          q: "Kiraladığım ürüne yanlışlıkla zarar verirsem ne olur?",
          a: "Böyle bir durumda ürün sahibi, sistemimizdeki 'Çözüm Merkezi' aracılığıyla bize ulaşabilir. Ekibimiz durumu adil bir şekilde inceler; eğer bir hasar onaylanırsa, kiralarken ödediğiniz depozito hasar bedeli olarak ürün sahibine aktarılır.",
        },
        {
          q: "Hesabım neden kısıtlanmış olabilir?",
          a: "Topluluğumuzun güvenliği için kurallarımızı ihlal eden durumlarda (örneğin kaba dil kullanımı, elden ödeme talep etme veya sahte ilanlar) hesaplar geçici veya kalıcı olarak dondurulabilir. Kısıtlamanın sebebini sisteme giriş yaparken ekranda görebilirsiniz.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] selection:bg-blue-500/30 flex flex-col pt-16 pb-20 relative overflow-hidden">
      {/* Arka Plan Aydınlatmaları */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-indigo-500/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 flex-1">
        {/* Üst Başlık */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30 mx-auto mb-6">
            ❓
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-100 tracking-tight mb-4">
            Sıkça Sorulan <span className="text-blue-500">Sorular</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            RentCircle'da kiralama süreçleri, güvenli ödeme ve hesabınızla ilgili merak ettiğiniz tüm cevapları aşağıda bulabilirsiniz.
          </p>
        </div>

        {/* Sorular Listesi */}
        <div className="space-y-8">
          {faqData.map((section, sIndex) => (
            <motion.div
              key={sIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sIndex * 0.1 }}
              className="bg-[#1e293b]/50 border border-slate-700/50 rounded-3xl overflow-hidden backdrop-blur-sm">
              <div className="px-6 py-4 bg-[#1e293b] border-b border-slate-700/50 flex items-center gap-3">
                <span className="text-xl">{section.icon}</span>
                <h2 className="text-base font-black text-slate-200 uppercase tracking-widest font-mono">
                  {section.category}
                </h2>
              </div>

              <div className="divide-y divide-slate-700/50">
                {section.questions.map((faq, qIndex) => {
                  const globalIndex = `${sIndex}-${qIndex}`;
                  const isOpen = openIndex === globalIndex;

                  return (
                    <div key={qIndex} className="group">
                      <button
                        onClick={() => toggleAccordion(globalIndex)}
                        className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition-colors">
                        <span
                          className={`text-sm font-bold pr-4 transition-colors ${
                            isOpen ? "text-blue-400" : "text-slate-300 group-hover:text-blue-300"
                          }`}>
                          {faq.q}
                        </span>
                        <div
                          className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${
                            isOpen ? "bg-blue-500/20 border-blue-500/50 text-blue-400 rotate-180" : "border-slate-600 text-slate-500 group-hover:border-slate-500"
                          }`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden">
                            <div className="px-6 pb-5 pt-1 text-sm text-slate-400 leading-relaxed border-l-2 border-blue-500/50 ml-6 pl-4 mb-4">
                              {faq.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Hala Yardım Gerekli mi? */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-3xl p-8 text-center flex flex-col items-center shadow-lg shadow-blue-900/20">
          <span className="text-3xl mb-3">🎧</span>
          <h3 className="text-lg font-black text-slate-100 mb-2">Hala sorunuz mu var?</h3>
          <p className="text-xs text-slate-400 mb-6 max-w-md">
            Aradığınız cevabı bulamadıysanız, destek ekibimize doğrudan mesaj gönderebilirsiniz. Size yardımcı olmaktan mutluluk duyarız.
          </p>
          <div className="flex gap-4">
            <Link
              to="/dashboard"
              className="btn-slate !py-2.5 !px-6 text-xs font-bold hover:scale-105 active:scale-95 transition-transform">
              İlanlara Dön
            </Link>
            <Link
              to="/contact"
              className="btn-gradient !py-2.5 !px-6 text-xs font-bold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-blue-500/20 flex items-center justify-center">
              Bize Ulaşın
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQ;