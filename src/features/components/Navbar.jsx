import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom"; // 🎯 Link import edildi
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import formattedTurkeyData from "../auth/data/parseData";
import { itemApi } from "../items/services/itemApi";
import { toast, cyberConfirm } from "../../utils/alerts";

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

  // GLOBAL ARAMA (SEARCH) STATE'LERİ
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await itemApi.getListings({ search: searchQuery });
        setSearchResults(response.results || response);
        setShowSearchDropdown(true);
      } catch (error) {
        console.error("Arama yapılırken hata oluştu:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchDropdown(false);
      navigate(`/dashboard?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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
            if (onLocationFilter) onLocationFilter({ city: "", district: "" });
          });

        const fetchNotifs = () => {
          itemApi
            .getNotifications()
            .then((data) => setNotifications(data))
            .catch((err) => console.error("Bildirimler çekilemedi:", err));
        };

        fetchNotifs();
        notifInterval = setInterval(fetchNotifs, 10000);
      } catch (e) {
        if (onLocationFilter) onLocationFilter({ city: "", district: "" });
      }
    } else {
      if (onLocationFilter) onLocationFilter({ city: "", district: "" });
    }

    return () => {
      if (notifInterval) clearInterval(notifInterval);
    };
  }, [onLocationFilter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleBellClick = async () => {
    setIsNotificationMenuOpen(!isNotificationMenuOpen);
    if (!isNotificationMenuOpen && unreadCount > 0) {
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      try {
        await itemApi.markNotificationsRead();
      } catch (err) {}
    }
  };

  const handleDeleteNotification = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await cyberConfirm.fire({
      title: "Bildirimi Sil",
      text: "Bu bildirimi silmek istediğinize emin misiniz?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Evet, Sil",
      cancelButtonText: "Vazgeç",
    });

    if (result.isConfirmed) {
      try {
        await itemApi.deleteNotification(id);
        setNotifications(notifications.filter((n) => n.id !== id));
      } catch (err) {
        toast.fire({ icon: "error", title: "Bildirim silinemedi." });
      }
    }
  };

  const handleClearAllNotifications = async () => {
    const result = await cyberConfirm.fire({
      title: "Tümünü Temizle",
      text: "Tüm bildirimleri kalıcı olarak silmek istediğinize emin misiniz?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Evet, Temizle",
      cancelButtonText: "Vazgeç",
      customClass: {
        confirmButton:
          "bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-rose-500/20 mx-2 transition-transform hover:scale-105",
      },
    });

    if (result.isConfirmed) {
      try {
        await itemApi.clearAllNotifications();
        setNotifications([]);
        toast.fire({ icon: "success", title: "Tüm bildirimler temizlendi." });
      } catch (err) {
        toast.fire({ icon: "error", title: "Bildirimler temizlenemedi." });
      }
    }
  };

  const handleLogout = async () => {
    const result = await cyberConfirm.fire({
      title: "Çıkış Yap",
      text: "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Evet, Çıkış Yap",
      cancelButtonText: "İptal",
    });

    if (result.isConfirmed) {
      try {
        // Backend logout endpoint kullanılmıyorsa token temizleme işlemi finally bloğunda yapılır.
      } catch (error) {
        console.error("Çıkış işlemi sırasında hata oluştu:", error);
      } finally {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("refresh_token");
        navigate("/login");
        setIsProfileMenuOpen(false);
      }
    }
  };

  const handleCityChange = (e) => {
    setSelectedCity(e.target.value);
    setSelectedDistrict("");
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return toast.fire({ icon: "error", title: "Tarayıcınız konum servislerini desteklemiyor." });
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
            toast.fire({ icon: "success", title: "Konum başarıyla tespit edildi." });
          } else {
            toast.fire({ icon: "info", title: `Konum tespit edildi (${detectedCity}), ancak henüz bu bölgede hizmet vermiyoruz.` });
          }
        } catch (error) {
          toast.fire({ icon: "error", title: "Konum bilgisi alınırken bir hata oluştu." });
        } finally {
          setIsGpsLoading(false);
        }
      },
      () => {
        toast.fire({ icon: "error", title: "Konum izni reddedildi veya alınamadı." });
        setIsGpsLoading(false);
      },
    );
  };

  const handleSaveFilters = () => {
    const newLocation = { city: selectedCity, district: selectedDistrict };
    setLocation(newLocation);
    setIsModalOpen(false);
    if (onLocationFilter) onLocationFilter(newLocation);
    toast.fire({ icon: "success", title: "Konum filtreniz uygulandı." });
  };

  const getNotificationStyle = (type, avatar) => {
    switch (type) {
      case "wallet":
        return { icon: "💸", bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", path: "/wallet" };
      case "system":
        return { icon: "⚠️", bg: "bg-rose-500/20 text-rose-400 border-rose-500/30", path: "/history" };
      case "booking":
        return { icon: "📦", bg: "bg-amber-500/20 text-amber-400 border-amber-500/30", path: "/bookings" };
      case "message":
      default:
        return { icon: avatar ? avatar[0].toUpperCase() : "💬", bg: "bg-blue-500/20 text-blue-400 border-blue-500/30", path: "/chat" };
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-[#0f172a]/80 backdrop-blur-xl border-b border-[#475569]/50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* 1. 🎯 DÜZELTİLDİ: LOGO ALANI ARTIK LİNK */}
          <Link to="/dashboard" className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform duration-300">
              <span className="text-white text-lg font-black tracking-tighter">R</span>
            </div>
            <span className="hidden sm:block text-base font-black tracking-wider text-slate-100 font-mono">
              RENT<span className="text-blue-400">CIRCLE</span>
            </span>
          </Link>

          {/* 2. BÖLGE VE ARAMA ÇUBUĞU */}
          <div ref={searchContainerRef} className="flex-1 max-w-2xl hidden md:flex items-center relative z-50">
            <div className="flex w-full bg-[#1e293b]/60 border border-[#475569]/60 rounded-full hover:border-blue-500/40 transition-all duration-300 shadow-inner group">
              <div
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-[#475569]/50 hover:bg-[#334155]/50 rounded-l-full transition-colors shrink-0">
                <span className="text-blue-400 text-sm group-hover:animate-bounce">📍</span>
                <div className="flex-1 text-left overflow-hidden">
                  <span className="text-xs font-bold text-slate-200 truncate block max-w-[120px]">
                    {location.city ? `${location.city}` : "Tüm Türkiye"}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim()) setShowSearchDropdown(true);
                  }}
                  placeholder="İlan, marka veya kategori ara..."
                  className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-200 px-4 py-2 placeholder-slate-500 rounded-r-full outline-none"
                />
                <button type="submit" className="absolute right-4 cursor-pointer hover:scale-110 active:scale-95 transition-transform">
                  {isSearching ? <span className="text-xs animate-pulse">⏳</span> : <span className="text-slate-400">🔍</span>}
                </button>
              </form>
            </div>

            {/* Arama Sonuçları Dropdown */}
            <AnimatePresence>
              {showSearchDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-[110%] left-0 right-0 bg-[#1e293b] border border-[#475569]/60 rounded-xl shadow-2xl overflow-hidden z-50">
                  {searchResults.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto scrollbar-thin">
                      {searchResults.map((item) => (
                        <Link
                          key={item.id}
                          to={`/listings/${item.id}`}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setSearchQuery("");
                          }}
                          className="flex items-center gap-3 p-3 border-b border-slate-700/50 hover:bg-slate-800/80 cursor-pointer transition-colors block">
                          <div className="w-12 h-12 rounded-lg bg-slate-800 shrink-0 overflow-hidden border border-slate-700/50">
                            {item.images && item.images.length > 0 ? (
                              <img src={item.images[0].image} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-200 truncate">{item.title}</h4>
                            <p className="text-[10px] text-slate-400 truncate">
                              📍 {item.city}, {item.district}
                            </p>
                          </div>
                          <div className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 shrink-0">
                            ₺{item.price_per_day}/Gün
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs font-mono">"{searchQuery}" için sonuç bulunamadı.</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="md:hidden flex-1 flex justify-end">
            <div
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e293b]/60 border border-[#475569]/60 rounded-lg cursor-pointer">
              <span className="text-blue-400 text-sm">📍</span>
              <span className="text-[10px] font-bold text-slate-200 truncate max-w-[80px]">
                {location.city ? location.city : "Türkiye"}
              </span>
            </div>
          </div>

          {/* 3. SAĞ MENÜ (BİLDİRİM & PROFİL) */}
          <div className="flex items-center gap-3 relative shrink-0">
            {isLoggedIn ? (
              <>
                <div className="relative">
                  <div
                    onClick={handleBellClick}
                    className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#1e293b]/80 border border-[#475569]/50 hover:bg-[#334155] transition-colors cursor-pointer group active:scale-95">
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
                        className="absolute right-0 top-14 w-80 md:w-96 cyber-card bg-[#1e293b] shadow-2xl z-50 flex flex-col py-3 border border-[#475569]/60">
                        <div className="px-4 pb-2 border-b border-[#475569]/40 mb-2 flex justify-between items-center cursor-default">
                          <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">Bildirimleriniz</h3>
                          {notifications.length > 0 && (
                            <button
                              onClick={handleClearAllNotifications}
                              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold tracking-wider transition-colors cursor-pointer active:scale-95">
                              Tümünü Temizle
                            </button>
                          )}
                        </div>

                        <div className="max-h-[350px] overflow-y-auto scrollbar-thin">
                          {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-slate-500 cursor-default">
                              <span className="text-3xl block mb-2 opacity-50">📭</span>
                              <p className="text-xs font-mono">Tüm bildirimleri okudunuz.</p>
                            </div>
                          ) : (
                            <>
                              {/* Bildirimler artık doğrudan ilgili sayfaya yönlendiren Link bileşenleridir. */}
                              {notifications.map((notif) => {
                                const style = getNotificationStyle(notif.notification_type, notif.sender_avatar);
                                return (
                                  <Link
                                    key={notif.id}
                                    to={style.path}
                                    onClick={() => setIsNotificationMenuOpen(false)}
                                    className="p-3 border-b border-slate-700/30 hover:bg-slate-700/40 transition-colors cursor-pointer flex gap-3 items-start group relative active:bg-slate-700/60 block">
                                    <div
                                      className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center font-bold uppercase text-sm border ${style.bg}`}>
                                      {style.icon}
                                    </div>
                                    <div className="flex-1 pr-6">
                                      <p className="text-[11.5px] text-slate-300 leading-snug">{notif.message}</p>
                                      <span className="text-[9px] text-slate-500 font-mono mt-1.5 block">
                                        {new Date(notif.created_at).toLocaleDateString("tr-TR", { month: "short", day: "numeric" })} •{" "}
                                        {new Date(notif.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </div>
                                    <button
                                      onClick={(e) => handleDeleteNotification(e, notif.id)}
                                      className="absolute right-3 top-3 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:scale-125 active:scale-90"
                                      title="Sil">
                                      ✕
                                    </button>
                                  </Link>
                                );
                              })}
                            </>
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
                        {/* 🎯 DÜZELTİLDİ: Tüm Profil Menüsü Seçenekleri Link Oldu */}
                        <Link
                          to={`/stores/${currentUserId}`}
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">🏪</span> Mağazam
                        </Link>

                        <Link
                          to={`/my-listings`}
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">📦</span> İlanlarım
                        </Link>

                        <Link
                          to={`/wallet`}
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">💵</span> Cüzdanım
                        </Link>

                        <Link
                          to="/bookings"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">⚡</span> Aktif İşlemlerim
                        </Link>

                        <Link
                          to="/history"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">📜</span> Kiralama Geçmişim
                        </Link>

                        <Link
                          to="/favorites"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">❤️</span> Favorilerim
                        </Link>

                        <Link
                          to="/profile"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">⚙️</span> Profil
                        </Link>

                        <Link
                          to="/chat"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer active:bg-slate-700/70 text-sm text-slate-200 transition-colors flex items-center gap-2.5">
                          <span className="text-base">💬</span> Mesajlar
                        </Link>

                        <div className="border-t border-[#475569]/40 my-1"></div>

                        <div
                          onClick={handleLogout}
                          className="px-4 py-2.5 hover:bg-rose-500/10 cursor-pointer active:bg-rose-500/20 text-sm font-bold text-rose-400 transition-colors flex items-center gap-2.5">
                          <span className="text-base">🚪</span> Çıkış Yap
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-slate !py-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform block">
                  Giriş Yap
                </Link>
                <Link
                  to="/register"
                  className="btn-gradient hidden sm:block px-5 py-2.5 cursor-pointer hover:scale-105 active:scale-95 transition-transform block">
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* KONUM SEÇİM MODALI */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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

              <div className="cursor-default">
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

              <div className="text-[#475569] text-[9px] font-mono font-bold uppercase tracking-wider text-center cursor-default">
                - VEYA MANUEL SEÇ -
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono cursor-default">Şehir</label>
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono cursor-default">İlçe</label>
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
                className="btn-gradient w-full p-3.5 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
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
