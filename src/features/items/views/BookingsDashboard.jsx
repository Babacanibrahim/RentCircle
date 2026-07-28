import React, { useEffect, useState } from "react";
import { itemApi } from "../services/itemApi";
import { motion, AnimatePresence } from "framer-motion";
import { toast, cyberConfirm } from "../../../utils/alerts";
import { useNavigate, Link } from "react-router-dom";

const BookingsDashboard = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("renter");
  const [currentUserId, setCurrentUserId] = useState(null);

  // Modal State'leri
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinActionType, setPinActionType] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [notesInput, setNotesInput] = useState(""); // 🎯 YENİ: Yorum/Not alanı
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Anlaşmazlık Modalı State'leri
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

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

  // -----------------------------------------------------------
  // 🎯 YENİ UÇTAN UCA ONAYLAMA MANTIKLARI
  // -----------------------------------------------------------

  // SATICI: İlk ödeme gelince kiralama talebini onaylar
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

  // SATICI: Kiracının gönderdiği teslimat fotoğraflarını inceler ve onaylar (handover_pending -> active)
  const handleApproveHandover = async (id) => {
    const result = await cyberConfirm.fire({
      title: "Teslimatı Onayla",
      text: "Kiracının yüklediği fotoğrafları ve notu incelediniz mi? Ürününüzü sorunsuz teslim ettiğinizi onaylıyor musunuz?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "📦 Evet, Teslim Ettim",
      cancelButtonText: "Vazgeç",
    });

    if (!result.isConfirmed) return;

    try {
      await itemApi.approveHandover(id);
      toast.fire({ icon: "success", title: "Kiralama resmen başladı!" });
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "Hata oluştu." });
    }
  };

  // KİRACI: Satıcının gönderdiği iade fotoğraflarını inceler ve onaylar (return_pending -> completed)
  const handleApproveReturn = async (id) => {
    const result = await cyberConfirm.fire({
      title: "İadeyi Onayla",
      text: "Satıcının yüklediği fotoğrafları ve notu incelediniz mi? İade işleminin sorunsuz tamamlandığını onaylıyor musunuz?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "🔄 Evet, İadeyi Onayla",
      cancelButtonText: "Vazgeç",
    });

    if (!result.isConfirmed) return;

    try {
      await itemApi.approveReturn(id);
      toast.fire({ icon: "success", title: "İşlem tamamlandı, depozitonuz iade edilecek!" });
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "Hata oluştu." });
    }
  };

  // -----------------------------------------------------------

  const handleCancel = async (booking) => {
    const isApproved = booking.status === "approved";
    const warningMsg = isApproved
      ? "⚠️ DİKKAT: Bu kiralama onaylanmış! Başlangıç tarihine 24 saatten az kaldıysa bakiye kesintisi veya ilan yasaklaması uygulanabilir."
      : "Bu işlemi (veya kabul edilen teklifi) iptal etmek istediğinize emin misiniz?";

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
      if (booking.is_pseudo) {
        const offerId = booking.id.replace("offer-", "");
        await itemApi.respondToOffer(offerId, "reject");
      } else {
        await itemApi.cancelBooking(booking.id);
      }

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
    setNotesInput("");
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
    formData.append("notes", notesInput); // 🎯 YENİ: Notları da gönderiyoruz
    selectedFiles.forEach((file) => {
      formData.append("images", file);
    });

    try {
      if (pinActionType === "handover") {
        await itemApi.handoverBooking(selectedBookingId, formData);
        toast.fire({ icon: "success", title: "Teslimat kanıtları satıcıya iletildi!" });
      } else if (pinActionType === "complete") {
        await itemApi.completeBooking(selectedBookingId, formData);
        toast.fire({ icon: "success", title: "İade kanıtları kiracıya iletildi!" });
      }
      setIsPinModalOpen(false);
      setSelectedFiles([]);
      setNotesInput("");
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "İşlem başarısız. Bilgileri kontrol edin." });
    }
  };

  // 🎯 YENİ: Uyuşmazlık (Dispute) Fonksiyonları
  const openDisputeModal = (bookingId) => {
    setSelectedBookingId(bookingId);
    setDisputeReason("");
    setIsDisputeModalOpen(true);
  };

  const submitDispute = async () => {
    if (!disputeReason.trim()) {
      return toast.fire({ icon: "warning", title: "Lütfen itiraz sebebini yazınız." });
    }

    try {
      await itemApi.raiseDispute(selectedBookingId, { reason: disputeReason });
      toast.fire({ icon: "success", title: "İtirazınız yetkililere iletildi." });
      setIsDisputeModalOpen(false);
      fetchBookingsAndOffers();
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "İşlem başarısız." });
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
          Satıcı Onayı Bekliyor
        </span>
      ),
      approved: (
        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Teslim Bekleniyor
        </span>
      ),
      handover_pending: (
        <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
          Teslimat Onayı Bekliyor
        </span>
      ),
      active: (
        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Kirada (Aktif)
        </span>
      ),
      return_pending: (
        <span className="px-3 py-1 bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
          İade Onayı Bekliyor
        </span>
      ),
      disputed: (
        <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider animate-bounce">
          🚨 Anlaşmazlık Var
        </span>
      ),
      completed: (
        <span className="px-3 py-1 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg text-[10px] font-black uppercase tracking-wider">
          Tamamlandı
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

    // 🎯 YENİ: Gösterilecek statüleri güncelledik (iptaller hariç her şey)
    const isActiveStatus = [
      "awaiting_payment",
      "pending_approval",
      "approved",
      "handover_pending",
      "active",
      "return_pending",
      "disputed",
    ].includes(b.status);
    return isUserRoleMatch && isActiveStatus;
  });

  return (
    <div className="w-full relative selection:bg-blue-500/30 min-h-screen">
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
                className="cyber-card p-5 border border-slate-700/50 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-slate-800/30 transition-colors">
                {/* SOL: İlan Bilgileri */}
                <div className="flex items-start gap-4">
                  <Link to={`/listings/${booking.item_detail.id}`} className="shrink-0">
                    <img
                      src={booking.item_detail.images?.[0]?.image || "https://via.placeholder.com/80"}
                      alt="item"
                      className="w-20 h-20 object-cover rounded-xl border border-slate-700 hover:border-blue-400 transition-colors"
                    />
                  </Link>
                  <div>
                    <Link to={`/listings/${booking.item_detail.id}`}>
                      <h3 className="text-sm font-bold text-slate-100 hover:text-blue-400 transition-colors">
                        {booking.item_detail.title}
                      </h3>
                    </Link>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      {formatReadableDate(booking.start_date)} <span className="mx-1">→</span> {formatReadableDate(booking.end_date)}
                    </div>
                    <div className="mt-2.5">{getStatusBadge(booking.status)}</div>
                  </div>
                </div>

                {/* ORTA: Fiyatlar ve Anlaşmazlık/Not Detayları */}
                <div className="text-left md:text-center border-l border-r border-slate-700/50 px-6 max-w-[250px] flex-1 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Toplam Kiralama</span>
                  <span className="text-lg font-black text-blue-400">₺{booking.total_price}</span>
                  <div className="text-[10px] text-slate-500 mt-1">+₺{booking.deposit_price} Güvence Bedeli</div>

                  {/* Yeni: Varsa yorumları/itirazları göster */}
                  {booking.handover_notes && (
                    <div className="mt-3 text-[10px] text-slate-400 italic bg-slate-900/50 p-2 rounded border border-slate-700/50">
                      <span className="font-bold text-slate-300 not-italic block mb-0.5">Kiracının Teslimat Notu:</span>"
                      {booking.handover_notes}"
                    </div>
                  )}
                  {booking.return_notes && (
                    <div className="mt-2 text-[10px] text-slate-400 italic bg-slate-900/50 p-2 rounded border border-slate-700/50">
                      <span className="font-bold text-slate-300 not-italic block mb-0.5">Satıcının İade Notu:</span>"{booking.return_notes}"
                    </div>
                  )}
                  {booking.status === "disputed" && (
                    <div className="mt-2 text-[10px] text-rose-400 font-bold bg-rose-500/10 p-2 rounded border border-rose-500/30">
                      İtiraz Sebebi: "{booking.dispute_reason}"
                    </div>
                  )}
                </div>

                {/* SAĞ: Aksiyon Butonları (Dinamik) */}
                <div className="flex flex-col gap-2 min-w-[200px] shrink-0 justify-center">
                  {/* --- 0. Ödeme / Onay --- */}
                  {booking.status === "awaiting_payment" && activeTab === "renter" && (
                    <button
                      onClick={() => handlePayPseudoBooking(booking)}
                      className="btn-gradient p-2 text-[11px] shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-transform">
                      💳 Hemen Öde ve Başlat
                    </button>
                  )}
                  {booking.status === "pending_approval" && activeTab === "owner" && (
                    <button onClick={() => handleApprove(booking.id)} className="btn-gradient p-2 text-[11px]">
                      ✅ Talebi Onayla
                    </button>
                  )}

                  {/* İptal Et (Ödeme ve onay aşamasında) */}
                  {["awaiting_payment", "pending_approval", "approved"].includes(booking.status) && (
                    <button
                      onClick={() => handleCancel(booking)}
                      className="btn-slate !text-rose-400 p-2 text-[11px] hover:bg-rose-500/10 w-full border-rose-500/20">
                      ❌ İşlemi İptal Et
                    </button>
                  )}

                  {/* --- 1. TESLİMAT AŞAMASI (approved) --- */}
                  {booking.status === "approved" && activeTab === "owner" && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 block">Teslim Ederken Kiracıya Söyle:</span>
                      <span className="text-lg font-mono font-black text-amber-400 tracking-widest">{booking.handover_pin}</span>
                    </div>
                  )}
                  {booking.status === "approved" && activeTab === "renter" && (
                    <button
                      onClick={() => openPinModal(booking.id, "handover")}
                      className="btn-slate bg-indigo-500/10 text-indigo-400 border-indigo-500/50 p-2 text-[11px] hover:bg-indigo-500/20">
                      📦 Ürünü Teslim Al (PIN + FOTO)
                    </button>
                  )}

                  {/* --- 2. TESLİMAT ONAYI AŞAMASI (handover_pending) --- */}
                  {booking.status === "handover_pending" && activeTab === "owner" && (
                    <>
                      <button
                        onClick={() => handleApproveHandover(booking.id)}
                        className="btn-gradient !bg-emerald-500 !border-emerald-400 p-2 text-[11px] shadow-lg shadow-emerald-500/20">
                        ✅ Teslimatı Onayla
                      </button>
                      <button
                        onClick={() => openDisputeModal(booking.id)}
                        className="btn-slate !text-rose-400 p-2 text-[11px] hover:bg-rose-500/10 w-full border-rose-500/20 mt-1">
                        🚨 İtiraz Et (Uyuşmazlık)
                      </button>
                    </>
                  )}
                  {booking.status === "handover_pending" && activeTab === "renter" && (
                    <div className="text-[10px] text-center w-full py-2 rounded-lg bg-slate-800/50 text-slate-400 font-bold border border-slate-700/50 cursor-default">
                      Satıcının onayı bekleniyor
                    </div>
                  )}

                  {/* --- 3. İADE AŞAMASI (active) --- */}
                  {booking.status === "active" && activeTab === "renter" && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 block">İade Ederken Satıcıya Söyle:</span>
                      <span className="text-lg font-mono font-black text-emerald-400 tracking-widest">{booking.return_pin}</span>
                    </div>
                  )}
                  {booking.status === "active" && activeTab === "owner" && (
                    <button
                      onClick={() => openPinModal(booking.id, "complete")}
                      className="btn-slate bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/50 p-2 text-[11px] hover:bg-fuchsia-500/20">
                      🔄 İadeyi Al (PIN + FOTO)
                    </button>
                  )}

                  {/* --- 4. İADE ONAYI AŞAMASI (return_pending) --- */}
                  {booking.status === "return_pending" && activeTab === "renter" && (
                    <>
                      <button
                        onClick={() => handleApproveReturn(booking.id)}
                        className="btn-gradient !bg-emerald-500 !border-emerald-400 p-2 text-[11px] shadow-lg shadow-emerald-500/20">
                        ✅ İadeyi Onayla (Depozitoyu Al)
                      </button>
                      <button
                        onClick={() => openDisputeModal(booking.id)}
                        className="btn-slate !text-rose-400 p-2 text-[11px] hover:bg-rose-500/10 w-full border-rose-500/20 mt-1">
                        🚨 İtiraz Et (Hasar Var)
                      </button>
                    </>
                  )}
                  {booking.status === "return_pending" && activeTab === "owner" && (
                    <div className="text-[10px] text-center w-full py-2 rounded-lg bg-slate-800/50 text-slate-400 font-bold border border-slate-700/50 cursor-default">
                      Kiracının onayı bekleniyor
                    </div>
                  )}

                  {/* --- 5. ANLAŞMAZLIK AŞAMASI (disputed) --- */}
                  {booking.status === "disputed" && (
                    <div className="text-[10px] text-center w-full py-2 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/30 cursor-default">
                      Yönetici İncelemesinde
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🎯 PIN, FOTO VE NOT GİRİŞ MODALI */}
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
                  ? "Satıcının PIN kodunu girin, ürünün durumunu gösteren fotoğrafları ekleyin ve notunuzu bırakın."
                  : "Kiracının PIN kodunu girin, iade anındaki durum fotoğraflarını ekleyin ve notunuzu bırakın."}
              </p>

              <input
                type="text"
                placeholder="PIN"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                className="cyber-input w-full text-center text-2xl tracking-[0.5em] font-mono font-bold mb-4"
              />

              {/* 🎯 YENİ: Yorum Alanı */}
              <textarea
                placeholder="Ürünün durumu hakkında notunuz (Örn: Çiziksiz teslim aldım)"
                rows={3}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="cyber-input w-full resize-none text-xs mb-4"
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

      {/* 🎯 YENİ: İTİRAZ (DISPUTE) MODALI */}
      <AnimatePresence>
        {isDisputeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cyber-card p-6 w-full max-w-sm border border-rose-500/30 shadow-2xl shadow-rose-500/10">
              <h3 className="text-lg font-black text-rose-400 mb-2 flex items-center gap-2">🚨 Anlaşmazlık Bildir</h3>
              <p className="text-xs text-slate-400 mb-4">
                Karşı tarafın yüklediği fotoğraflar veya notlar gerçeği yansıtmıyorsa, hasar varsa veya ürün eksikse lütfen detaylıca
                açıklayın.
              </p>

              <textarea
                placeholder="Lütfen itiraz sebebinizi detaylı bir şekilde yazınız..."
                rows={5}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="cyber-input w-full resize-none text-sm mb-6"
              />

              <div className="flex gap-3">
                <button onClick={() => setIsDisputeModalOpen(false)} className="btn-slate flex-1 cursor-pointer active:scale-95">
                  Vazgeç
                </button>
                <button
                  onClick={submitDispute}
                  className="btn-gradient !bg-rose-600 !border-rose-500 flex-1 cursor-pointer active:scale-95 shadow-lg shadow-rose-500/20">
                  Bildirimi Gönder
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
