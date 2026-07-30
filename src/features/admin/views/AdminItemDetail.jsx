import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { itemApi } from "../../items/services/itemApi";
import { toast, cyberConfirm } from "../../../utils/alerts";
import { motion, AnimatePresence } from "framer-motion";

const AdminItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);

  // Ban İşlemleri State
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [banForm, setBanForm] = useState({ duration: "1_week", reason: "" });
  const [isProcessingBan, setIsProcessingBan] = useState(false);

  const fetchItemDetails = async () => {
    try {
      // Tüm ilanları çekip ilgili ilanı buluyoruz
      const items = await itemApi.getAdminItems("");
      const targetItem = items.find((i) => String(i.id) === String(id));

      if (!targetItem) {
        toast.fire({ icon: "error", title: "İlan bulunamadı veya silinmiş." });
        navigate("/admin-dashboard");
        return;
      }

      setItem(targetItem);
    } catch (error) {
      toast.fire({ icon: "error", title: "İlan bilgileri çekilemedi." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemDetails();
  }, [id]);

  // --- İLANI TAMAMEN SİL ---
  const handleDeleteItem = async () => {
    const result = await cyberConfirm.fire({
      title: "İlanı Sistemden Sil",
      text: "Bu ilanı sistemden kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
      icon: "warning",
      confirmButtonText: "Evet, Kalıcı Olarak Sil",
      confirmButtonColor: "#e11d48",
    });

    if (result.isConfirmed) {
      try {
        await itemApi.adminDeleteItem(item.id);
        toast.fire({ icon: "success", title: "İlan başarıyla sistemden silindi." });
        navigate("/admin-dashboard");
      } catch (error) {
        toast.fire({ icon: "error", title: "İlan silinemedi." });
      }
    }
  };

  // --- SÜRELİ / SÜRESİZ BAN ---
  const handleBanSubmit = async (e) => {
    e.preventDefault();
    if (!banForm.reason.trim()) {
      return toast.fire({ icon: "warning", title: "Lütfen yasaklama sebebini yazın." });
    }

    setIsProcessingBan(true);
    try {
      await itemApi.banEntity({
        target_type: "item",
        id: item.id,
        duration: banForm.duration,
        reason: banForm.reason,
      });
      toast.fire({ icon: "success", title: "İlan başarıyla yayından kaldırıldı (Yasaklandı)." });
      setIsBanModalOpen(false);
      fetchItemDetails();
    } catch (error) {
      toast.fire({ icon: "error", title: "İşlem başarısız oldu." });
    } finally {
      setIsProcessingBan(false);
    }
  };

  const handleRemoveBan = async () => {
    const result = await cyberConfirm.fire({
      title: "İlan Yasağını Kaldır",
      text: "Bu ilanın yasağını kaldırmak ve tekrar görünür yapmak istediğinize emin misiniz?",
      icon: "warning",
      confirmButtonText: "Evet, Yasağı Kaldır",
    });

    if (result.isConfirmed) {
      try {
        await itemApi.banEntity({ target_type: "item", id: item.id, duration: "remove_ban", reason: "" });
        toast.fire({ icon: "success", title: "İlanın yasağı kaldırıldı." });
        fetchItemDetails();
      } catch (error) {
        toast.fire({ icon: "error", title: "Yasak kaldırılamadı." });
      }
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-blue-500 font-bold animate-pulse">
        İLAN BİLGİLERİ YÜKLENİYOR...
      </div>
    );
  if (!item) return null;

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-20">
      {/* ÜST BAŞLIK ALANI */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin-dashboard")}
              className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors">
              ←
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-800 flex items-center gap-3">
                İlan İnceleme Paneli
                {item.is_banned && (
                  <span className="bg-rose-100 text-rose-600 text-[10px] px-2.5 py-1 rounded-full font-black tracking-widest uppercase">
                    Yasaklı İlan
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 font-medium">#{String(item.id).substring(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 1. SATICI PROFİLİ KARTI */}
        <div
          onClick={() => navigate(`/admin-dashboard/users/${item.owner}`)}
          className="bg-white p-4 rounded-3xl border border-blue-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group relative overflow-hidden">
          <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 font-bold text-sm">
            Satıcı Profilini İncele →
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-xl border-2 border-white shadow-sm">
            {item.owner_username ? item.owner_username[0].toUpperCase() : "U"}
          </div>
          <div>
            <div className="text-[10px] uppercase font-black text-blue-500 tracking-wider">İlan Sahibi (Satıcı)</div>
            <div className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors">@{item.owner_username}</div>
          </div>
        </div>

        {/* 2. İLAN DETAYLARI VE GÖRSELLER */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          {/* GÖRSELLER ALANI */}
          <div className="w-full md:w-2/5 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-4">
            <div className="w-full h-64 bg-slate-200 rounded-2xl overflow-hidden border border-slate-300 relative shadow-inner">
              {item.images && item.images.length > 0 ? (
                <img src={item.images[0].image} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-sm">Görsel Yok</div>
              )}
              {item.is_banned && (
                <div className="absolute inset-0 bg-rose-900/40 backdrop-blur-sm flex items-center justify-center">
                  <span className="bg-rose-600 text-white font-black px-4 py-2 rounded-xl tracking-widest border border-rose-400">
                    BU İLAN YASAKLI
                  </span>
                </div>
              )}
            </div>

            {item.images && item.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {item.images.slice(1).map((img, idx) => (
                  <div key={idx} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-300">
                    <img src={img.image} alt="thumbnail" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* İLAN OKUNABİLİR BİLGİLERİ */}
          <div className="w-full md:w-3/5 p-8 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">{item.title}</h2>
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                    {item.category?.name || "Kategorisiz"}
                  </span>
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <span>📍</span> {item.city}, {item.district}
                  </span>
                </div>
              </div>
              <div className="text-right bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Günlük Kira</div>
                <div className="text-2xl font-black text-emerald-600">₺{item.price_per_day}</div>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400">İlan Açıklaması</label>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed min-h-[120px]">
                  {item.description || "Açıklama girilmemiş."}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Oluşturulma Tarihi</label>
                  <div className="text-sm font-semibold text-slate-800">{new Date(item.created_at).toLocaleDateString("tr-TR")}</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Görüntülenme</label>
                  <div className="text-sm font-semibold text-slate-800">{item.views_count || 0} Kez İncelendi</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. MODERASYON İŞLEMLERİ (SİL / BANLA) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span>🛡️</span> İlan Moderasyonu
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              İlanı topluluk kurallarına aykırı olduğu için geçici olarak askıya alabilir veya sistemden tamamen silebilirsiniz.
            </p>
          </div>

          {item.is_banned ? (
            <div className="flex-1 bg-rose-50 p-4 rounded-2xl border border-rose-100 flex flex-col justify-center">
              <div className="text-rose-600 font-bold text-sm mb-1 flex items-center gap-2">
                <span>⚠️</span> İlan Askıya Alınmış
              </div>
              <div className="text-xs text-rose-500/80 mb-4 line-clamp-2">Sebep: "{item.ban_reason}"</div>
              <button
                onClick={handleRemoveBan}
                className="w-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white py-3 rounded-xl text-xs font-bold transition-colors active:scale-95 shadow-sm">
                Yasağı Kaldır ve Görünür Yap
              </button>
            </div>
          ) : (
            <div className="flex-1 flex gap-3 items-center">
              <button
                onClick={handleDeleteItem}
                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 py-4 rounded-xl text-xs font-bold transition-colors active:scale-95 text-center">
                Sistemden Tamamen Sil
              </button>
              <button
                onClick={() => setIsBanModalOpen(true)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 py-4 rounded-xl text-xs font-bold transition-transform hover:scale-105 active:scale-95 text-center">
                İlanı Yasakla (Askıya Al)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🎯 SÜRELİ / SÜRESİZ BAN MODALI */}
      <AnimatePresence>
        {isBanModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white shadow-2xl rounded-3xl w-full max-w-md overflow-hidden">
              <div className="bg-rose-50 border-b border-rose-100 p-6 flex justify-between items-center">
                <h2 className="text-lg font-black text-rose-600 flex items-center gap-2">
                  <span>🚨</span> İlanı Askıya Al
                </h2>
                <button onClick={() => setIsBanModalOpen(false)} className="text-rose-400 hover:text-rose-600 font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleBanSubmit} className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Yasaklama Süresi</label>
                  <select
                    value={banForm.duration}
                    onChange={(e) => setBanForm({ ...banForm, duration: e.target.value })}
                    className="w-full bg-white border border-slate-200 focus:border-rose-500 text-slate-800 font-medium text-sm rounded-xl p-3 outline-none cursor-pointer">
                    <option value="1_week">1 Hafta Gizle</option>
                    <option value="1_month">1 Ay Gizle</option>
                    <option value="permanent">Süresiz Kapatma (Kalıcı Yasak)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Satıcıya Gönderilecek Mesaj / Sebep</label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Örn: Görsellerde iletişim bilgisi paylaşmak yasaktır..."
                    value={banForm.reason}
                    onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                    className="w-full bg-white border border-slate-200 focus:border-rose-500 text-slate-800 font-medium text-sm rounded-xl p-3 outline-none resize-none"></textarea>
                  <p className="text-[9px] text-slate-400">Bu mesaj satıcıya 'RentCircle Destek' bildirimi olarak iletilecektir.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBanModalOpen(false)}
                    className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl text-xs transition-colors">
                    İptal
                  </button>
                  <div className="flex-1"></div>
                  <button
                    type="submit"
                    disabled={isProcessingBan}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 disabled:opacity-50">
                    {isProcessingBan ? "İşleniyor..." : "Yasağı Onayla"}
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

export default AdminItemDetail;
