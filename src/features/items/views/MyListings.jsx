import React, { useEffect, useState } from "react";
import { itemApi } from "../services/itemApi";
import { motion, AnimatePresence } from "framer-motion";
import { toast, cyberConfirm } from "../../../utils/alerts";
import { useNavigate, Link } from "react-router-dom"; // 🎯 Link import edildi
import formattedTurkeyData from "../../auth/data/parseData";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import axios from "axios";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ChangeMapCenter = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const MapClickHandler = ({ setMapPosition, setFormData, setMapCenter }) => {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setMapPosition([lat, lng]);

      try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
        const addr = response.data.address;

        let detectedCity = (addr.province || addr.city || addr.state || "").replace(" İli", "").trim();
        let detectedDistrict = (addr.district || addr.borough || addr.town || "").replace(" ilçe", "").trim();
        let detectedRegion = (addr.neighbourhood || addr.quarter || addr.residential || addr.suburb || "").trim();
        let detectedStreet = (addr.road || addr.pedestrian || addr.path || "").trim();
        let houseNumber = addr.house_number ? ` No: ${addr.house_number}` : "";
        let fullAddr = `${detectedStreet}${houseNumber}`.trim();

        setFormData((prev) => {
          const exactCityKey =
            Object.keys(formattedTurkeyData).find((c) => c.toLocaleLowerCase("tr-TR") === detectedCity.toLocaleLowerCase("tr-TR")) ||
            prev.city;

          let exactDistrict = prev.district;
          if (exactCityKey && formattedTurkeyData[exactCityKey]) {
            const matchD = formattedTurkeyData[exactCityKey].districts.find(
              (d) => d.toLocaleLowerCase("tr-TR") === detectedDistrict.toLocaleLowerCase("tr-TR"),
            );
            if (matchD) exactDistrict = matchD;
          }

          return {
            ...prev,
            city: exactCityKey,
            district: exactDistrict,
            region: detectedRegion,
            full_address: fullAddr,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
          };
        });
        setMapCenter([lat, lng]);
      } catch (error) {
        console.error("Adres alınamadı", error);
      }
    },
  });
  return null;
};

const RouterHackFix = () => {
  useEffect(() => {
    setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
  }, []);
  return null;
};

