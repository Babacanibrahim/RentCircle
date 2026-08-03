import React, { useEffect, useState, useRef } from "react";
import { itemApi } from "../services/itemApi";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "../../../utils/alerts";

const RentalHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("renter");
  const [currentUserId, setCurrentUserId] = useState(null);

  // WebSocket Referansı
  const wsRef = useRef(null);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState({ bookingId: null, rating: 5, comment: "", targetName: "", targetRole: "" });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const fetchHistory = async () => {
    try {
      const data = await itemApi.getBookings();
      const pastBookings = data.results || data;
      setHistory(pastBookings.filter((b) => ["completed", "rejected"].includes(b.status)));
    } catch (error) {
      console.error("Geçmiş çekilemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    let userId = null;
    let pingInterval;

    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        userId = String(payload.user_id).toLowerCase();
        setCurrentUserId(userId);
      } catch (e) {
        console.error("Token çözülemadi");
      }
    }

    fetchHistory();

    // Canlı Ekran Senkronizasyonu (WebSocket)
    if (userId) {
      const connectWebSocket = () => {
        const ws = new WebSocket(`ws://127.0.0.1:8000/ws/notifications/${userId}/`);
        wsRef.current = ws;

        ws.onopen = () => {
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 30000);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "pong") return;
          fetchHistory();
        };

        ws.onclose = () => {
          clearInterval(pingInterval);
          setTimeout(connectWebSocket, 3000);
        };
      };

      connectWebSocket();
    }

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  const openReviewModal = (booking) => {
    const isRenter = activeTab === "renter";
    const targetName = isRenter ? booking.item_detail.owner_username : booking.renter_name;
    const targetRole = isRenter ? "Satıcı" : "Kiracı";

    setReviewData({
      bookingId: booking.id,
      rating: 5,
      comment: "",
      targetName,
      targetRole,
    });
    setIsReviewModalOpen(true);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    try {
      await itemApi.createReview({
        booking: reviewData.bookingId,
        rating: reviewData.rating,
        comment: reviewData.comment,
      });
      toast.fire({ icon: "success", title: "Değerlendirmeniz başarıyla kaydedildi!" });
      setIsReviewModalOpen(false);
      fetchHistory();
    } catch (error) {
      toast.fire({
        icon: "error",
        title: error.response?.data?.error?.[0] || error.response?.data?.error || "Değerlendirme gönderilemedi.",
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: (
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[11px] font-bold cursor-default">
          Tamamlandı / İade Edildi
        </span>
      ),
      rejected: (
        <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] font-bold cursor-default">
          İptal Edildi
        </span>
      ),
    };
    return badges[status] || <span>{status}</span>;
  };

  if (loading)
    return <div className="w-full relative flex justify-center pt-20 text-slate-500 animate-pulse font-mono text-sm">YÜKLENİYOR...</div>;

  const filteredHistory = history.filter((b) => {
    if (!currentUserId) return false;
    const renterId = String(b.renter).toLowerCase();
    const ownerId = String(b.item_detail.owner).toLowerCase();
    return activeTab === "renter" ? renterId === currentUserId : ownerId === currentUserId;
  });

  return (
    <div className="w-full relative selection:bg-blue-500/30 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-black text-slate-100 mb-6 cursor-default">Kiralama Geçmişim</h1>

        <div className="flex gap-4 border-b border-slate-700/50 pb-4">
          <button
            onClick={() => setActiveTab("renter")}
            className={`text-sm font-bold pb-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${activeTab === "renter" ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"}`}>
            🛒 Benim Kiraladıklarım
          </button>
          <button
            onClick={() => setActiveTab("owner")}
            className={`text-sm font-bold pb-2 transition-all cursor-pointer hover:scale-105 active:scale-95 ${activeTab === "owner" ? "text-emerald-400 border-b-2 border-emerald-500" : "text-slate-400 hover:text-slate-200"}`}>
            📦 Benim Kiraya Verdiklerim
          </button>
        </div>

        <div className="space-y-4">
          {filteredHistory.length === 0 ? (
            <div className="cyber-card p-10 text-center text-slate-500 border-dashed cursor-default">
              Geçmişte yapılmış bir işleminiz bulunmuyor.
            </div>
          ) : (
            filteredHistory.map((booking) => (
              <div
                key={booking.id}
                className="cyber-card p-5 border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4">
                  <img
                    src={booking.item_detail.images?.[0]?.image || "https://via.placeholder.com/80"}
                    alt="item"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-700 grayscale cursor-default"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 cursor-default">{booking.item_detail.title}</h3>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono cursor-default">
                      {booking.start_date} <span className="mx-1">→</span> {booking.end_date}
                    </div>

                    <div className="mt-2 flex flex-col items-start gap-1.5">
                      {getStatusBadge(booking.status)}

                      {booking.status === "rejected" && booking.cancelled_by_name && (
                        <div className="text-[10px] text-rose-300 font-bold bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 cursor-default">
                          🚨 İptal Eden: <span className="text-rose-100">{booking.cancelled_by_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left md:text-center border-l border-r border-slate-700/50 px-6 cursor-default hover:bg-slate-900/30 transition-colors py-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Kira + Güvence</span>
                  <span className="text-lg font-black text-slate-300">
                    ₺{(parseFloat(booking.total_price) + parseFloat(booking.deposit_price)).toFixed(2)}
                  </span>
                </div>

                <div className="flex flex-col gap-2 min-w-[180px]">
                  {booking.status === "completed" && !booking.has_review && (
                    <button
                      onClick={() => openReviewModal(booking)}
                      className="btn-gradient p-2 text-xs !bg-amber-500 !border-amber-400 shadow-lg shadow-amber-500/30 cursor-pointer hover:scale-105 active:scale-95 transition-all">
                      ⭐ {activeTab === "renter" ? "Satıcıyı" : "Kiracıyı"} Değerlendir
                    </button>
                  )}
                  {booking.status === "completed" && booking.has_review && (
                    <div className="text-center text-xs text-amber-400 font-bold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 cursor-default hover:bg-amber-500/20 transition-colors">
                      ✅ Değerlendirme Yapıldı
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🎯 ÇİFT TARAFLI DEĞERLENDİRME MODALI */}
      <AnimatePresence>
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cyber-card p-6 w-full max-w-sm border border-amber-500/30 shadow-2xl shadow-amber-500/10">
              <h3 className="text-lg font-black text-amber-400 mb-1 cursor-default">⭐ {reviewData.targetRole}ı Değerlendir</h3>
              <p className="text-[10px] text-slate-400 mb-6 cursor-default">
                Kiralama deneyiminiz nasıldı? <b>@{reviewData.targetName}</b> isimli {reviewData.targetRole.toLowerCase()} için puanınızı ve
                yorumunuzu bırakın.
              </p>

              <form onSubmit={submitReview} className="space-y-4">
                <div className="flex justify-center gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewData({ ...reviewData, rating: star })}
                      className={`text-4xl hover:scale-125 cursor-pointer active:scale-90 transition-transform ${
                        reviewData.rating >= star
                          ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                          : "text-slate-700 grayscale"
                      }`}>
                      ★
                    </button>
                  ))}
                </div>

                <div className="space-y-1 mb-6">
                  <label className="text-[10px] uppercase font-black text-slate-400 font-mono block cursor-default">
                    Yorumunuz (İsteğe Bağlı)
                  </label>
                  <textarea
                    value={reviewData.comment}
                    onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                    placeholder="Deneyiminizi kısaca anlatın..."
                    className="cyber-input w-full resize-none h-24 text-xs focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="btn-slate flex-1 cursor-pointer hover:bg-slate-700 active:scale-95 transition-all">
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="btn-gradient flex-1 !bg-amber-500 !border-amber-400 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50">
                    {isSubmittingReview ? "Gönderiliyor..." : "Puanı Gönder"}
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

export default RentalHistory;
