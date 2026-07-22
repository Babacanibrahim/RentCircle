import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";
import { itemApi } from "../services/itemApi";
import formattedTurkeyData from "../../auth/data/parseData";
import { toast, cyberConfirm } from "../../../utils/alerts";

// Leaflet varsayılan ikon hatasını çözen ayar
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

// 🎯 YENİ: Haritaya Tıklayınca Açık Adresi Dolduran Sistem
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
          // Dropdownların bozulmaması için exact match arıyoruz
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

        toast.fire({ icon: "success", title: "Adres haritadan otomatik çekildi." });
        setMapCenter([lat, lng]);
      } catch (error) {
        console.error("Adres bilgisi alınamadı:", error);
        toast.fire({ icon: "error", title: "Bölge detayları çözümlenemedi." });
      }
    },
  });
  return null;
};

const CreateListing = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mapCenter, setMapCenter] = useState([37.7765, 29.0864]);
  const [mapZoom, setMapZoom] = useState(11);
  const [mapPosition, setMapPosition] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price_per_day: "",
    category: "",
    city: "",
    district: "",
    region: "",
    full_address: "", // 🎯 YENİ: Cadde/Sokak/Bina No alanı
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    itemApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCityChange = async (e) => {
    const city = e.target.value;
    setFormData({ ...formData, city: city, district: "", region: "", full_address: "", latitude: "", longitude: "" });
    setMapPosition(null);
    if (!city) return;

    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${city}+Turkey&limit=1`);
      if (res.data.length > 0) {
        setMapCenter([parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)]);
        setMapZoom(11);
      }
    } catch (err) {}
  };

  const handleDistrictChange = async (e) => {
    const district = e.target.value;
    setFormData({ ...formData, district: district, region: "", full_address: "", latitude: "", longitude: "" });
    setMapPosition(null);
    if (!district) return;

    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${district}+${formData.city}+Turkey&limit=1`);
      if (res.data.length > 0) {
        setMapCenter([parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)]);
        setMapZoom(13);
      }
    } catch (err) {}
  };

  // 🎯 YENİ: Elle Girilen Adresi Haritada Bulma
  const handleFindAddressOnMap = async () => {
    if (!formData.city || !formData.district) {
      return toast.fire({ icon: "warning", title: "Lütfen haritada aramak için en az Şehir ve İlçe seçin." });
    }

    try {
      const query = `${formData.full_address} ${formData.region} ${formData.district} ${formData.city} Turkey`;
      const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);

      if (res.data.length > 0) {
        const lat = parseFloat(res.data[0].lat);
        const lon = parseFloat(res.data[0].lon);
        setMapCenter([lat, lon]);
        setMapZoom(16);
        setMapPosition([lat, lon]);
        setFormData((prev) => ({ ...prev, latitude: lat.toFixed(6), longitude: lon.toFixed(6) }));
        toast.fire({ icon: "success", title: "Girdiğiniz adres haritada işaretlendi!" });
      } else {
        toast.fire({ icon: "error", title: "Yazılan adres tam olarak bulunamadı. Lütfen haritadan manuel işaretleyin." });
      }
    } catch (error) {
      toast.fire({ icon: "error", title: "Harita araması başarısız oldu." });
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImages((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveImage = async (e, indexToRemove) => {
    e.stopPropagation();
    const result = await cyberConfirm.fire({
      title: "Görseli Sil",
      text: "Bu görseli silmek istediğinize emin misiniz?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Evet, Sil",
      cancelButtonText: "Vazgeç",
    });

    if (result.isConfirmed) {
      setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
      setImagePreviews((prev) => prev.filter((_, idx) => idx !== indexToRemove));

      if (mainImageIndex === indexToRemove) setMainImageIndex(0);
      else if (mainImageIndex > indexToRemove) setMainImageIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.latitude || !formData.longitude) {
      return toast.fire({ icon: "warning", title: "Lütfen adresi haritada işaretleyin veya 'Haritada Bul' butonunu kullanın." });
    }
    if (images.length === 0) return toast.fire({ icon: "warning", title: "Lütfen en az bir adet ürün görseli yükleyin." });

    setIsSubmitting(true);
    const submitData = new FormData();

    const finalData = {
      ...formData,
      is_available: "true",
    };

    Object.keys(finalData).forEach((key) => {
      submitData.append(key, finalData[key]);
    });

    images.forEach((img) => submitData.append("images", img));
    submitData.append("main_image_index", mainImageIndex);

    try {
      await itemApi.createListing(submitData);
      toast.fire({ icon: "success", title: "İlanınız başarıyla yayına alındı! 🎉" });
      navigate("/dashboard");
    } catch (err) {
      toast.fire({ icon: "error", title: "İlan oluşturulamadı." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full relative selection:bg-blue-500/30 bg-[#1e293b]">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10">
        <div className="border-b border-slate-700/50 pb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-100">Yeni İlan Ekle</h1>
          <p className="text-xs text-slate-400 mt-1">RentCircle standartlarında güvenli pazar yeri ilanı oluşturun.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* SOL PANEL: FORM VERİLERİ */}
          <div className="lg:col-span-5 space-y-5">
            <div className="cyber-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-700/50 pb-2">İlan Bilgileri</h2>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">İlan Başlığı</label>
                <input
                  required
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="cyber-input hover:border-blue-500/50 transition-colors"
                  placeholder="Örn: Profesyonel Oyuncu Koltuğu"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Açıklama</label>
                <textarea
                  required
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="cyber-input h-24 resize-none hover:border-blue-500/50 transition-colors"
                  placeholder="Ürünün kozmetik ve teknik durumu..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Günlük Fiyat</label>
                  <input
                    required
                    type="number"
                    min="1"
                    name="price_per_day"
                    value={formData.price_per_day}
                    onChange={handleChange}
                    className="cyber-input hover:border-blue-500/50 transition-colors"
                    placeholder="₺0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Kategori</label>
                  <select
                    required
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="cyber-input cursor-pointer hover:border-blue-500/50 transition-colors">
                    <option value="">Kategori Seçin</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Gelişmiş Adres Alanı */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Şehir</label>
                    <select
                      required
                      name="city"
                      value={formData.city}
                      onChange={handleCityChange}
                      className="cyber-input cursor-pointer hover:border-blue-500/50 transition-colors">
                      <option value="">Şehir Seçin</option>
                      {Object.keys(formattedTurkeyData).map((city, i) => (
                        <option key={i} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">İlçe</label>
                    <select
                      required
                      name="district"
                      value={formData.district}
                      onChange={handleDistrictChange}
                      disabled={!formData.city}
                      className="cyber-input cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-500/50 transition-colors">
                      <option value="">İlçe Seçin</option>
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
                  <label className="text-[10px] font-bold uppercase text-slate-400">Mahalle / Semt</label>
                  <input
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="cyber-input hover:border-blue-500/50 transition-colors"
                    placeholder="Örn: Kınıklı Mahallesi"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Cadde / Sokak / Bina No</label>
                  <input
                    type="text"
                    name="full_address"
                    value={formData.full_address}
                    onChange={handleChange}
                    className="cyber-input hover:border-blue-500/50 transition-colors"
                    placeholder="Örn: 6010. Sk. No: 12"
                  />
                </div>
              </div>
            </div>

            <div className="cyber-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-200 border-b border-slate-700/50 pb-2">Ürün Görselleri</h2>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageChange}
                className="text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-500/10 file:text-blue-400 file:cursor-pointer hover:file:bg-blue-500/20"
              />

              {imagePreviews.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-4 pt-2 scrollbar-thin">
                  {imagePreviews.map((src, idx) => (
                    <div
                      key={idx}
                      onClick={() => setMainImageIndex(idx)}
                      className={`relative w-20 h-20 flex-shrink-0 cursor-pointer rounded-xl overflow-hidden border-2 transition-all group ${mainImageIndex === idx ? "border-emerald-500 scale-105 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border-slate-700 hover:border-blue-400"}`}>
                      <img src={src} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => handleRemoveImage(e, idx)}
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        ✕
                      </button>
                      {mainImageIndex === idx && (
                        <div className="absolute bottom-0 left-0 right-0 bg-emerald-500 text-slate-950 text-[9px] font-black text-center py-0.5 uppercase tracking-widest">
                          Kapak
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SAĞ PANEL: HARİTA ODAKLAMA VE SEÇİM ALANI */}
          <div className="cyber-card flex-1 lg:col-span-7 flex flex-col h-[650px] overflow-hidden">
            <div className="p-4 border-b border-[#475569]/40 bg-[#0f172a]/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-100">🗺️ İlan Konumunu Sabitle</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Haritaya tıklayarak adresi çekebilir veya yazdığınız adresi haritada bulabilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={handleFindAddressOnMap}
                className="btn-slate text-xs bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer active:scale-95 py-2 px-3">
                📍 Adresi Haritada Bul
              </button>
            </div>

            <div className="flex-1 w-full h-full relative z-10">
              <RouterHackFix />
              <MapContainer center={mapCenter} zoom={mapZoom} className="w-full h-full" style={{ background: "#1e293b" }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <ChangeMapCenter center={mapCenter} zoom={mapZoom} />
                <MapClickHandler setMapPosition={setMapPosition} setFormData={setFormData} setMapCenter={setMapCenter} />
                {mapPosition && <Marker position={mapPosition} />}
              </MapContainer>
            </div>

            <div className="p-4 border-t border-[#475569]/40 bg-[#0f172a]/20">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-gradient w-full py-3.5 text-xs font-bold uppercase tracking-wider cursor-pointer hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-50">
                {isSubmitting ? "⏳ İlan Oluşturuluyor..." : "🚀 İlanı Canlıya Al"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const RouterHackFix = () => {
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, []);
  return null;
};

export default CreateListing;
