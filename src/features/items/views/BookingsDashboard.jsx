import React, { useEffect, useState } from "react";
import { itemApi } from "../services/itemApi";
import { motion, AnimatePresence } from "framer-motion";
import { toast, cyberConfirm } from "../../../utils/alerts";
import { useNavigate } from "react-router-dom";

const BookingsDashboard = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("renter");
  const [currentUserId, setCurrentUserId] = useState(null);

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionType, setPinActionType] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  const formatReadableDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  };

  const fetchBookingsAndOffers = async () => {
    try {
      const realBookingsData = await itemApi.getBookings();
      const realBookings = realBookingsData.results || realBookingsData;

      const convsData = await itemApi.getConversations();
      const convList = convsData.results || convsData;
      let pseudoBookings = [];

      await Promise.all(
        convList.map(async (conv) => {
          const msgsData = await itemApi.getMessages(conv.id);
          const msgList = msgsData.results || msgsData;

          const acceptedOffers = msgList.filter((m) => m.is_offer && m.offer_status === "accepted");

          acceptedOffers.forEach((offer) => {
            const isAlreadyPaid = realBookings.some(
              (b) =>
                (b.item_detail.id === conv.item || b.item === conv.item) &&
                b.start_date === offer.offer_start_date &&
                b.end_date === offer.offer_end_date &&
                parseFloat(b.total_price) === parseFloat(offer.offer_price),
            );

            if (!isAlreadyPaid) {
              pseudoBookings.push({
                is_pseudo: true,
                id: `offer-${offer.id}`,
                item: conv.item,
                item_detail: {
                  id: conv.item,
                  title: conv.item_title,
                  images: [{ image: conv.item_image }],
                  owner: conv.owner,
                },
                renter: conv.renter,
                start_date: offer.offer_start_date,
                end_date: offer.offer_end_date,
                total_price: parseFloat(offer.offer_price).toFixed(2),
                deposit_price: (parseFloat(offer.offer_price) * 0.15).toFixed(2),
                status: "awaiting_payment",
              });
            }
          });
        }),
      );

      setBookings([...realBookings, ...pseudoBookings]);
    } catch (error) {
      console.error("İşlemler çekilemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        setCurrentUserId(String(payload.user_id).toLowerCase());
      } catch (e) {
        console.error("Token çözümlenemedi");
      }
    }
    fetchBookingsAndOffers();
  }, []);

  const handlePayPseudoBooking = async (booking) => {
    const basePrice = parseFloat(booking.total_price);
    const deposit = parseFloat(booking.deposit_price);
    const totalToPay = basePrice + deposit;

    const result = await cyberConfirm.fire({
      title: "Hemen Öde ve Kirala",
      html:
        `🤝 Kabul Edilen Teklif Tutarı: <b>₺${basePrice.toFixed(2)}</b><br/>` +
        `🛡️ Güvence Bedeli (%15): <b>₺${deposit.toFixed(2)}</b><br/><br/>` +
        `Toplam <b>₺${totalToPay.toFixed(2)}</b> cüzdanınızdan tahsil edilecektir.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "💳 Onayla ve Öde",
      cancelButtonText: "İptal",
    });

    if (!result.isConfirmed) return;

    try {
      const payload = {
        start_date: booking.start_date,
        end_date: booking.end_date,
        total_price: basePrice,
      };

      await itemApi.payWithWallet(booking.item, payload);
      toast.fire({ icon: "success", title: "Ödeme başarılı! Kiralama işlemi resmen başlatıldı." });
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "Ödeme işlemi başarısız oldu." });
      if (error.response?.data?.error?.toLowerCase().includes("yetersiz")) {
        navigate("/wallet");
      }
    }
  };

  const handleApprove = async (id) => {
    const result = await cyberConfirm.fire({
      title: "Talebi Onaylıyor musunuz?",
      text: "Bu işlemi onayladığınızda kiralama bedeli cüzdanınıza aktarılacaktır.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "✅ Evet, Onayla",
      cancelButtonText: "Vazgeç",
    });

    if (!result.isConfirmed) return;

    try {
      await itemApi.approveBooking(id);
      toast.fire({ icon: "success", title: "Rezervasyon başarıyla onaylandı!" });
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "Hata oluştu." });
    }
  };

  const handleCancel = async (id, isApproved) => {
    const warningMsg = isApproved
      ? "⚠️ DİKKAT: Bu kiralama onaylanmış! Başlangıç tarihine 24 saatten az kaldıysa bakiye kesintisi veya ilan yasaklaması uygulanabilir."
      : "Bu işlemi iptal etmek istediğinize emin misiniz?";

    const result = await cyberConfirm.fire({
      title: isApproved ? "Riskli İptal İşlemi" : "İşlemi İptal Et",
      text: warningMsg,
      icon: isApproved ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText: "❌ Evet, İptal Et",
      cancelButtonText: "Vazgeç",
      customClass: {
        confirmButton:
          "bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-rose-500/20 mx-2 transition-transform hover:scale-105",
      },
    });

    if (!result.isConfirmed) return;

    try {
      await itemApi.cancelBooking(id);
      toast.fire({ icon: "success", title: "İşlem başarıyla iptal edildi." });
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "İptal edilirken hata oluştu." });
    }
  };

  const openPinModal = (bookingId, actionType) => {
    setSelectedBookingId(bookingId);
    setPinActionType(actionType);
    setPinInput("");
    setSelectedFiles([]);
    setIsPinModalOpen(true);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 3) {
      toast.fire({ icon: "warning", title: "En fazla 3 fotoğraf yükleyebilirsiniz!" });
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
  };

  const handleRemoveFile = (indexToRemove) => {
    setSelectedFiles(selectedFiles.filter((_, idx) => idx !== indexToRemove));
  };

  const submitPin = async () => {
    if (selectedFiles.length === 0) {
      toast.fire({ icon: "warning", title: "Güvenlik protokolü gereği en az 1 adet fotoğraf yüklemek zorunludur!" });
      return;
    }

    const formData = new FormData();
    formData.append("pin", pinInput);
    selectedFiles.forEach((file) => {
      formData.append("images", file);
    });

    try {
      if (pinActionType === "handover") {
        await itemApi.handoverBooking(selectedBookingId, formData);
        toast.fire({ icon: "success", title: "Teslimat onaylandı, kiralama başladı!" });
      } else if (pinActionType === "complete") {
        await itemApi.completeBooking(selectedBookingId, formData);
        toast.fire({ icon: "success", title: "İade onaylandı, süreç tamamlandı!" });
      }
      setIsPinModalOpen(false);
      setSelectedFiles([]);
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "İşlem başarısız. Bilgileri kontrol edin." });
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      awaiting_payment: (
        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
          ⏳ Ödeme Bekleniyor
        </span>
      ),
      pending_approval: (
        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Onay Bekliyor
        </span>
      ),
      approved: (
        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Satıcı Onayladı
        </span>
      ),
      active: (
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Kirada (Aktif)
        </span>
      ),
    };
    return badges[status] || <span>{status}</span>;
  };

  if (loading)
    return <div className="w-full relative flex justify-center pt-20 text-slate-500 font-mono text-sm animate-pulse">YÜKLENİYOR...</div>;

  const filteredBookings = bookings.filter((b) => {
    if (!currentUserId) return false;
    const renterId = String(b.renter).toLowerCase();
    const ownerId = String(b.item_detail.owner).toLowerCase();
    const isUserRoleMatch = activeTab === "renter" ? renterId === currentUserId : ownerId === currentUserId;
    const isActiveStatus = ["awaiting_payment", "pending_approval", "approved", "active"].includes(b.status);
    return isUserRoleMatch && isActiveStatus;
  });

  return (
    <div className="w-full relative selection:bg-blue-500/30">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-black text-slate-100 mb-6">Kiralama İşlemlerim</h1>

        <div className="flex gap-4 border-b border-slate-700/50 pb-4">
          <button
            onClick={() => setActiveTab("renter")}
            className={`text-sm font-bold pb-2 transition-colors ${activeTab === "renter" ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"}`}>
            🛒 Benim Kiraladıklarım (Kiracı)
          </button>
          <button
            onClick={() => setActiveTab("owner")}
            className={`text-sm font-bold pb-2 transition-colors ${activeTab === "owner" ? "text-emerald-400 border-b-2 border-emerald-500" : "text-slate-400 hover:text-slate-200"}`}>
            📦 Bana Gelen Talepler (Satıcı)
          </button>
        </div>

        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="cyber-card p-10 text-center text-slate-500 border-dashed">Bu sekmede henüz bir işleminiz bulunmuyor.</div>
          ) : (
            filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="cyber-card p-5 border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <img
                    src={booking.item_detail.images?.[0]?.image || "https://via.placeholder.com/80"}
                    alt="item"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-700"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{booking.item_detail.title}</h3>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      {formatReadableDate(booking.start_date)} <span className="mx-1">→</span> {formatReadableDate(booking.end_date)}
                    </div>
                    <div className="mt-2">{getStatusBadge(booking.status)}</div>
                  </div>
                </div>

                <div className="text-left md:text-center border-l border-r border-slate-700/50 px-6">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Toplam Kiralama</span>
                  <span className="text-lg font-black text-blue-400">₺{booking.total_price}</span>
                  <div className="text-[10px] text-slate-500 mt-1">+₺{booking.deposit_price} Güvence Bedeli</div>
                </div>

                <div className="flex flex-col gap-2 min-w-[200px]">
                  {booking.status === "awaiting_payment" && activeTab === "renter" && (
                    <button
                      onClick={() => handlePayPseudoBooking(booking)}
                      className="btn-gradient p-2 text-[11px] shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-transform">
                      💳 Hemen Öde ve Başlat
                    </button>
                  )}
                  {booking.status === "awaiting_payment" && activeTab === "owner" && (
                    <div className="text-[10px] text-center w-full py-2 rounded-lg bg-slate-800/50 text-slate-400 font-bold border border-slate-700/50 cursor-default">
                      Kiracının Ödemesi Bekleniyor
                    </div>
                  )}

                  {booking.status === "pending_approval" && activeTab === "owner" && (
                    <button onClick={() => handleApprove(booking.id)} className="btn-gradient p-2 text-[11px]">
                      ✅ Talebi Onayla
                    </button>
                  )}

                  {["pending_approval", "approved"].includes(booking.status) && !booking.is_pseudo && (
                    <button
                      onClick={() => handleCancel(booking.id, booking.status === "approved")}
                      className="btn-slate !text-rose-400 p-2 text-[11px] hover:bg-rose-500/10 w-full border-rose-500/20">
                      ❌ İşlemi İptal Et
                    </button>
                  )}

                  {booking.status === "approved" && activeTab === "renter" && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 block">Teslim Alırken Satıcıya Söyle:</span>
                      <span className="text-lg font-mono font-black text-amber-400 tracking-widest">{booking.handover_pin}</span>
                    </div>
                  )}
                  {booking.status === "approved" && activeTab === "owner" && (
                    <button
                      onClick={() => openPinModal(booking.id, "handover")}
                      className="btn-slate bg-blue-500/10 text-blue-400 border-blue-500/50 p-2 text-[11px] hover:bg-blue-500/20">
                      📦 Ürünü Teslim Et (PIN + FOTO)
                    </button>
                  )}

                  {booking.status === "active" && activeTab === "owner" && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 block">İade Alırken Kiracıya Söyle:</span>
                      <span className="text-lg font-mono font-black text-emerald-400 tracking-widest">{booking.return_pin}</span>
                    </div>
                  )}
                  {booking.status === "active" && activeTab === "renter" && (
                    <button
                      onClick={() => openPinModal(booking.id, "complete")}
                      className="btn-slate bg-emerald-500/10 text-emerald-400 border-emerald-500/50 p-2 text-[11px] hover:bg-emerald-500/20">
                      🔄 İadeyi Tamamla (PIN + FOTO)
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PIN VE FOTO GİRİŞ MODALI */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cyber-card p-6 w-full max-w-sm border border-slate-600 shadow-2xl">
              <h3 className="text-lg font-black text-slate-100 mb-2">📸 Güvenli Kanıt Protokolü</h3>
              <p className="text-xs text-slate-400 mb-4">
                {pinActionType === "handover"
                  ? "Kiracının PIN kodunu girin ve ürünün şu anki durumunu gösteren fotoğrafları ekleyin."
                  : "Satıcının PIN kodunu girin ve ürünün iade anındaki durum fotoğraflarını ekleyin."}
              </p>

              <input
                type="text"
                placeholder="PIN"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                className="cyber-input w-full text-center text-2xl tracking-[0.5em] font-mono font-bold mb-4"
              />

              <div className="space-y-2 mb-4">
                <label className="text-[10px] uppercase font-black text-slate-400 font-mono block">
                  Durum Fotoğrafları (En fazla 3 adet)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={selectedFiles.length >= 3}
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 file:cursor-pointer cursor-pointer border border-slate-700/50 p-2 rounded-xl bg-slate-950/40 disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 mb-6 max-h-28 overflow-y-auto bg-slate-950/40 p-2.5 border border-slate-800 rounded-xl">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#1e293b]/60 border border-slate-700/40 px-3 py-1.5 rounded-lg">
                      <span className="text-[11px] text-slate-300 font-mono truncate max-w-[200px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-rose-400 hover:text-rose-500 font-bold text-xs p-1 cursor-pointer transition-colors">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setIsPinModalOpen(false)} className="btn-slate flex-1 cursor-pointer active:scale-95">
                  İptal
                </button>
                <button onClick={submitPin} className="btn-gradient flex-1 cursor-pointer active:scale-95">
                  Doğrula ve Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookingsDashboard;
