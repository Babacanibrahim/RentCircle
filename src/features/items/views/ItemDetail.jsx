import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { itemApi } from "../services/itemApi"; // Kendi yoluna göre ayarla
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Leaflet ikon fix'i
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
  const [statusInfo, setStatusInfo] = useState({ type: "", message: "" });

  const [previewPrice, setPreviewPrice] = useState({ base: 0, deposit: 0, total: 0 });
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await itemApi.getListingDetail(id);
        setItem(data);
        setIsFavorite(data.is_favorite || false);
        const mainImgIndex = data.images?.findIndex((img) => img.is_main);
        setCurrentImgIndex(mainImgIndex !== -1 ? mainImgIndex : 0);
      } catch (error) {
        setStatusInfo({ type: "error", message: "Ürün bulunamadı." });
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
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleFavoriteToggle = async () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) {
      setStatusInfo({ type: "error", message: "Favoriye eklemek için giriş yapmalısınız." });
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
    if (!token) {
      setStatusInfo({ type: "error", message: "Satıcıya mesaj atmak için giriş yapmalısınız." });
      return;
    }
    if (currentUserId === item.owner) {
      setStatusInfo({ type: "error", message: "Kendi ilanınıza mesaj gönderemezsiniz." });
      return;
    }

    try {
      await itemApi.startConversation(item.id, currentUserId, item.owner);
      navigate("/chat");
    } catch (err) {
      console.error("Sohbet oluşturma hatası:", err);
      navigate("/chat");
    }
  };

  // 🎯 YENİ: CÜZDAN İLE KİRALA VE ÖDE FONKSİYONU
  const handleRentAndPay = async (e) => {
    e.preventDefault();
    setStatusInfo({ type: "", message: "" });
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

    if (!token) {
      setStatusInfo({ type: "error", message: "Rezervasyon yapabilmek için lütfen önce giriş yapın." });
      return;
    }

    if (!bookingDates.start_date || !bookingDates.end_date) {
      setStatusInfo({ type: "error", message: "Lütfen kiralama tarihlerini seçin." });
      return;
    }

    setStatusInfo({ type: "success", message: "💳 Cüzdan bakiyenizden ödeme alınıyor, lütfen bekleyin..." });

    const bookingData = {
      start_date: bookingDates.start_date,
      end_date: bookingDates.end_date,
      total_price: previewPrice.total,
    };

    try {
      const result = await itemApi.payWithWallet(item.id, bookingData);

      // Başarılı olduğunda
      alert("✅ " + result.message);
      navigate("/bookings");
    } catch (err) {
      const errMsg = err.response?.data?.error || "Ödeme sırasında bir hata oluştu.";
      setStatusInfo({ type: "error", message: errMsg });

      // Yetersiz bakiye hatası geldiyse kullanıcıya sor
      if (errMsg.toLowerCase().includes("yetersiz")) {
        const goToWallet = window.confirm("Cüzdan bakiyeniz yetersiz. Bakiye yüklemek için Cüzdanım sayfasına gitmek ister misiniz?");
        if (goToWallet) {
          navigate("/wallet");
        }
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

  if (!item) return <div className="w-full relative text-center pt-20">Ürün bulunamadı.</div>;

  const activeImage = item.images?.[currentImgIndex]?.image || "";

  const today = new Date();
  const todayStr =
    today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

  const isOverdue = !item.is_available && item.next_available_date && item.next_available_date <= todayStr;
  const minStartDate =
    !item.is_available && item.next_available_date && item.next_available_date > todayStr ? item.next_available_date : todayStr;

  return (
    <div className="w-full relative selection:bg-blue-500/30">
      <div className="p-6 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          <AnimatePresence>
            {statusInfo.message && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`p-4 rounded-xl text-sm font-bold border flex justify-between items-center ${
                  statusInfo.type === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                }`}>
                {statusInfo.message}
                <button
                  onClick={() => setStatusInfo({ type: "", message: "" })}
                  className="text-xl leading-none opacity-70 hover:opacity-100">
                  &times;
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-4">
                <div className="cyber-card relative h-[480px] w-full flex items-center justify-center group overflow-hidden">
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
                            className="absolute left-4 z-20 btn-slate p-3 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer">
                            ◀
                          </button>
                          <button
                            onClick={nextImage}
                            className="absolute right-4 z-20 btn-slate p-3 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer">
                            ▶
                          </button>
                        </>
                      )}
                      <div className="absolute top-4 right-4 z-20 bg-slate-950/80 border border-slate-700/50 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider text-slate-400 pointer-events-none">
                        🔍 BÜYÜT
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-500 text-sm font-mono">GÖRSEL YÜKLENMEMİŞ</span>
                  )}
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {item.images?.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentImgIndex(idx)}
                      className={`cyber-card cursor-pointer relative w-20 h-20 overflow-hidden flex-shrink-0 !rounded-xl ${currentImgIndex === idx ? "border-blue-500 ring-1 ring-blue-500/50" : "hover:border-slate-500"}`}>
                      <img src={img.image} alt="thumbnail" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-700/50">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">🗺️ Konum Bilgisi</h2>
                <div className="cyber-card overflow-hidden h-[300px] border border-slate-700/50 relative z-0">
                  {item.latitude && item.longitude ? (
                    <MapContainer
                      center={[parseFloat(item.latitude), parseFloat(item.longitude)]}
                      zoom={15}
                      scrollWheelZoom={false}
                      className="w-full h-full rounded-xl">
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      />
                      <Marker position={[parseFloat(item.latitude), parseFloat(item.longitude)]}>
                        <Popup>
                          <div className="text-center font-bold font-mono">
                            {item.title} <br /> {item.district}, {item.city}
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                      Bu ilan için detaylı konum belirtilmemiş.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="cyber-card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                    ⚡ {item.category_detail?.name || "Kategori"}
                  </span>
                  <span
                    className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-lg border ${item.is_available ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"}`}>
                    {item.is_available ? "● AKTİF İLAN" : "● ŞU AN KİRADA"}
                  </span>
                </div>

                <h1 className="text-2xl font-black tracking-tight text-slate-100">{item.title}</h1>

                <button
                  onClick={handleFavoriteToggle}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer w-fit ${isFavorite ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20" : "bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white"}`}>
                  <span className={isFavorite ? "animate-pulse" : ""}>{isFavorite ? "❤️" : "🤍"}</span>
                  <span className="text-xs font-bold tracking-wide">{isFavorite ? "Favorilerde Ekli" : "Favorilere Ekle"}</span>
                </button>

                <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-4 border border-slate-700/50 rounded-2xl">
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
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold font-mono">Ürün Açıklaması</span>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-4 border border-slate-700/50 rounded-2xl h-28 overflow-y-auto scrollbar-thin">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-700/50 rounded-2xl">
                  <span className="text-xs text-slate-400 font-medium">Günlük Kiralama Bedeli</span>
                  <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                    ₺{parseFloat(item.price_per_day).toLocaleString("tr-TR")}
                  </span>
                </div>
              </div>

              <div className="cyber-card p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-lg uppercase">
                    {item.owner_show_name ? item.owner_first_name?.[0] : item.owner_username?.[0] || "S"}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Satıcı Profili</span>
                    <h3
                      onClick={() => navigate(`/stores/${item.owner}`)}
                      className="text-sm font-black text-slate-100 hover:text-blue-400 cursor-pointer transition">
                      {item.owner_show_name ? `${item.owner_first_name} ${item.owner_last_name}` : `@${item.owner_username || "Kullanici"}`}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold mt-0.5">
                      ⭐ {item.owner_rating > 0 ? item.owner_rating : "Yeni"}
                      <span className="text-slate-500 font-normal text-[10px]">({item.owner_review_count || 0} Değerlendirme)</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleStartChat}
                  className="btn-slate cursor-pointer hover:bg-blue-600 hover:text-white hover:border-blue-500">
                  💬 Mesaj At
                </button>
              </div>

              {/* 🎯 KİRALAMA VE CÜZDAN ÖDEME MODÜLÜ */}
              <div className="cyber-card p-6 space-y-4">
                <h2 className="text-xs font-bold tracking-widest text-slate-300 uppercase font-mono">📅 Kiralama Talebi</h2>

                {!item.is_available && (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center bg-[#0f172a]/40 p-3 rounded-xl border border-slate-700/50">
                      <span className="text-xs font-bold text-slate-400">Ürün Durumu: Kirada. En Erken:</span>
                      <span className="text-xs font-mono font-black text-blue-400">
                        {formatNextAvailableDate(item.next_available_date)}
                      </span>
                    </div>

                    {isOverdue && (
                      <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-400 text-[11px] leading-relaxed">
                        ℹ️ <strong>Sistem Notu:</strong> Bu ürünün iade işlemlerinde anlık bir gecikme yaşanmaktadır. İleri tarihli kiralama
                        talebinizi güvenle oluşturabilirsiniz; çakışma durumunda güvence protokolü devreye girecektir.
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300">
                  ℹ️ Kiralama süresince ürününüzü korumak adına <strong>%15 depozito (güvence bedeli)</strong> alınmaktadır. Ürün sağlam
                  iade edildiğinde bu tutar iade edilir.
                </div>

                <form onSubmit={handleRentAndPay} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Başlangıç</label>
                      <input
                        type="date"
                        required
                        min={minStartDate}
                        value={bookingDates.start_date}
                        onChange={(e) => setBookingDates({ ...bookingDates, start_date: e.target.value, end_date: "" })}
                        className="cyber-input cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Bitiş</label>
                      <input
                        type="date"
                        required
                        disabled={!bookingDates.start_date}
                        min={bookingDates.start_date}
                        value={bookingDates.end_date}
                        onChange={(e) => setBookingDates({ ...bookingDates, end_date: e.target.value })}
                        className="cyber-input cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {previewPrice.total > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-900/80 border border-slate-700/50 p-4 rounded-xl mt-3 space-y-2 overflow-hidden">
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

                  {/* 🎯 BUTON DEĞİŞTİ */}
                  <button type="submit" className="btn-gradient w-full p-3.5 flex flex-col items-center justify-center">
                    <span className="font-bold">Cüzdan ile Kirala ve Öde</span>
                    {previewPrice.total > 0 && (
                      <span className="text-[10px] opacity-80">(₺{previewPrice.total.toLocaleString("tr-TR")} Tahsil Edilecek)</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700/50 pt-8 mt-8">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-6">
              💬 Değerlendirmeler
              <span className="text-xs font-mono text-slate-400 font-normal">({item.reviews?.length || 0} Yorum)</span>
            </h2>

            {item.reviews && item.reviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {item.reviews.map((review) => {
                  const reviewerName = review.reviewer_show_name
                    ? `${review.reviewer_first_name} ${review.reviewer_last_name?.[0]}.`
                    : `@${review.reviewer_username}`;

                  const reviewerInitial = review.reviewer_show_name ? review.reviewer_first_name?.[0] : review.reviewer_username?.[0];

                  return (
                    <div key={review.id} className="cyber-card p-5 space-y-3 !bg-slate-800/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300 uppercase shadow-inner border border-slate-600/50">
                            {reviewerInitial || "K"}
                          </div>
                          <span className="text-xs font-bold text-slate-200 tracking-wider">{reviewerName || "Kullanici"}</span>
                        </div>
                        <span className="text-[10px] tracking-widest">{"⭐".repeat(review.rating)}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-slate-700 pl-3">
                        "{review.comment || "Sadece puanlama yapıldı."}"
                      </p>
                      <div className="text-[9px] text-slate-500 text-right pr-2">
                        {new Date(review.created_at).toLocaleDateString("tr-TR")}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full flex flex-col items-center justify-center text-slate-500 py-12 border border-dashed border-slate-700/50 rounded-2xl bg-slate-900/30">
                <span className="text-3xl mb-3">⭐</span>
                <span className="text-sm font-mono tracking-wider">Bu ürüne henüz yorum yapılmamış.</span>
              </div>
            )}
          </div>
        </div>

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
                className="absolute top-6 right-6 btn-slate !font-mono tracking-widest cursor-pointer hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50">
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
