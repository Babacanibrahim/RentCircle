import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { itemApi } from "../services/itemApi";
import ItemCard from "../components/ItemCard";
import { toast } from "../../../utils/alerts";

const DefaultAvatar = () => (
  <svg className="w-8 h-8 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // 🎯 GİRİŞ DUVARI (LOGIN WALL) STATE'İ
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) {
      // 🎯 DÜZELTME: Anında Login'e atmak yerine Modalı açıyoruz!
      setShowLoginModal(true);
    }
  }, []);

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  // 🚩 Şikayet (Report) State'leri
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: "", description: "", proof_image: null });
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const data = await itemApi.getStoreDetail(id);
        setStore(data);
      } catch (error) {
        console.error("Mağaza detayları çekilemedi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [id]);

  // 🚩 Şikayet Gönderme İşlemi
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportForm.reason) return toast.fire({ icon: "warning", title: "Lütfen bir şikayet sebebi seçin." });

    setIsSubmittingReport(true);
    try {
      const formData = new FormData();
      formData.append("target_type", "user");
      formData.append("user_id", store.id);
      formData.append("reason", reportForm.reason);
      formData.append("description", reportForm.description);
      if (reportForm.proof_image) {
        formData.append("proof_image", reportForm.proof_image);
      }

      await itemApi.submitReport(formData);
      toast.fire({ icon: "success", title: "Şikayetiniz ve kanıtınız yönetime iletildi." });
      setIsReportModalOpen(false);
      setReportForm({ reason: "", description: "", proof_image: null });
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Şikayet gönderilirken bir hata oluştu.";
      toast.fire({ icon: "error", title: errorMsg });
      console.error("Şikayet Hatası:", err.response?.data);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (loading)
    return (
      <div className="w-full relative flex items-center justify-center font-mono text-xs tracking-widest text-slate-400 animate-pulse pt-20">
        MAĞAZA PROFİLİ YÜKLENİYOR...
      </div>
    );
  if (!store) return <div className="w-full relative text-center pt-20 text-slate-500 font-mono">Mağaza bulunamadı.</div>;

  const activeListings = store.active_listings || [];
  const rentedListings = store.rented_listings || [];
  const storeReviews = store.reviews || [];

  return (
    <div className="w-full relative min-h-screen selection:bg-blue-500/30">
      {/* ==========================================
          1. ASIL İÇERİK (Modal açıksa bulanıklaşır ve donar)
          ========================================== */}
      <div
        className={`transition-all duration-500 w-full p-6 lg:p-12 ${showLoginModal ? "blur-md pointer-events-none select-none h-[80vh] overflow-hidden opacity-50" : ""}`}>
        <div className="max-w-6xl mx-auto space-y-8 relative z-10">
          {/* HERO KART */}
          <div className="cyber-card p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 hover:border-slate-600/50 transition-colors group">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

            {/* 🚩 Kullanıcıyı Şikayet Et Butonu */}
            <button
              onClick={() => {
                const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
                if (!token) return toast.fire({ icon: "info", title: "Kullanıcıyı şikayet etmek için giriş yapmalısınız." });
                setIsReportModalOpen(true);
              }}
              className="absolute top-4 right-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-bold z-20">
              🚩 ŞİKAYET ET
            </button>

            <div className="flex items-center gap-5 flex-col md:flex-row text-center md:text-left z-10 w-full mt-4 md:mt-0">
              {/* AVATAR KISMI */}
              <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center shadow-xl border border-slate-700/50 overflow-hidden font-black text-2xl text-slate-300 uppercase cursor-default shrink-0">
                {store.profile_image ? (
                  <img
                    src={store.profile_image}
                    alt={store.username}
                    className="w-full h-full object-cover hover:scale-110 transition-transform"
                  />
                ) : store.show_name ? (
                  store.first_name?.[0]
                ) : (
                  store.username?.[0] || <DefaultAvatar />
                )}
              </div>

              <div className="space-y-1.5 cursor-default">
                <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                  ✔️ KAYITLI KULLANICI
                </span>
                <h1 className="text-2xl font-black tracking-tight text-slate-100">
                  {store.show_name ? `${store.first_name} ${store.last_name}` : `@${store.username}`}
                </h1>
                {store.show_name && <h3 className="text-sm font-medium text-slate-400">@{store.username}</h3>}
                <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs text-amber-400 font-semibold bg-slate-900/50 px-3 py-1 rounded-lg w-fit mx-auto md:mx-0 mt-2 hover:bg-slate-900/80 transition-colors">
                  ⭐ {store.rating > 0 ? store.rating : "Yeni"}
                  <span className="text-slate-400 font-normal">({store.review_count || storeReviews.length} Değerlendirme)</span>
                </div>
              </div>
            </div>
          </div>

          {/* İlan Sekmeleri */}
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-slate-700/50 pb-px">
              <button
                onClick={() => setActiveTab("active")}
                className={`pb-3 text-xs font-bold tracking-wider uppercase transition-all relative px-2 cursor-pointer hover:scale-105 active:scale-95 ${activeTab === "active" ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
                Aktif İlanlar ({activeListings.length})
                {activeTab === "active" && (
                  <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("rented")}
                className={`pb-3 text-xs font-bold tracking-wider uppercase transition-all relative px-2 cursor-pointer hover:scale-105 active:scale-95 ${activeTab === "rented" ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
                Şu Anda Kirada ({rentedListings.length})
                {activeTab === "rented" && (
                  <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            </div>

            <div>
              {activeTab === "active" ? (
                activeListings.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeListings.map((item) => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-mono text-slate-500 py-6 cursor-default">Kullanıcının henüz aktif bir ilanı bulunmuyor.</p>
                )
              ) : rentedListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                  {rentedListings.map((item) => (
                    <div key={item.id} className="relative group cursor-pointer hover:opacity-100 transition-opacity">
                      <ItemCard item={item} />
                      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center pointer-events-none z-20">
                        <span className="bg-slate-900/90 text-amber-400 border border-amber-500/30 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-xl shadow-lg">
                          🔒 KİRADA
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-slate-500 py-6 cursor-default">
                  Kullanıcının şu anda kirada olan bir ürünü bulunmuyor.
                </p>
              )}
            </div>
          </div>

          {/* YORUMLAR */}
          <div className="border-t border-slate-700/50 pt-8 space-y-5">
            <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase font-mono cursor-default">
              💬 Kullanıcı Değerlendirmeleri
            </h2>
            {storeReviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {storeReviews.map((review) => {
                  const reviewerName = review.reviewer_show_name
                    ? `${review.reviewer_first_name} ${review.reviewer_last_name?.[0]}.`
                    : `@${review.reviewer_username}`;
                  return (
                    <div key={review.id} className="cyber-card p-5 space-y-3 !bg-slate-800/20 hover:!bg-slate-800/40 transition-colors">
                      <div className="flex items-center justify-between cursor-default">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-200 uppercase shadow-inner border border-slate-600/50">
                            {reviewerName[0]}
                          </div>
                          <span className="text-xs font-bold text-slate-200">{reviewerName}</span>
                        </div>
                        <span className="text-[10px] tracking-widest">{"⭐".repeat(review.rating)}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed italic pl-9 cursor-default">
                        "{review.comment || "Sadece puanlama yapıldı."}"
                      </p>
                      <div className="mt-3 pl-9">
                        <div
                          onClick={() => navigate(`/listings/${review.item}`)}
                          className="inline-flex items-center gap-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-700/50 rounded-lg p-1.5 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-sm">
                          <img
                            src={review.item_image || "https://via.placeholder.com/40"}
                            alt="item"
                            className="w-8 h-8 rounded-md object-cover border border-slate-700"
                          />
                          <div className="flex flex-col pr-2">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kiralanan Ürün</span>
                            <span className="text-[10px] text-blue-400 font-semibold truncate max-w-[150px]">
                              {review.item_title || "Ürün İlanı"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="cyber-card p-8 text-center text-slate-500 border-dashed text-xs cursor-default">
                Kullanıcı henüz bir değerlendirme almamış. İlk kiralayan ve değerlendiren siz olun!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          2. GİRİŞ YAPMA DUVARI (LOGIN WALL MODAL)
          ========================================== */}
      <AnimatePresence>
        {showLoginModal && (
          <div
            onClick={() => navigate("/login")}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()} // Modalın içine tıklayınca kapanmasını engeller
              className="cyber-card w-full max-w-md p-8 relative shadow-2xl shadow-blue-500/10 bg-[#1e293b] border border-[#475569]/60 text-center">
              {/* Çarpı Butonu */}
              <button
                onClick={() => navigate("/login")}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer">
                ✕
              </button>

              <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.4)] cursor-default select-none">🔒</div>

              <h2 className="text-xl font-black text-slate-100 mb-2 tracking-wide cursor-default">Kilitli İçerik</h2>

              <p className="text-sm text-slate-400 mb-8 leading-relaxed cursor-default">
                Satıcı profillerini detaylı incelemek, ilanlarını görmek ve iletişime geçmek gibi daha fazla özelliğe erişmek için lütfen
                giriş yapın.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate("/login")}
                  className="btn-gradient w-full py-3.5 shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all font-bold">
                  Hemen Giriş Yap
                </button>

                <button
                  onClick={() => navigate("/register")}
                  className="w-full py-3.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 hover:border-slate-500 text-slate-200 text-sm font-bold rounded-xl transition-all cursor-pointer">
                  Hesabınız yok mu? Kayıt Ol
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚩 KULLANICI ŞİKAYET MODALI */}
      <AnimatePresence>
        {isReportModalOpen && !showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cyber-card p-6 w-full max-w-sm border border-rose-500/30 shadow-2xl shadow-rose-500/10">
              <h3 className="text-lg font-black text-rose-400 mb-1">🚩 Kullanıcıyı Şikayet Et</h3>
              <p className="text-[10px] text-slate-400 mb-6">
                Bu kullanıcının kuralları ihlal ettiğini veya şüpheli davrandığını düşünüyorsanız bize bildirin.
              </p>

              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Şikayet Sebebi</label>
                  <select
                    required
                    value={reportForm.reason}
                    onChange={(e) => setReportForm({ ...reportForm, reason: e.target.value })}
                    className="cyber-input w-full text-xs cursor-pointer focus:border-rose-500">
                    <option value="" disabled>
                      Sebep Seçin...
                    </option>
                    <option value="Dolandırıcılık Şüphesi">Dolandırıcılık Şüphesi</option>
                    <option value="Sahte veya Çalıntı Hesap">Sahte veya Çalıntı Hesap</option>
                    <option value="Hakaret veya Taciz">Küfür, Hakaret veya Taciz</option>
                    <option value="Ulaşılamayan Satıcı">Kiralama Sonrası Ulaşılamıyor</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Detaylı Açıklama (Opsiyonel)</label>
                  <textarea
                    rows="3"
                    placeholder="Yaşadığınız sorunu kısaca anlatın..."
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    className="cyber-input w-full text-xs focus:border-rose-500 resize-none"></textarea>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Kanıt Görseli Ekleyin (İsteğe Bağlı, Max 1)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReportForm({ ...reportForm, proof_image: e.target.files[0] })}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="btn-slate flex-1 hover:bg-slate-700 transition-all">
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="btn-gradient flex-1 !bg-rose-600 !border-rose-500 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50">
                    {isSubmittingReport ? "İletiliyor..." : "Gönder"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StoreDetail;
