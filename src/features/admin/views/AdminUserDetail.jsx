import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { itemApi } from "../../items/services/itemApi";
import { toast, cyberConfirm } from "../../../utils/alerts";
import { motion, AnimatePresence } from "framer-motion";

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userItems, setUserItems] = useState([]);

  // Bakiye İşlemleri State
  const [walletAmount, setWalletAmount] = useState("");
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);

  // Ban İşlemleri State
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [banForm, setBanForm] = useState({ duration: "1_week", reason: "" });
  const [isProcessingBan, setIsProcessingBan] = useState(false);

  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  const fetchUserDetails = async () => {
    try {
      // 1. Tüm kullanıcıları ve ilanları çek (Backend'de tekil uç nokta yoksa filtreleyerek buluruz)
      const users = await itemApi.getAdminUsers("");
      const targetUser = users.find((u) => String(u.id) === String(id));

      if (!targetUser) {
        toast.fire({ icon: "error", title: "Kullanıcı bulunamadı." });
        navigate("/admin-dashboard");
        return;
      }

      const items = await itemApi.getAdminItems("");
      const filteredItems = items.filter((i) => i.owner_username === targetUser.username);

      setUser(targetUser);
      setUserItems(filteredItems);
    } catch (error) {
      toast.fire({ icon: "error", title: "Kullanıcı bilgileri çekilemedi." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  // --- BAKİYE EKLE / ÇIKAR ---
  const handleWalletAction = async (actionType) => {
    if (!walletAmount || parseFloat(walletAmount) <= 0) {
      return toast.fire({ icon: "warning", title: "Geçerli bir tutar girin." });
    }

    const confirmMsg =
      actionType === "add"
        ? `Kullanıcıya ₺${walletAmount} bakiye EKLENECEK. Onaylıyor musunuz?`
        : `Kullanıcıdan ₺${walletAmount} bakiye KESİLECEK. Onaylıyor musunuz?`;

    const result = await cyberConfirm.fire({
      title: actionType === "add" ? "Bakiye Ekle" : "Bakiye Kes",
      text: confirmMsg,
      icon: "question",
      confirmButtonText: "Evet, Onaylıyorum",
    });

    if (result.isConfirmed) {
      setIsProcessingWallet(true);
      try {
        const response = await itemApi.manageWallet({
          user_id: user.id,
          action: actionType,
          amount: parseFloat(walletAmount),
        });
        toast.fire({ icon: "success", title: response.message });
        setWalletAmount("");
        fetchUserDetails(); // Veriyi yenile
      } catch (error) {
        toast.fire({ icon: "error", title: error.response?.data?.error || "Bakiye işlemi başarısız oldu." });
      } finally {
        setIsProcessingWallet(false);
      }
    }
  };

  const handleSendDirectSupportMessage = async () => {
    if (!supportMessage.trim()) return toast.fire({ icon: "warning", title: "Mesaj alanı boş bırakılamaz." });
    setIsSendingSupport(true);
    try {
      await itemApi.replyToSupport({ user_id: user.id, message: supportMessage });
      toast.fire({ icon: "success", title: "Sistem mesajı kullanıcıya iletildi." });
      setSupportMessage("");
    } catch (error) {
      toast.fire({ icon: "error", title: "Mesaj gönderilemedi." });
    } finally {
      setIsSendingSupport(false);
    }
  };

  // --- SÜRELİ / SÜRESİZ BAN ---
  const handleBanSubmit = async (e) => {
    e.preventDefault();
    if (!banForm.reason.trim()) {
      return toast.fire({ icon: "warning", title: "Lütfen ban sebebini yazın." });
    }

    setIsProcessingBan(true);
    try {
      await itemApi.banEntity({
        target_type: "user",
        id: user.id,
        duration: banForm.duration,
        reason: banForm.reason,
      });
      toast.fire({ icon: "success", title: "Kullanıcı başarıyla yasaklandı." });
      setIsBanModalOpen(false);
      fetchUserDetails();
    } catch (error) {
      toast.fire({ icon: "error", title: "İşlem başarısız oldu." });
    } finally {
      setIsProcessingBan(false);
    }
  };

  const handleRemoveBan = async () => {
    const result = await cyberConfirm.fire({
      title: "Yasağı Kaldır",
      text: "Bu kullanıcının yasağını kaldırmak istediğinize emin misiniz?",
      icon: "warning",
      confirmButtonText: "Evet, Yasağı Kaldır",
    });

    if (result.isConfirmed) {
      try {
        await itemApi.banEntity({ target_type: "user", id: user.id, duration: "remove_ban", reason: "" });
        toast.fire({ icon: "success", title: "Kullanıcının yasağı kaldırıldı." });
        fetchUserDetails();
      } catch (error) {
        toast.fire({ icon: "error", title: "Yasak kaldırılamadı." });
      }
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-blue-500 font-bold animate-pulse">
        KULLANICI PROFİLİ YÜKLENİYOR...
      </div>
    );
  if (!user) return null;

  const isBanned = user.banned_until || user.is_active === false;

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
                Kullanıcı Profili: @{user.username}
                {isBanned && (
                  <span className="bg-rose-100 text-rose-600 text-[10px] px-2.5 py-1 rounded-full font-black tracking-widest uppercase">
                    Yasaklı Hesap
                  </span>
                )}
                {user.is_staff && (
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2.5 py-1 rounded-full font-black tracking-widest uppercase">
                    Yönetici
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {user.first_name} {user.last_name}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ÜST BİLGİ KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. GENEL BİLGİLER */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>👤</span> Hesap Bilgileri
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">E-Posta Adresi</div>
                <div className="text-sm font-semibold text-slate-700">{user.email}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Kayıt Tarihi</div>
                <div className="text-sm font-semibold text-slate-700">{user.date_joined}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Güven Puanı</div>
                <div className="text-lg font-black text-amber-500">⭐ {user.trust_score} / 5.0</div>
              </div>
            </div>
          </div>

          {/* 2. CÜZDAN YÖNETİMİ (DEKONT MANTIĞI) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl pointer-events-none"></div>
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
              <span>💳</span> Cüzdan Yönetimi
            </h3>
            <div className="text-3xl font-black text-emerald-600 mb-4 relative z-10">₺{user.wallet_balance}</div>

            <div className="space-y-3 relative z-10">
              <input
                type="number"
                placeholder="Miktar Girin (₺)"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 rounded-xl p-3 outline-none focus:border-emerald-500 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleWalletAction("subtract")}
                  disabled={isProcessingWallet}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 py-2.5 rounded-xl text-xs font-bold transition-colors active:scale-95">
                  Bakiyeden Düş
                </button>
                <button
                  onClick={() => handleWalletAction("add")}
                  disabled={isProcessingWallet}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 py-2.5 rounded-xl text-xs font-bold transition-transform hover:scale-105 active:scale-95">
                  Bakiye Ekle
                </button>
              </div>
            </div>
          </div>

          {/* 3. MODERASYON (YASAKLAMA) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🛡️</span> Moderasyon İşlemleri
            </h3>

            {isBanned ? (
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 h-full flex flex-col justify-center">
                <div className="text-rose-600 font-bold text-sm mb-1">Hesap Yasaklı!</div>
                <div className="text-xs text-rose-500/80 mb-4 line-clamp-2">"{user.ban_reason}"</div>
                <button
                  onClick={handleRemoveBan}
                  className="w-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white py-3 rounded-xl text-xs font-bold transition-colors active:scale-95 shadow-sm">
                  Yasağı Kaldır
                </button>
              </div>
            ) : (
              <div className="flex flex-col justify-center h-32">
                <p className="text-xs text-slate-500 mb-4">
                  Topluluk kurallarını ihlal eden bu kullanıcıyı sistemden uzaklaştırabilirsiniz.
                </p>
                <button
                  onClick={() => setIsBanModalOpen(true)}
                  className="w-full bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-500 py-3 rounded-xl text-xs font-bold transition-colors active:scale-95 shadow-sm">
                  Kullanıcıyı Yasakla (Banla)
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-blue-900/50 relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex-1 z-10 w-full text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-xs">
                🛡️
              </span>
              <h3 className="text-lg font-black text-white tracking-wide">RentCircle Destek İletişimi</h3>
            </div>
            <p className="text-sm text-blue-200/70 font-medium max-w-md mx-auto md:mx-0">
              Bu kullanıcıya göndereceğiniz mesaj, gelen kutusunda resmi sistem hesabı olarak vurgulanacaktır.
            </p>
          </div>
          <div className="w-full md:w-1/2 flex flex-col gap-3 z-10">
            <textarea
              rows="2"
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              placeholder="Kullanıcıya iletilecek resmi mesajı yazın..."
              className="w-full bg-slate-950/50 border border-blue-500/30 text-white placeholder-slate-500 text-sm rounded-xl p-4 outline-none focus:border-amber-500 transition-colors resize-none"></textarea>
            <button
              onClick={handleSendDirectSupportMessage}
              disabled={isSendingSupport || !supportMessage.trim()}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50">
              {isSendingSupport ? "Gönderiliyor..." : "Sistem Mesajı Gönder 🚀"}
            </button>
          </div>
        </div>

        {/* KULLANICININ İLANLARI */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>📦</span> Kullanıcının Tüm İlanları ({userItems.length})
            </h3>
          </div>

          {userItems.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
              <span className="text-3xl block mb-2 opacity-50">📭</span>
              <p className="text-sm text-slate-500 font-medium">Bu kullanıcının henüz yayında olan bir ilanı bulunmuyor.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {userItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                  <div className="h-32 bg-slate-100 relative overflow-hidden">
                    <img
                      src={item.images?.[0]?.image || "https://via.placeholder.com/150"}
                      alt="item"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {item.is_banned && (
                      <div className="absolute top-2 right-2 bg-rose-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-md">
                        YASAKLI
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h4 className="font-bold text-slate-800 text-sm mb-1 truncate">{item.title}</h4>
                    <div className="text-lg font-black text-blue-600 mb-4">
                      ₺{item.price_per_day}
                      <span className="text-[10px] text-slate-400 font-medium">/Gün</span>
                    </div>
                    <button
                      onClick={() => navigate(`/admin-dashboard/items/${item.id}`)}
                      className="mt-auto w-full bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 py-2 rounded-xl text-xs font-bold transition-colors active:scale-95">
                      İlan Detayına Git →
                    </button>
                  </div>
                </div>
              ))}
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
                  <span>🚨</span> Kullanıcıyı Yasakla
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
                    <option value="1_week">1 Hafta Ceza</option>
                    <option value="1_month">1 Ay Ceza</option>
                    <option value="permanent">Süresiz Kapatma (Kalıcı Ban)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Kullanıcıya Gönderilecek Mesaj / Sebep</label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Örn: Sahte ilan paylaştığınız tespit edilmiştir..."
                    value={banForm.reason}
                    onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                    className="w-full bg-white border border-slate-200 focus:border-rose-500 text-slate-800 font-medium text-sm rounded-xl p-3 outline-none resize-none"></textarea>
                  <p className="text-[9px] text-slate-400">Bu mesaj kullanıcıya 'RentCircle Destek' bildirimi olarak iletilecektir.</p>
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
                    {isProcessingBan ? "İşleniyor..." : "Cezayı Onayla"}
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

export default AdminUserDetail;
