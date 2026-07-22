import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { itemApi } from "../services/itemApi";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { toast, cyberConfirm } from "../../../utils/alerts";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [bookingDates, setBookingDates] = useState({ start_date: "", end_date: "" });

  const [previewPrice, setPreviewPrice] = useState({ base: 0, deposit: 0, total: 0 });
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerDates, setOfferDates] = useState({ start_date: "", end_date: "" });
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await itemApi.getListingDetail(id);
        setItem(data);
        setIsFavorite(data.is_favorite || false);
        const mainImgIndex = data.images?.findIndex((img) => img.is_main);
        setCurrentImgIndex(mainImgIndex !== -1 ? mainImgIndex : 0);
      } catch (error) {
        toast.fire({ icon: "error", title: "Ürün bulunamadı." });
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();

    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        setCurrentUserId(payload.user_id);
      } catch (e) {
        console.error("Token çözümlenemedi");
      }
    }
  }, [id]);

  useEffect(() => {
    if (bookingDates.start_date && bookingDates.end_date && item) {
      const start = new Date(bookingDates.start_date);
      const end = new Date(bookingDates.end_date);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const basePrice = diffDays * parseFloat(item.price_per_day);
      const depositAmount = basePrice * 0.15;

      setPreviewPrice({
        base: basePrice,
        deposit: depositAmount,
        total: basePrice + depositAmount,
      });
    } else {
      setPreviewPrice({ base: 0, deposit: 0, total: 0 });
    }
  }, [bookingDates, item]);

  const nextImage = () => {
    if (!item?.images || item.images.length === 0) return;
    setCurrentImgIndex((prev) => (prev + 1) % item.images.length);
  };

  const prevImage = () => {
    if (!item?.images || item.images.length === 0) return;
    setCurrentImgIndex((prev) => (prev - 1 + item.images.length) % item.images.length);
  };

  const formatNextAvailableDate = (dateString) => {
    if (!dateString) return "Hemen Müsait";
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  };

  const handleFavoriteToggle = async () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) {
      toast.fire({ icon: "info", title: "Favoriye eklemek için giriş yapmalısınız." });
      return window.scrollTo({ top: 0, behavior: "smooth" });
    }
    try {
      await itemApi.toggleFavorite(item.id, token);
      setIsFavorite(!isFavorite);
    } catch (err) {
      console.error("Favori işlemi başarısız:", err);
    }
  };

  const handleStartChat = async () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) return toast.fire({ icon: "info", title: "Satıcıya mesaj atmak için giriş yapmalısınız." });

    if (currentUserId === item.owner) return toast.fire({ icon: "warning", title: "Kendi ilanınıza mesaj gönderemezsiniz." });

    try {
      const checkData = await itemApi.checkConversationExists(item.id);

      if (checkData.exists) {
        navigate(`/chat?conv_id=${checkData.conversation_id}`);
      } else {
        navigate(`/chat?new_item=${item.id}&title=${encodeURIComponent(item.title)}`);
      }
    } catch (err) {
      console.error("Sohbet kontrol hatası:", err);
      navigate("/chat");
    }
  };

  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!offerPrice || !offerDates.start_date || !offerDates.end_date) {
      return toast.fire({ icon: "warning", title: "Lütfen tarihleri ve teklif tutarınızı eksiksiz girin." });
    }

    setIsSubmittingOffer(true);
    try {
      const payload = {
        item_id: item.id,
        content: `Size özel bir teklif gönderdim: ${offerDates.start_date} - ${offerDates.end_date} tarihleri arası toplam ${offerPrice} ₺`,
        is_offer: true,
        offer_price: offerPrice,
        start_date: offerDates.start_date,
        end_date: offerDates.end_date,
      };

      const result = await itemApi.sendDirectMessage(payload);
      setIsOfferModalOpen(false);

      const confirmNav = await cyberConfirm.fire({
        title: "Teklif Gönderildi! 🎉",
        text: "Teklifiniz satıcıya başarıyla iletildi. Sohbet sayfasına gitmek ister misiniz?",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "💬 Sohbete Git",
        cancelButtonText: "Sayfada Kal",
      });

      if (confirmNav.isConfirmed) {
        navigate(`/chat?conv_id=${result.conversation_id}`);
      }
    } catch (error) {
      toast.fire({ icon: "error", title: "Teklif gönderilirken bir hata oluştu: " + (error.response?.data?.error || "Bilinmeyen Hata") });
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleRentAndPay = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

    if (!token) return toast.fire({ icon: "info", title: "Rezervasyon yapabilmek için lütfen önce giriş yapın." });
    if (!bookingDates.start_date || !bookingDates.end_date)
      return toast.fire({ icon: "warning", title: "Lütfen kiralama tarihlerini seçin." });

    const result = await cyberConfirm.fire({
      title: "Kiralamayı Onayla",
      text: `Toplam ₺${previewPrice.total.toLocaleString("tr-TR")} cüzdanınızdan tahsil edilecektir. Devam etmek istiyor musunuz?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "💳 Onayla ve Öde",
      cancelButtonText: "Vazgeç",
    });

    if (!result.isConfirmed) return;
    toast.fire({ icon: "info", title: "💳 Cüzdan bakiyenizden ödeme alınıyor, lütfen bekleyin..." });

    const bookingData = {
      start_date: bookingDates.start_date,
      end_date: bookingDates.end_date,
      total_price: previewPrice.base,
    };

    try {
      const res = await itemApi.payWithWallet(item.id, bookingData);
      toast.fire({ icon: "success", title: "✅ " + res.message });
      navigate("/bookings");
    } catch (err) {
      const errMsg = err.response?.data?.error || "Ödeme sırasında bir hata oluştu.";
      toast.fire({ icon: "error", title: errMsg });

      if (errMsg.toLowerCase().includes("yetersiz")) {
        const goToWallet = await cyberConfirm.fire({
          title: "Yetersiz Bakiye",
          text: "Cüzdan bakiyeniz yetersiz. Bakiye yüklemek için Cüzdanım sayfasına gitmek ister misiniz?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "💸 Cüzdana Git",
          cancelButtonText: "İptal",
        });
        if (goToWallet.isConfirmed) navigate("/wallet");
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full relative flex items-center justify-center font-mono text-xs tracking-widest text-slate-400 animate-pulse pt-20">
        İLAN DETAYLARI YÜKLENİYOR...
      </div>
    );
  }

  if (!item) return <div className="w-full relative text-center pt-20 text-slate-500 font-mono">Ürün bulunamadı.</div>;

  const activeImage = item.images?.[currentImgIndex]?.image || "";
  const today = new Date();
  const todayStr =
    today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

  const minStartDate =
    !item.is_available && item.next_available_date && item.next_available_date > todayStr ? item.next_available_date : todayStr;

  return (
    <div className="w-full relative selection:bg-blue-500/30">
      <div className="p-6 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* SOL KISIM: GÖRSELLER VE HARİTA */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-4">
                <div className="cyber-card relative h-[480px] w-full flex items-center justify-center group overflow-hidden border border-slate-700/50 hover:border-slate-500/50 transition-colors">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent z-10 pointer-events-none" />
                  {activeImage ? (
                    <>
                      <img
                        src={activeImage}
                        alt={item.title}
                        onClick={() => setIsLightboxOpen(true)}
                        className="w-full h-full object-cover cursor-zoom-in hover:scale-[1.02] transition-transform duration-500"
                      />
                      {item.images?.length > 1 && (
                        <>
                          <button
                            onClick={prevImage}
                            className="absolute left-4 z-20 btn-slate p-3 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-slate-700 hover:text-white transition-all active:scale-90">
                            ◀
                          </button>
                          <button
                            onClick={nextImage}
                            className="absolute right-4 z-20 btn-slate p-3 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-slate-700 hover:text-white transition-all active:scale-90">
                            ▶
                          </button>
                        </>
                      )}
                      <div className="absolute top-4 right-4 z-20 bg-slate-950/80 border border-slate-700/50 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider text-slate-400 pointer-events-none">
                        🔍 BÜYÜT
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-500 text-sm font-mono cursor-default">GÖRSEL YÜKLENMEMİŞ</span>
                  )}
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {item.images?.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentImgIndex(idx)}
                      className={`cyber-card cursor-pointer relative w-20 h-20 overflow-hidden flex-shrink-0 !rounded-xl transition-all hover:scale-105 active:scale-95 ${currentImgIndex === idx ? "border-blue-500 ring-1 ring-blue-500/50 shadow-md shadow-blue-500/20" : "hover:border-slate-500"}`}>
                      <img src={img.image} alt="thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* SOL KISIMDAKİ HARİTA BÖLÜMÜ (ItemDetail.jsx içinde ilgili yeri bununla değiştir) */}
              <div className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between cursor-default">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">🗺️ Konum Bilgisi</h2>
                </div>

                {/* 🎯 YENİ: Açık Adres Yazı Alanı */}
                {(item.region || item.full_address) && (
                  <div className="bg-slate-900/50 border border-slate-700/50 p-3 rounded-xl flex items-start gap-3">
                    <span className="text-lg mt-0.5">📍</span>
                    <div>
                      <p className="text-xs font-bold text-slate-200">
                        {item.city}, {item.district}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {item.region ? `${item.region} Mah.` : ""} {item.full_address ? item.full_address : ""}
                      </p>
                    </div>
                  </div>
                )}

                <div className="cyber-card overflow-hidden h-[300px] border border-slate-700/50 relative z-0">
                  {item.latitude && item.longitude ? (
                    <MapContainer
                      center={[parseFloat(item.latitude), parseFloat(item.longitude)]}
                      zoom={15}
                      scrollWheelZoom={false}
                      className="w-full h-full rounded-xl">
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
                      <Marker position={[parseFloat(item.latitude), parseFloat(item.longitude)]}>
                        <Popup>
                          <div className="text-center font-bold font-mono">
                            {item.title} <br /> {item.district}, {item.city}
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono cursor-default">
                      Bu ilan için detaylı konum belirtilmemiş.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SAĞ KISIM: İLAN BİLGİLERİ VE BUTONLAR */}
            <div className="lg:col-span-5 space-y-6">
              <div className="cyber-card p-6 space-y-5">
                <div className="flex items-center justify-between cursor-default">
                  <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                    ⚡ {item.category_detail?.name || "Kategori"}
                  </span>
                  <span
                    className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-lg border transition-colors ${item.is_available ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20"}`}>
                    {item.is_available ? "● AKTİF İLAN" : "● ŞU AN KİRADA"}
                  </span>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-100 cursor-default">{item.title}</h1>

                <button
                  onClick={handleFavoriteToggle}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 w-fit ${isFavorite ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20" : "bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white"}`}>
                  <span className={isFavorite ? "animate-pulse" : ""}>{isFavorite ? "❤️" : "🤍"}</span>
                  <span className="text-xs font-bold tracking-wide">{isFavorite ? "Favorilerde Ekli" : "Favorilere Ekle"}</span>
                </button>

                <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-4 border border-slate-700/50 rounded-2xl cursor-default hover:bg-slate-900/40 transition-colors">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Şehir</span>
                    <div className="text-xs font-bold text-slate-200 mt-1">🏙️ {item.city}</div>
                  </div>
                  <div className="border-l border-slate-700/50 pl-4">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">İlçe / Bölge</span>
                    <div className="text-xs font-bold text-slate-200 mt-1">
                      📍 {item.district} {item.region ? `(${item.region})` : ""}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold font-mono cursor-default">Ürün Açıklaması</span>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-4 border border-slate-700/50 rounded-2xl h-28 overflow-y-auto scrollbar-thin hover:border-slate-600/50 transition-colors">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-700/50 rounded-2xl cursor-default hover:bg-slate-900/60 transition-colors">
                  <span className="text-xs text-slate-400 font-medium">Günlük Kiralama Bedeli</span>
                  <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                    ₺{parseFloat(item.price_per_day).toLocaleString("tr-TR")}
                  </span>
                </div>
              </div>

              <div className="cyber-card p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-lg uppercase cursor-default">
                      {item.owner_show_name ? item.owner_first_name?.[0] : item.owner_username?.[0] || "S"}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block cursor-default">Satıcı Profili</span>
                      <h3
                        onClick={() => navigate(`/stores/${item.owner}`)}
                        className="text-sm font-black text-slate-100 hover:text-blue-400 cursor-pointer transition">
                        {item.owner_show_name
                          ? `${item.owner_first_name} ${item.owner_last_name}`
                          : `@${item.owner_username || "Kullanici"}`}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold mt-0.5 cursor-default">
                        ⭐ {item.owner_rating > 0 ? item.owner_rating : "Yeni"}
                        <span className="text-slate-500 font-normal text-[10px]">({item.owner_review_count || 0})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    onClick={handleStartChat}
                    className="btn-slate cursor-pointer hover:bg-blue-600 hover:text-white hover:border-blue-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 py-3 shadow-sm">
                    💬 Mesaj At
                  </button>
                  <button
                    onClick={() => {
                      const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
                      if (!token) return toast.fire({ icon: "info", title: "Teklif vermek için giriş yapmalısınız." });
                      if (currentUserId === item.owner)
                        return toast.fire({ icon: "warning", title: "Kendi ilanınıza teklif veremezsiniz." });
                      setIsOfferModalOpen(true);
                    }}
                    className="btn-gradient cursor-pointer !bg-amber-500 !border-amber-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 py-3 shadow-lg shadow-amber-500/20 transition-all">
                    🤝 Teklif Ver
                  </button>
                </div>
              </div>

              <div className="cyber-card p-6 space-y-4">
                <h2 className="text-xs font-bold tracking-widest text-slate-300 uppercase font-mono cursor-default">📅 Kiralama Talebi</h2>
                {!item.is_available && (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center bg-[#0f172a]/40 p-3 rounded-xl border border-slate-700/50 cursor-default hover:bg-slate-900/40 transition-colors">
                      <span className="text-xs font-bold text-slate-400">Ürün Durumu: Kirada. En Erken:</span>
                      <span className="text-xs font-mono font-black text-blue-400">
                        {formatNextAvailableDate(item.next_available_date)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 cursor-default hover:bg-blue-500/20 transition-colors">
                  ℹ️ Kiralama süresince ürününüzü korumak adına <strong>%15 depozito (güvence bedeli)</strong> alınmaktadır. Ürün sağlam
                  iade edildiğinde bu tutar iade edilir.
                </div>
                <form onSubmit={handleRentAndPay} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Başlangıç</label>
                      <input
                        type="date"
                        required
                        min={minStartDate}
                        value={bookingDates.start_date}
                        onChange={(e) => setBookingDates({ ...bookingDates, start_date: e.target.value, end_date: "" })}
                        className="cyber-input cursor-pointer hover:border-blue-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Bitiş</label>
                      <input
                        type="date"
                        required
                        disabled={!bookingDates.start_date}
                        min={bookingDates.start_date}
                        value={bookingDates.end_date}
                        onChange={(e) => setBookingDates({ ...bookingDates, end_date: e.target.value })}
                        className="cyber-input cursor-pointer disabled:opacity-40 hover:border-blue-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {previewPrice.total > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-xl mt-3 space-y-2 overflow-hidden cursor-default hover:bg-slate-900 transition-colors">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Kira Bedeli</span>
                          <span>₺{previewPrice.base.toLocaleString("tr-TR")}</span>
                        </div>
                        <div className="flex justify-between text-xs text-amber-400/80">
                          <span>Depozito Güvencesi (%15)</span>
                          <span>₺{previewPrice.deposit.toLocaleString("tr-TR")}</span>
                        </div>
                        <div className="border-t border-slate-700/50 pt-2 flex justify-between text-sm font-black text-slate-200">
                          <span>Genel Toplam</span>
                          <span className="text-blue-400">₺{previewPrice.total.toLocaleString("tr-TR")}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    className="btn-gradient w-full p-3.5 flex flex-col items-center justify-center cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
                    <span className="font-bold">Cüzdan ile Kirala ve Öde</span>
                    {previewPrice.total > 0 && (
                      <span className="text-[10px] opacity-80">(₺{previewPrice.total.toLocaleString("tr-TR")} Tahsil Edilecek)</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* 🎯 TEKLİF VER MODALI */}
        <AnimatePresence>
          {isOfferModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="cyber-card p-6 w-full max-w-sm border border-amber-500/30 shadow-2xl shadow-amber-500/10">
                <h3 className="text-lg font-black text-slate-100 mb-1 cursor-default">🤝 Özel Teklif Ver</h3>
                <p className="text-[10px] text-slate-400 mb-6 cursor-default">
                  Tarihleri ve bütçenizi girin. Satıcı onaylarsa chat üzerinden doğrudan ödeme yapabileceksiniz.
                </p>

                <form onSubmit={handleSendOffer} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Başlangıç</label>
                      <input
                        type="date"
                        required
                        min={minStartDate}
                        value={offerDates.start_date}
                        onChange={(e) => setOfferDates({ ...offerDates, start_date: e.target.value, end_date: "" })}
                        className="cyber-input text-xs cursor-pointer hover:border-amber-500/50 transition-colors focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Bitiş</label>
                      <input
                        type="date"
                        required
                        disabled={!offerDates.start_date}
                        min={offerDates.start_date}
                        value={offerDates.end_date}
                        onChange={(e) => setOfferDates({ ...offerDates, end_date: e.target.value })}
                        className="cyber-input text-xs cursor-pointer disabled:opacity-40 hover:border-amber-500/50 transition-colors focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-black text-slate-400 font-mono block cursor-default">
                      Teklif Edilen Toplam Tutar (₺)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Örn: 500"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      className="cyber-input w-full text-base font-bold hover:border-amber-500/50 transition-colors focus:border-amber-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsOfferModalOpen(false)}
                      className="btn-slate flex-1 cursor-pointer hover:bg-slate-700 active:scale-95 transition-all">
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingOffer}
                      className="btn-gradient flex-1 !bg-amber-500 !border-amber-400 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20">
                      {isSubmittingOffer ? "Gönderiliyor..." : "Teklifi Gönder"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* LIGHTBOX AYNEN KALIYOR */}
        <AnimatePresence>
          {isLightboxOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setIsLightboxOpen(false)}>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="absolute top-6 right-6 btn-slate !font-mono tracking-widest cursor-pointer hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 active:scale-90 transition-all">
                KAPAT [ESC]
              </button>
              <motion.img
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                src={activeImage}
                alt="fullscreen"
                className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-slate-800 cursor-default"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ItemDetail;
