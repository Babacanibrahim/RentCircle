import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import formattedTurkeyData from "../auth/data/parseData";
import { itemApi } from "../items/services/itemApi";

const Navbar = ({ onLocationFilter }) => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const [location, setLocation] = useState({ city: "", district: "" });
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let notifInterval;
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

    if (token) {
      setIsLoggedIn(true);
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(window.atob(base64));
        setCurrentUserId(payload.user_id);

        axios
          .get("http://localhost:8000/api/auth/me/", {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((response) => {
            const { city, district } = response.data;
            if (city) {
              const exactCityKey =
                Object.keys(formattedTurkeyData).find((c) => c.toLocaleLowerCase("tr-TR") === city.toLocaleLowerCase("tr-TR")) || city;
              let exactDistrict = district || "";
              if (exactCityKey && formattedTurkeyData[exactCityKey] && district) {
                const matchedDist = formattedTurkeyData[exactCityKey].districts.find(
                  (d) => d.toLocaleLowerCase("tr-TR") === district.toLocaleLowerCase("tr-TR"),
                );
                if (matchedDist) exactDistrict = matchedDist;
              }
              const userLocation = { city: exactCityKey, district: exactDistrict };
              setLocation(userLocation);
              setSelectedCity(exactCityKey);
              setSelectedDistrict(exactDistrict);
              if (onLocationFilter) onLocationFilter(userLocation);
            } else {
              if (onLocationFilter) onLocationFilter({ city: "", district: "" });
            }
          })
          .catch((err) => {
            console.error("Profil bilgisi çekilemedi", err);
            if (onLocationFilter) onLocationFilter({ city: "", district: "" });
          });

        // 🎯 ÇÖZÜM: BİLDİRİMLER İÇİN SESSİZ YOKLAMA (POLLING)
        const fetchNotifs = () => {
          itemApi
            .getNotifications()
            .then((data) => setNotifications(data))
            .catch((err) => console.error("Bildirimler çekilemedi:", err));
        };

        fetchNotifs(); // İlk yüklemede çek
        notifInterval = setInterval(fetchNotifs, 10000); // 10 saniyede bir güncelle
      } catch (e) {
        console.error("Token çözümlenemedi:", e);
        if (onLocationFilter) onLocationFilter({ city: "", district: "" });
      }
    } else {
      if (onLocationFilter) onLocationFilter({ city: "", district: "" });
    }

    // Component kapandığında interval'i temizle
    return () => {
      if (notifInterval) clearInterval(notifInterval);
    };
  }, []); // onLocationFilter'ı bağımlılıklara eklemedik çünkü sürekli tetiklenmesini istemiyoruz.

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleBellClick = async () => {
    setIsNotificationMenuOpen(!isNotificationMenuOpen);
    if (!isNotificationMenuOpen && unreadCount > 0) {
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      try {
        await itemApi.markNotificationsRead();
      } catch (err) {
        console.error("Bildirimler okundu olarak işaretlenemedi:", err);
      }
    }
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Bu bildirimi silmek istediğinizden emin misiniz?")) {
      try {
        await itemApi.deleteNotification(id);
        setNotifications(notifications.filter((n) => n.id !== id));
      } catch (err) {
        console.error("Bildirim silinemedi:", err);
      }
    }
  };

  const handleNotificationClick = (notif) => {
    setIsNotificationMenuOpen(false);
    if (notif.notification_type === "message") {
      navigate("/chat");
    } else if (notif.notification_type === "booking") {
      navigate("/bookings");
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token") || sessionStorage.getItem("refresh_token");
      if (refreshToken) {
        // await authApi.logout(refreshToken);
      }
    } catch (error) {
      console.error("Backend çıkış işlemi sırasında hata:", error);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      navigate("/login");
    }
  };

  const handleCityChange = (e) => {
    setSelectedCity(e.target.value);
    setSelectedDistrict("");
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Tarayıcınız konum servislerini desteklemiyor.");
    setIsGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          );
          let detectedCity = response.data?.address?.province?.replace(" İli", "").trim() || "";
          let detectedDistrict = (
            response.data?.address?.district ||
            response.data?.address?.borough ||
            response.data?.address?.suburb ||
            ""
          )
            .replace(" ilçe", "")
            .trim();

          const exactCityKey = Object.keys(formattedTurkeyData).find(
            (c) => c.toLocaleLowerCase("tr-TR") === detectedCity.toLocaleLowerCase("tr-TR"),
          );

          if (exactCityKey) {
            setSelectedCity(exactCityKey);
            const matchedDistrict = formattedTurkeyData[exactCityKey].districts.find(
              (d) => d.toLocaleLowerCase("tr-TR") === detectedDistrict.toLocaleLowerCase("tr-TR"),
            );
            setSelectedDistrict(matchedDistrict || "");
          } else {
            alert(`Konum tespit edildi (${detectedCity}), ancak servis ağımızda henüz ilan bulunmuyor.`);
          }
        } catch (error) {
          alert("Konum bilgisi alınırken bir hata oluştu.");
        } finally {
          setIsGpsLoading(false);
        }
      },
      () => {
        alert("Konum izni reddedildi veya alınamadı.");
        setIsGpsLoading(false);
      },
    );
  };

  const handleSaveFilters = () => {
    const newLocation = { city: selectedCity, district: selectedDistrict };
    setLocation(newLocation);
    setIsModalOpen(false);
    if (onLocationFilter) onLocationFilter(newLocation);
  };

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-[#0f172a]/80 backdrop-blur-xl border-b border-[#475569]/50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div onClick={() => navigate("/dashboard")} className="flex items-center gap-2.5 cursor-pointer group select-none">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-300">
              <span className="text-white text-lg font-black tracking-tighter">R</span>
            </div>
            <span className="text-base font-black tracking-wider text-slate-100 font-mono">
              RENT<span className="text-blue-400">CIRCLE</span>
            </span>
          </div>

          <div
            onClick={() => {
              const exactCity =
                Object.keys(formattedTurkeyData).find(
                  (c) => c.toLocaleLowerCase("tr-TR") === (location.city || "").toLocaleLowerCase("tr-TR"),
                ) || location.city;
              setSelectedCity(exactCity);
              let exactDistrict = location.district;
              if (exactCity && formattedTurkeyData[exactCity]) {
                const foundDistrict = formattedTurkeyData[exactCity].districts.find(
                  (d) => d.toLocaleLowerCase("tr-TR") === (location.district || "").toLocaleLowerCase("tr-TR"),
                );
                if (foundDistrict) exactDistrict = foundDistrict;
              }
              setSelectedDistrict(exactDistrict);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e293b]/60 border border-[#475569]/60 rounded-xl hover:border-blue-500/40 transition-all duration-300 cursor-pointer max-w-xs sm:max-w-sm w-full shadow-inner group">
            <span className="text-blue-400 text-sm group-hover:animate-bounce">📍</span>
            <div className="flex-1 text-left overflow-hidden cursor-pointer">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider font-mono">Bölge Seçimi</span>
              <span className="text-xs font-bold text-slate-200 truncate block">
                {location.city ? `${location.city} ${location.district ? `• ${location.district}` : "• Tüm İlçeler"}` : "Tüm Türkiye"}
              </span>
            </div>
            <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20 cursor-pointer">
              DEĞİŞTİR
            </span>
          </div>

          <div className="flex items-center gap-3 relative">
            {isLoggedIn ? (
              <>
                <div className="relative">
                  <div
                    onClick={handleBellClick}
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#1e293b]/80 border border-[#475569]/50 hover:bg-[#334155] transition-colors cursor-pointer group">
                    <span className="text-lg group-hover:rotate-12 transition-transform">🔔</span>

                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white flex items-center justify-center rounded-full text-[9px] font-black border border-[#0f172a] shadow-sm shadow-red-500/50 animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </div>
                    )}
                  </div>

                  {isNotificationMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsNotificationMenuOpen(false)}></div>}

                  <AnimatePresence>
                    {isNotificationMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-14 w-80 cyber-card bg-[#1e293b] shadow-2xl z-50 flex flex-col py-3 border border-[#475569]/60">
                        <div className="px-4 pb-2 border-b border-[#475569]/40 mb-2">
                          <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">Bildirimleriniz</h3>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-slate-500">
                              <span className="text-2xl block mb-2">📭</span>
                              <p className="text-xs font-mono">Yeni bildiriminiz yok.</p>
                            </div>
                          ) : (
                            notifications.map((notif) => (
                              <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className="p-3 border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors cursor-pointer flex gap-3 items-start group relative">
                                <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold uppercase text-xs">
                                  {notif.sender_avatar ? notif.sender_avatar[0] : "S"}
                                </div>
                                <div className="flex-1 pr-6">
                                  <p className="text-[11px] text-slate-300 leading-tight">{notif.message}</p>
                                  <span className="text-[9px] text-slate-500 font-mono mt-1 block">
                                    {new Date(notif.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => handleDeleteNotification(e, notif.id)}
                                  className="absolute right-3 top-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Bildirimi Sil">
                                  &times;
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold cursor-pointer hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all border-2 border-slate-700/50">
                    👤
                  </button>

                  {isProfileMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>}

                  <AnimatePresence>
                    {isProfileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-14 w-48 cyber-card bg-[#1e293b] shadow-2xl z-50 flex flex-col py-2 border border-[#475569]/60">
                        <div
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate(`/stores/${currentUserId}`);
                          }}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">🏪</span> Mağazam
                        </div>

                        <div
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate(`/wallet`);
                          }}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">💵</span> Cüzdanım
                        </div>
                        <div
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate("/bookings");
                          }}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">⚡</span> Aktif İşlemlerim
                        </div>
                        <div
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate("/history");
                          }}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">📜</span> Kiralama Geçmişim
                        </div>
                        <div
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate("/favorites");
                          }}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">❤️</span> Favorilerim
                        </div>
                        <div
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate("/profile");
                          }}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">⚙️</span> Profil
                        </div>
                        <Link
                          to="/chat"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">💬</span> Mesajlar
                        </Link>
                        <div className="border-t border-[#475569]/40 my-1"></div>
                        <div
                          onClick={handleLogout}
                          className="px-4 py-2.5 hover:bg-red-500/10 cursor-pointer text-sm font-bold text-red-400 transition-colors flex items-center gap-2.5">
                          <span className="text-base">🚪</span> Çıkış Yap
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => navigate("/login")} className="btn-slate !py-2 cursor-pointer hover:scale-105 active:scale-95">
                  Giriş Yap
                </button>
                <button
                  onClick={() => navigate("/register")}
                  className="btn-gradient hidden sm:block px-5 py-2.5 cursor-pointer hover:scale-105 active:scale-95">
                  Kayıt Ol
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#0f172a]/70 backdrop-blur-md cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="cyber-card w-full max-w-sm p-6 relative shadow-2xl z-10 space-y-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors text-xs font-bold cursor-pointer hover:scale-110 active:scale-90">
                ✕
              </button>

              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-1.5">🏙️ Konumunu Özelleştir</h3>
                <p className="text-xs text-slate-400 mt-0.5">Sadece seçtiğin bölgedeki ilanları listeleriz.</p>
              </div>

              <button
                type="button"
                disabled={isGpsLoading}
                onClick={handleGetCurrentLocation}
                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-xl hover:bg-blue-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95">
                {isGpsLoading ? "⏳ Konum Çözümleniyor..." : "📡 Mevcut Konumumu Kullan (GPS)"}
              </button>

              <div className="text-[#475569] text-[9px] font-mono font-bold uppercase tracking-wider text-center">- VEYA MANUEL SEÇ -</div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Şehir</label>
                  <select
                    value={selectedCity}
                    onChange={handleCityChange}
                    className="cyber-input cursor-pointer hover:border-blue-500/50 transition-colors">
                    <option value="">Tüm Türkiye</option>
                    {Object.keys(formattedTurkeyData).map((city, i) => (
                      <option key={i} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">İlçe</label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedCity}
                    className="cyber-input cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-500/50 transition-colors">
                    <option value="">Tüm İlçeler (Hepsi)</option>
                    {selectedCity &&
                      formattedTurkeyData[selectedCity]?.districts.map((dist, i) => (
                        <option key={i} value={dist}>
                          {dist}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSaveFilters}
                className="btn-gradient w-full p-3.5 cursor-pointer hover:scale-105 active:scale-95 transition-transform">
                Konumu Güncelle ve Filtrele
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
