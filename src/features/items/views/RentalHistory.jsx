import React, { useEffect, useState } from "react";
import { itemApi } from "../services/itemApi";
import { motion, AnimatePresence } from "framer-motion";

const RentalHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("renter");
  const [currentUserId, setCurrentUserId] = useState(null);

  // Değerlendirme Modalı State'leri
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const fetchHistory = async () => {
    try {
      const data = await itemApi.getBookings();
      const pastBookings = data.filter((b) => ["completed", "rejected", "disputed"].includes(b.status));
      setHistory(pastBookings);
    } catch (error) {
      console.error("Geçmiş çekilemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 🎯 DÜZELTME: Hem local hem session kontrol edilecek
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        // 🎯 DÜZELTME: ID'yi küçük harfli string'e çeviriyoruz
        setCurrentUserId(String(payload.user_id).toLowerCase());
      } catch (e) {
        console.error("Token çözülemadi");
      }
    }
    fetchHistory();
  }, []);

  const openReviewModal = (bookingId) => {
    setSelectedBookingId(bookingId);
    setRating(5);
    setComment("");
    setIsReviewModalOpen(true);
  };

  const submitReview = async () => {
    try {
      await itemApi.createReview({
        booking: selectedBookingId,
        rating: rating,
        comment: comment,
      });
      alert("Değerlendirmeniz başarıyla kaydedildi!");
      setIsReviewModalOpen(false);
      fetchHistory();
    } catch (error) {
      alert(error.response?.data?.error?.[0] || error.response?.data?.error || "Değerlendirme gönderilemedi.");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: (
        <span className="px-3 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-lg text-xs font-bold">Tamamlandı</span>
      ),
      rejected: (
        <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold">İptal Edildi</span>
      ),
      disputed: (
        <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-bold">
          Uyuşmazlık
        </span>
      ),
    };
    return badges[status] || <span>{status}</span>;
  };

  if (loading) return <div className="w-full relative flex justify-center pt-20 text-slate-500">Yükleniyor...</div>;

  // 🎯 DÜZELTME: Filtreleme kısmında ID'leri kesin eşleştiriyoruz
  const filteredHistory = history.filter((b) => {
    if (!currentUserId) return false;

    const renterId = String(b.renter).toLowerCase();
    const ownerId = String(b.item_detail.owner).toLowerCase();

    return activeTab === "renter" ? renterId === currentUserId : ownerId === currentUserId;
  });

  return (
    <div className="w-full relative selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-black text-slate-100 mb-6">Kiralama Geçmişim</h1>

        <div className="flex gap-4 border-b border-slate-700/50 pb-4">
          <button
            onClick={() => setActiveTab("renter")}
            className={`text-sm font-bold pb-2 transition-colors ${activeTab === "renter" ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"}`}>
            🛒 Benim Kiraladıklarım
          </button>
          <button
            onClick={() => setActiveTab("owner")}
            className={`text-sm font-bold pb-2 transition-colors ${activeTab === "owner" ? "text-emerald-400 border-b-2 border-emerald-500" : "text-slate-400 hover:text-slate-200"}`}>
            📦 Benim Kiraya Verdiklerim
          </button>
        </div>

        <div className="space-y-4">
          {filteredHistory.length === 0 ? (
            <div className="cyber-card p-10 text-center text-slate-500 border-dashed">Geçmişte yapılmış bir işleminiz bulunmuyor.</div>
          ) : (
            filteredHistory.map((booking) => (
              <div
                key={booking.id}
                className="cyber-card p-5 border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4">
                  <img
                    src={booking.item_detail.images?.[0]?.image || "https://via.placeholder.com/80"}
                    alt="item"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-700 grayscale"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{booking.item_detail.title}</h3>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      {booking.start_date} <span className="mx-1">→</span> {booking.end_date}
                    </div>
                    <div className="mt-2">{getStatusBadge(booking.status)}</div>
                  </div>
                </div>

                <div className="text-left md:text-center border-l border-r border-slate-700/50 px-6">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Toplam Tutar</span>
                  <span className="text-lg font-black text-slate-300">₺{booking.total_price}</span>
                </div>

                <div className="flex flex-col gap-2 min-w-[180px]">
                  {booking.status === "completed" && activeTab === "renter" && !booking.has_review && (
                    <button
                      onClick={() => openReviewModal(booking.id)}
                      className="btn-gradient p-2 text-xs bg-amber-500 hover:bg-amber-600 border-none shadow-lg shadow-amber-500/30">
                      ⭐ Satıcıyı Değerlendir
                    </button>
                  )}
                  {booking.status === "completed" && activeTab === "renter" && booking.has_review && (
                    <div className="text-center text-xs text-amber-400 font-bold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      Değerlendirme Yapıldı
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cyber-card p-6 w-full max-w-sm border border-amber-500/30 shadow-2xl shadow-amber-500/10">
              <h3 className="text-lg font-black text-slate-100 mb-1">Deneyiminizi Puanlayın</h3>
              <p className="text-[10px] text-slate-400 mb-6">
                Satıcıya ve ürüne vereceğiniz puan diğer kullanıcılar için referans olacaktır.
              </p>

              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-4xl hover:scale-110 transition-transform ${rating >= star ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "text-slate-700 grayscale"}`}>
                    ★
                  </button>
                ))}
              </div>

              <div className="space-y-1 mb-6">
                <label className="text-[10px] uppercase font-black text-slate-400 font-mono block">Yorumunuz (İsteğe Bağlı)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Ürün nasıldı? Satıcı ilgili miydi?"
                  className="cyber-input w-full resize-none h-24 text-xs"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsReviewModalOpen(false)} className="btn-slate flex-1">
                  İptal
                </button>
                <button onClick={submitReview} className="btn-gradient flex-1 !bg-amber-500 !border-amber-400 hover:scale-105">
                  Gönder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RentalHistory;
