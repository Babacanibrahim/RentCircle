import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { itemApi } from "../services/itemApi";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { toast, cyberConfirm } from "../../../utils/alerts";

// Takvim Kütüphaneleri
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { parseISO } from "date-fns";

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

  // Takvim State'leri
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
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

  // Takvimden seçilen tarihlere göre Fiyat Önizlemesi
  useEffect(() => {
    if (startDate && endDate && item) {
      const diffTime = Math.abs(endDate - startDate);
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
  }, [startDate, endDate, item]);

  // Teklif tarihlerine göre otomatik fiyat hesaplama
  useEffect(() => {
    if (offerDates.start_date && offerDates.end_date && item?.price_per_day) {
      const start = new Date(offerDates.start_date);
      const end = new Date(offerDates.end_date);

      if (end >= start) {
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const calculatedTotal = diffDays * parseFloat(item.price_per_day);
        setOfferPrice(calculatedTotal.toString());
      }
    }
  }, [offerDates.start_date, offerDates.end_date, item]);

  const nextImage = (e) => {
    if (e) e.stopPropagation();
    if (!item?.images || item.images.length === 0) return;
    setCurrentImgIndex((prev) => (prev + 1) % item.images.length);
  };

  const prevImage = (e) => {
    if (e) e.stopPropagation();
    if (!item?.images || item.images.length === 0) return;
    setCurrentImgIndex((prev) => (prev - 1 + item.images.length) % item.images.length);
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

  // 🎯 YENİ: Native Share API Entegrasyonu
  const handleShare = async () => {
    const shareData = {
      title: item.title,
      text: `RentCircle'da bu harika ilana göz at: ${item.title} - Sadece ₺${item.price_per_day}/Gün!`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Kullanıcı paylaşım penceresini kapattığında sessizce geç
      }
    } else {
      // Tarayıcı desteklemiyorsa linki kopyala
      navigator.clipboard.writeText(shareData.url);
      toast.fire({ icon: "success", title: "İlan bağlantısı panoya kopyalandı!" });
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
      toast.fire({ icon: "error", title: "Teklif gönderilirken bir hata oluştu." });
    } finally {
      setIsSubmittingOffer(false);
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

  const excludedIntervals =
    item?.booked_dates?.map((range) => ({
      start: parseISO(range.start),
      end: parseISO(range.end),
    })) || [];

  return (
    <div className="w-full relative selection:bg-blue-500/30">
      <div className="p-6 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* SOL KISIM: GÖRSELLER, HARİTA VE YORUMLAR */}
            <div className="lg:col-span-7 space-y-6">
              {/* Görsel Alanı */}
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

              {/* Harita Bölümü */}
              <div className="space-y-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center justify-between cursor-default">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">🗺️ Konum Bilgisi</h2>
                </div>

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

              {/* 🎯 YENİ VE DÜZELTİLMİŞ: Ürün Yorumları Bölümü */}
              <div className="space-y-4 pt-4 border-t border-slate-700/50 mt-6">
                <div className="flex items-center justify-between cursor-default">
                  <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">⭐ Ürün Değerlendirmeleri</h2>
                </div>
                {item.reviews && item.reviews.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin pr-2">
                    {item.reviews.map((review) => {
                      // 🎯 DÜZELTME: İsimleri StoreDetail'deki gibi çekiyoruz
                      const reviewerName = review.reviewer_show_name
                        ? `${review.reviewer_first_name} ${review.reviewer_last_name?.[0]}.`
                        : `@${review.reviewer_username}`;

                      const reviewerInitial = review.reviewer_show_name ? review.reviewer_first_name?.[0] : review.reviewer_username?.[0];

                      return (
                        <div
                          key={review.id}
                          className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] uppercase shadow-inner">
                                {reviewerInitial || "K"}
                              </div>
                              <span className="text-xs font-bold text-slate-200">{reviewerName || "Kullanıcı"}</span>
                            </div>
                            <span className="text-amber-400 text-[10px] tracking-widest">{"⭐".repeat(review.rating)}</span>
                          </div>
                          <p className="text-xs text-slate-300 italic">"{review.comment || "Sadece puanlama yapıldı."}"</p>
                          <span className="text-[9px] text-slate-500 mt-2 block font-mono text-right">
                            {new Date(review.created_at).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-mono text-center py-8 bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
                    Bu ürün için henüz yorum yapılmamış. İlk kiralayan siz olun!
                  </div>
                )}
              </div>
            </div>

            {/* SAĞ KISIM: İLAN BİLGİLERİ VE BUTONLAR */}
            <div className="lg:col-span-5 space-y-6">
              <div className="cyber-card p-6 space-y-5">
                <div className="flex items-center justify-between cursor-default">
                  <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                    ⚡ {item.category_detail?.name || "Kategori"}
                  </span>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-100 cursor-default">{item.title}</h1>

                {/* 🎯 YENİ: Paylaş ve Favori Butonları Yanyana */}
                <div className="flex gap-3">
                  <button
                    onClick={handleFavoriteToggle}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] active:scale-95 ${isFavorite ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20" : "bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white"}`}>
                    <span className={isFavorite ? "animate-pulse" : ""}>{isFavorite ? "❤️" : "🤍"}</span>
                    <span className="text-xs font-bold tracking-wide">{isFavorite ? "Favorilerde" : "Favoriye Ekle"}</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="btn-slate flex-1 flex items-center justify-center gap-2 !py-2.5 hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-blue-400 transition-all cursor-pointer active:scale-95"
                    title="İlanı Paylaş">
                    <span className="text-lg mt-0.5">📤</span>
                    <span className="text-xs font-bold tracking-wide">Paylaş</span>
                  </button>
                </div>

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

              {/* SATICI PROFİLİ */}
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

                      // Eğer takvimden tarih seçildiyse modal'ı o tarihlerle aç
                      if (startDate && endDate) {
                        setOfferDates({
                          start_date: startDate.toISOString().split("T")[0],
                          end_date: endDate.toISOString().split("T")[0],
                        });
                      }
                      setIsOfferModalOpen(true);
                    }}
                    className="btn-gradient cursor-pointer !bg-amber-500 !border-amber-500 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 py-3 shadow-lg shadow-amber-500/20 transition-all">
                    🤝 Teklif Ver
                  </button>
                </div>
              </div>

              {/* 🎯 YENİ: Takvim ve Fiyat Önizlemesi (Direkt ödeme kaldırıldı) */}
              <div className="cyber-card p-6 space-y-4">
                <h2 className="text-xs font-bold tracking-widest text-slate-300 uppercase font-mono cursor-default">📅 Müsaitlik Durumu</h2>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 cursor-default">
                  ℹ️ Tarih seçerek fiyat tahmini alabilir ve seçtiğiniz tarihler için doğrudan satıcıya <strong>Teklif</strong>{" "}
                  gönderebilirsiniz.
                </div>

                <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 shadow-inner">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block cursor-default text-center">
                    Kiralamak İstediğiniz Tarihleri Seçin
                  </label>

                  <DatePicker
                    selectsRange={true}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(update) => setDateRange(update)}
                    excludeDateIntervals={excludedIntervals}
                    minDate={new Date()}
                    inline
                  />
                </div>

                <AnimatePresence>
                  {previewPrice.total > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-xl mt-3 space-y-2 overflow-hidden cursor-default hover:bg-slate-900 transition-colors">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Tahmini Kira Bedeli</span>
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

                      <button
                        onClick={() => {
                          const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
                          if (!token) return toast.fire({ icon: "info", title: "Teklif vermek için giriş yapmalısınız." });
                          if (currentUserId === item.owner)
                            return toast.fire({ icon: "warning", title: "Kendi ilanınıza teklif veremezsiniz." });

                          setOfferDates({
                            start_date: startDate.toISOString().split("T")[0],
                            end_date: endDate.toISOString().split("T")[0],
                          });
                          setIsOfferModalOpen(true);
                        }}
                        className="btn-gradient w-full mt-3 !bg-amber-500 !border-amber-400 py-2.5 flex items-center justify-center cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-amber-500/20">
                        <span className="font-bold text-xs uppercase tracking-wider">Bu Tarihler İçin Teklif Ver 🤝</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* TEKLİF VER MODALI */}
        <AnimatePresence>
          {isOfferModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
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
                        min={new Date().toISOString().split("T")[0]}
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

        {/* 🎯 DÜZELTİLDİ: LIGHTBOX YENİ (SAĞA SOLA KAYDIRMALI) */}
        <AnimatePresence>
          {isLightboxOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setIsLightboxOpen(false)}>
              {/* Kapat Butonu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLightboxOpen(false);
                }}
                className="absolute top-6 right-6 btn-slate !font-mono tracking-widest cursor-pointer hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 active:scale-90 transition-all z-20">
                KAPAT [ESC]
              </button>

              {/* Sol Ok */}
              {item.images?.length > 1 && (
                <button
                  onClick={prevImage}
                  className="absolute left-4 sm:left-12 z-20 bg-slate-800/50 text-white p-4 sm:p-5 rounded-full hover:bg-blue-500/50 transition-colors cursor-pointer active:scale-90 border border-slate-600/50">
                  <span className="text-xl">◀</span>
                </button>
              )}

              {/* Sağ Ok */}
              {item.images?.length > 1 && (
                <button
                  onClick={nextImage}
                  className="absolute right-4 sm:right-12 z-20 bg-slate-800/50 text-white p-4 sm:p-5 rounded-full hover:bg-blue-500/50 transition-colors cursor-pointer active:scale-90 border border-slate-600/50">
                  <span className="text-xl">▶</span>
                </button>
              )}

              {/* Ortadaki Resim */}
              <motion.img
                key={currentImgIndex}
                initial={{ opacity: 0.5, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                src={activeImage}
                alt="fullscreen"
                className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-slate-800 cursor-default relative z-10"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Resim İndikatörü */}
              {item.images?.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-700/50 text-slate-300 font-mono text-xs z-20 cursor-default">
                  {currentImgIndex + 1} / {item.images.length}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ItemDetail;
