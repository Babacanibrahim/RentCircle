import React from "react";
import { motion } from "framer-motion";

const Terms = () => {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col pt-16 pb-20 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10 flex-1">
        
        <div className="mb-12">
          <h1 className="text-3xl font-black text-slate-100 tracking-tight mb-4">
            Kullanım Koşulları ve <span className="text-blue-500">Politikalar</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Son Güncellenme: 1 Ocak 2026
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="cyber-card p-6 md:p-10 border border-slate-700/50 bg-[#1e293b]/50 backdrop-blur-sm space-y-8 text-sm text-slate-300 leading-relaxed">
          
          <section>
            <h2 className="text-lg font-bold text-slate-100 mb-3 font-mono">1. Taraflar ve Giriş</h2>
            <p>
              İşbu Kullanım Koşulları, RentCircle platformu (bundan böyle "Platform" olarak anılacaktır) ile Platform'a üye olan kullanıcılar arasındaki hizmet şartlarını, sorumlulukları ve havuz hesabı yönetimi dahil olmak üzere ticari kuralları belirler. Platformu kullanarak bu koşulları kabul etmiş sayılırsınız.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-100 mb-3 font-mono">2. Havuz Sistemi ve Depozito (Güvence Bedeli)</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Kiracı, kiralama işlemi onaylandığında kira bedeli ve %15 güvence bedelini (depozito) Platform'un iyzico entegreli havuz hesabına öder.</li>
              <li>Kira bedeli, Kiracı ürünü teslim aldığını sistem üzerinden onaylayana kadar Satıcı'ya aktarılmaz.</li>
              <li>Ürün sağlam bir şekilde iade edilip Satıcı tarafından onaylandığında, %15'lik güvence bedeli anında Kiracı'nın RentCircle cüzdanına iade edilir.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-100 mb-3 font-mono">3. İptal ve İade Koşulları</h2>
            <p>
              Onaylanmış bir kiralama işlemi, başlangıç tarihine 24 saatten az bir süre kala Kiracı tarafından iptal edilirse, toplam kira bedelinin %20'si oranında ceza kesintisi uygulanarak kalan tutar iade edilir. Satıcı tarafından son 24 saat içinde yapılan iptallerde, Satıcı'nın ilanı geçici süreyle askıya alınır ve Güven Puanı (Trust Score) düşürülür.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-100 mb-3 font-mono">4. Çözüm Merkezi (Dispute) ve Hasar Yönetimi</h2>
            <p>
              Ürünün iadesi sırasında bir hasar veya eksik tespit edilirse, Satıcı işlemi "Uyuşmazlık (Dispute)" durumuna taşıyabilir. Platform yöneticileri, teslimat ve iade sırasında sisteme yüklenen zorunlu fotoğrafları ve tarafların beyanlarını inceleyerek nihai kararı verir. Hasar durumunda, Kiracı'nın depozito bedeli tazminat olarak Satıcı'ya aktarılabilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-100 mb-3 font-mono">5. Hesap Güvenliği ve 2FA (İki Aşamalı Doğrulama)</h2>
            <p>
              Kullanıcılar hesap güvenliklerinden bizzat sorumludur. Platformdan nakit (IBAN) çıkışı yapılabilmesi için kullanıcıların profil ayarlarından İki Aşamalı Doğrulama (2FA) sistemini aktif etmeleri siber güvenlik protokollerimiz gereği zorunludur.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-rose-400 mb-3 font-mono">6. Platform İçi Yaptırımlar ve Ban Politikası</h2>
            <p>
              Platform içerisindeki mesajlaşmalarda iletişim bilgisi paylaşmak, platform harici (elden) ödeme talep etmek, sahte ilan oluşturmak veya diğer kullanıcıları rahatsız etmek kesinlikle yasaktır. İhlal durumunda kullanıcılar süreli (İlan/Mesaj yasağı) veya süresiz (Kalıcı Hesap Kapatma) olarak platformdan uzaklaştırılabilir.
            </p>
          </section>

        </motion.div>
      </div>
    </div>
  );
};

export default Terms;