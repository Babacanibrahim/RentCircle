import React, { useState } from "react";
import { Link } from "react-router-dom";
import CreateTicketModal from "../components/CreateTicketModal";

const Footer = () => {
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  return (
    <>
      <footer className="w-full bg-[#0f172a] border-t border-slate-700/50 pt-8 pb-6 mt-auto relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-blue-500/5 blur-[80px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 select-none">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <span className="text-white text-base font-black tracking-tighter">R</span>
                </div>
                <span className="text-xl font-black tracking-wider text-slate-100 font-mono">
                  RENT<span className="text-blue-400">CIRCLE</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Güvenli, hızlı ve kolay eşya kiralama platformu. İhtiyacınız olan ürünleri uygun fiyatlarla kiralayın, kullanmadığınız
                eşyalarınızı kiraya vererek ek gelir elde edin.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-widest font-mono">Keşfet</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/dashboard" className="text-xs text-slate-400 hover:text-blue-400 transition-colors">
                    Tüm İlanlar
                  </Link>
                </li>
                <li>
                  <Link to="/how-it-works" className="text-xs text-slate-400 hover:text-blue-400 transition-colors">
                    Nasıl Çalışır?
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-widest font-mono">Destek</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/faq" className="text-xs text-slate-400 hover:text-blue-400 transition-colors">
                    Sıkça Sorulan Sorular
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-xs text-slate-400 hover:text-blue-400 transition-colors">
                    İletişim
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-xs text-slate-400 hover:text-blue-400 transition-colors">
                    Kullanım Koşulları
                  </Link>
                </li>
                {/* 🎯 EKLENEN TICKET MODAL BUTONU */}
                <li>
                  <button
                    onClick={() => setIsTicketModalOpen(true)}
                    className="text-xs text-slate-400 hover:text-blue-400 transition-colors cursor-pointer text-left">
                    Destek Bileti (Ticket) Oluştur
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-slate-500">&copy; {new Date().getFullYear()} RentCircle. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>

      {/* 🎯 TICKET MODALINI BURADA ÇAĞIRIYORUZ */}
      <CreateTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} />
    </>
  );
};

export default Footer;