const MyListings = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  // Düzenleme Dev Modal State'leri
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mapCenter, setMapCenter] = useState([37.7765, 29.0864]);
  const [mapPosition, setMapPosition] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price_per_day: "",
    category: "",
    city: "",
    district: "",
    region: "",
    full_address: "",
    latitude: "",
    longitude: "",
  });

  const fetchMyListings = async () => {
    try {
      const data = await itemApi.getMyListings();
      setListings(data.results || data);
    } catch (error) {
      toast.fire({ icon: "error", title: "İlanlarınız yüklenirken bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyListings();
    itemApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  const handleToggleStatus = async (e, item) => {
    e.preventDefault(); // 🎯 YENİ: Link tıklamasını engeller
    e.stopPropagation();

    const newStatus = !item.is_available;
    const actionText = newStatus ? "Aktifleştirmek" : "Pasife Almak (Gizlemek)";

    const result = await cyberConfirm.fire({
      title: "Emin misiniz?",
      text: `Bu ilanı ${actionText} istediğinize emin misiniz?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Evet, Değiştir",
      cancelButtonText: "İptal",
    });

    if (!result.isConfirmed) return;

    try {
      await itemApi.updateListing(item.id, { is_available: newStatus });
      toast.fire({ icon: "success", title: "İlan durumu başarıyla güncellendi." });
      fetchMyListings();
    } catch (error) {
      toast.fire({ icon: "error", title: "Durum güncellenirken hata oluştu." });
    }
  };

  // Düzenleme Modalını Tüm Verilerle Aç
  const openEditModal = (e, item) => {
    e.preventDefault(); // 🎯 YENİ: Link tıklamasını engeller
    e.stopPropagation();

    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description,
      price_per_day: item.price_per_day,
      category: item.category,
      city: item.city || "",
      district: item.district || "",
      region: item.region || "",
      full_address: item.full_address || "",
      latitude: item.latitude || "",
      longitude: item.longitude || "",
    });

    if (item.latitude && item.longitude) {
      setMapCenter([parseFloat(item.latitude), parseFloat(item.longitude)]);
      setMapPosition([parseFloat(item.latitude), parseFloat(item.longitude)]);
    }

    setIsEditModalOpen(true);
  };

  const handleCityChange = async (e) => {
    const city = e.target.value;
    setFormData({ ...formData, city: city, district: "", region: "", full_address: "", latitude: "", longitude: "" });
    setMapPosition(null);
    if (!city) return;
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${city}+Turkey&limit=1`);
      if (res.data.length > 0) setMapCenter([parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)]);
    } catch (err) {}
  };

  const handleDistrictChange = async (e) => {
    const district = e.target.value;
    setFormData({ ...formData, district: district, region: "", full_address: "", latitude: "", longitude: "" });
    setMapPosition(null);
    if (!district) return;
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${district}+${formData.city}+Turkey&limit=1`);
      if (res.data.length > 0) setMapCenter([parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)]);
    } catch (err) {}
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await itemApi.updateListing(editingItem.id, formData);
      toast.fire({ icon: "success", title: "İlan başarıyla güncellendi!" });
      setIsEditModalOpen(false);
      fetchMyListings();
    } catch (error) {
      toast.fire({ icon: "error", title: "Güncelleme başarısız oldu." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="w-full pt-20 text-center text-slate-500 font-mono animate-pulse">İLANLARINIZ YÜKLENİYOR...</div>;

  return (
    <div className="w-full min-h-screen selection:bg-blue-500/30 bg-[#1e293b] pb-20">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/50 pb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">📦 İlan Yönetim Paneli</h1>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Tüm ilanlarınızı tek bir merkezden yönetin ve istatistikleri takip edin.
            </p>
          </div>
          {/* 🎯 DÜZELTİLDİ: Yeni İlan Ekle butonu Link oldu */}
          <Link
            to="/create-listing"
            className="btn-gradient !px-6 !py-2.5 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
            <span>+</span> Yeni İlan Ekle
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.length === 0 ? (
            <div className="col-span-full cyber-card p-12 text-center border-dashed flex flex-col items-center">
              <span className="text-4xl mb-4 opacity-50">🕸️</span>
              <h3 className="text-lg font-bold text-slate-300">Henüz Bir İlanınız Yok</h3>
              <p className="text-sm text-slate-500 mt-2">Kullanmadığınız eşyaları kiralayarak hemen kazanmaya başlayın.</p>
            </div>
          ) : (
            listings.map((item) => {
              const mainImage =
                item.images?.find((img) => img.is_main)?.image || item.images?.[0]?.image || "https://via.placeholder.com/400";

              const isHidden = !item.is_available;

              // 🎯 DÜZELTİLDİ: İlan Eğer Aktifse Link (tıklanabilir kutu) olur, değilse div (tıklanamaz kutu) olur
              const CardWrapper = isHidden ? motion.div : Link;
              const wrapperProps = isHidden ? {} : { to: `/listings/${item.id}`, className: "block" };

              return (
                <CardWrapper
                  {...wrapperProps}
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`cyber-card flex flex-col overflow-hidden transition-all group ${isHidden ? "opacity-75 border-dashed" : "border-slate-600/50 hover:border-blue-500/30 hover:shadow-blue-500/10 cursor-pointer"}`}>
                  {/* Kart Üst (Resim ve Rozetler) */}
                  <div className="h-48 w-full relative overflow-hidden bg-slate-900">
                    <img
                      src={mainImage}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      {/* DURUM ROZETİ */}
                      {isHidden ? (
                        <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border backdrop-blur-md shadow-lg bg-rose-500/20 text-rose-400 border-rose-500/30">
                          Pasif / Gizli
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border backdrop-blur-md shadow-lg bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Aktif İlan
                        </span>
                      )}

                      {/* KİRADA ROZETİ (Tamamen Bağımsız) */}
                      {item.is_currently_rented && (
                        <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded border bg-amber-500/20 text-amber-400 border-amber-500/30 backdrop-blur-md shadow-lg">
                          Şu An Kirada
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Kart Orta (Bilgiler ve İstatistikler) */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3
                        className="font-bold text-slate-100 text-lg truncate pr-2 group-hover:text-blue-400 transition-colors"
                        title={item.title}>
                        {item.title}
                      </h3>
                      <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 whitespace-nowrap">
                        ₺{item.price_per_day}
                      </span>
                    </div>

                    <div className="flex gap-4 mt-auto pt-4 border-t border-slate-700/50">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400" title="Görüntülenme Sayısı">
                        <span className="text-blue-400">👁️</span>
                        <span className="font-bold">{item.views_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400" title="Favoriye Eklenme">
                        <span className="text-rose-400">❤️</span>
                        <span className="font-bold">{item.favorites_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                        <span className="text-emerald-400">⭐</span>
                        <span className="font-bold">{item.reviews?.length || 0} Yorum</span>
                      </div>
                    </div>
                  </div>

                  {/* Aksiyon Butonları (Tıklanmayı Durdurur) */}
                  <div className="grid grid-cols-2 gap-px bg-slate-700/50 border-t border-slate-700/50 relative z-10">
                    <button
                      onClick={(e) => openEditModal(e, item)}
                      className="py-3 text-[11px] font-bold text-blue-400 hover:bg-slate-800 transition-colors uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer">
                      ✏️ Düzenle
                    </button>
                    <button
                      onClick={(e) => handleToggleStatus(e, item)}
                      className={`py-3 text-[11px] font-bold hover:bg-slate-800 transition-colors uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${item.is_available ? "text-amber-400" : "text-emerald-400"}`}>
                      {item.is_available ? "⏸️ Pasife Al" : "▶️ Aktifleştir"}
                    </button>
                  </div>
                </CardWrapper>
              );
            })
          )}
        </div>
      </div>

      {/* 🎯 DEV DÜZENLEME MODALI */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="cyber-card w-full max-w-5xl bg-[#1e293b] border border-blue-500/30 shadow-2xl shadow-blue-500/10 flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-[#0f172a]/40 shrink-0">
                <h3 className="text-xl font-black text-slate-100 flex items-center gap-2">✏️ İlan Detaylarını Güncelle</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500 transition-colors cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <form id="editForm" onSubmit={handleSaveChanges} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Sol Kolon: Metinler */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">İlan Başlığı</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="cyber-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Açıklama</label>
                      <textarea
                        required
                        rows={5}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="cyber-input resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-slate-400">Günlük Fiyat (₺)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={formData.price_per_day}
                          onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                          className="cyber-input text-blue-400 font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Kategori</label>
                        <select
                          required
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="cyber-input cursor-pointer">
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Adres Bölümü */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Şehir</label>
                        <select required value={formData.city} onChange={handleCityChange} className="cyber-input cursor-pointer">
                          <option value="">Seçiniz</option>
                          {Object.keys(formattedTurkeyData).map((city, i) => (
                            <option key={i} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">İlçe</label>
                        <select
                          required
                          value={formData.district}
                          onChange={handleDistrictChange}
                          disabled={!formData.city}
                          className="cyber-input cursor-pointer">
                          <option value="">Seçiniz</option>
                          {formData.city &&
                            formattedTurkeyData[formData.city]?.districts.map((dist, i) => (
                              <option key={i} value={dist}>
                                {dist}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Mahalle / Sokak</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="cyber-input"
                      />
                    </div>
                  </div>

                  {/* Sağ Kolon: Harita */}
                  <div className="h-full min-h-[300px] flex flex-col cyber-card overflow-hidden border-slate-700/50">
                    <div className="p-3 bg-slate-900/50 border-b border-slate-700/50 flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-slate-300">🗺️ İlan Konumu</span>
                      <span className="text-[9px] text-slate-500">Haritaya tıklayarak güncelleyebilirsiniz</span>
                    </div>
                    <div className="flex-1 relative z-0">
                      <RouterHackFix />
                      <MapContainer center={mapCenter} zoom={14} className="w-full h-full">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <ChangeMapCenter center={mapCenter} zoom={14} />
                        <MapClickHandler setMapPosition={setMapPosition} setFormData={setFormData} setMapCenter={setMapCenter} />
                        {mapPosition && <Marker position={mapPosition} />}
                      </MapContainer>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-5 border-t border-slate-700/50 bg-[#0f172a]/40 shrink-0 flex gap-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-slate flex-1 cursor-pointer">
                  İptal Et
                </button>
                <button
                  form="editForm"
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gradient flex-1 cursor-pointer shadow-lg shadow-blue-500/20">
                  {isSubmitting ? "Güncelleniyor..." : "💾 Değişiklikleri Kaydet"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyListings;
