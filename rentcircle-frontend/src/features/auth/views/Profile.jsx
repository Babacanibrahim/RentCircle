import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authApi } from "../services/authApi";
import { occupationsList } from "../data/mockData";
import formattedTurkeyData from "../data/parseData";
import countriesJson from "../data/phoneCodes";
import { toast, cyberConfirm } from "../../../utils/alerts"; // cyberConfirm eklendi

const Profile = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);

  // 🎯 2FA State'leri
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [secretKey, setSecretKey] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [is2FASetupLoading, setIs2FASetupLoading] = useState(false);

  // 🎯 YENİ: 2FA İptal Modal State'i
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);

  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    country_code: "+90",
    phone: "",
    city: "",
    district: "",
    occupation: "",
    show_name: true,
    is_2fa_enabled: false,
  });

  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await authApi.getProfile();
        let code = "+90";
        let num = data.phone || "";

        if (data.phone && data.phone.includes(" ")) {
          const parts = data.phone.split(" ");
          code = parts[0];
          num = parts.slice(1).join(" ");
        }

        setProfileData({ ...data, country_code: code, phone: num });
      } catch (error) {
        toast.fire({ icon: "error", title: "Profil bilgileri yüklenemedi." });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCityChange = (e) => {
    setProfileData({ ...profileData, city: e.target.value, district: "" });
  };

  const handleCountryCodeChange = (e) => {
    setProfileData({ ...profileData, country_code: e.target.value, phone: "" });
  };

  const handlePhoneChange = (e) => {
    const rawInput = e.target.value;
    if (profileData.country_code === "+90") {
      const digits = rawInput.replace(/\D/g, "");
      let formatted = "";
      if (digits.length <= 3) formatted = digits;
      else if (digits.length <= 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
      else formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
      setProfileData({ ...profileData, phone: formatted });
    } else {
      setProfileData({ ...profileData, phone: rawInput.replace(/[^\d\s-]/g, "") });
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...profileData,
        phone: profileData.phone ? `${profileData.country_code.trim()} ${profileData.phone.trim()}` : "",
      };

      await authApi.updateProfile(payload);
      toast.fire({ icon: "success", title: "Profil bilgileriniz başarıyla güncellendi!" });
    } catch (error) {
      const errData = error.response?.data;
      let errMsg = "Güncelleme başarısız oldu. Lütfen bilgileri kontrol edin.";

      if (errData?.email) errMsg = "Girdiğiniz e-posta adresi başka bir hesaba tanımlı.";
      else if (errData?.username) errMsg = "Bu kullanıcı adı alınmış.";
      else if (errData?.phone) errMsg = "Bu telefon numarası zaten kayıtlı.";
      else if (errData) errMsg = Object.values(errData).flat().join(" ");

      toast.fire({ icon: "warning", title: errMsg });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.old_password === passwordData.new_password) {
      return toast.fire({ icon: "warning", title: "Yeni şifreniz mevcut şifrenizle aynı olamaz." });
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      return toast.fire({ icon: "error", title: "Girdiğiniz yeni şifreler uyuşmuyor." });
    }
    if (passwordData.new_password.length < 8) {
      return toast.fire({ icon: "warning", title: "Yeni şifreniz çok kısa." });
    }
    if (!/\d/.test(passwordData.new_password) || !/[a-zA-Z]/.test(passwordData.new_password)) {
      return toast.fire({ icon: "warning", title: "Şifreniz hem harf hem de rakam içermelidir." });
    }

    try {
      const response = await authApi.changePassword(passwordData);
      toast.fire({ icon: "success", title: response.message || "Şifreniz güncellendi." });
      setPasswordData({ old_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      const errData = error.response?.data;
      let errMsg = "Şifre güncellenemedi.";

      if (errData?.old_password) errMsg = errData.old_password[0];
      else if (errData?.new_password) errMsg = errData.new_password[0] || errData.new_password;
      else if (errData?.error) errMsg = errData.error;

      toast.fire({ icon: "error", title: errMsg });
    }
  };

  // 🎯 2FA Kurulum
  const handleSetup2FA = async () => {
    setIs2FASetupLoading(true);
    setIs2FAModalOpen(true);
    try {
      const data = await authApi.setup2FA();
      setQrCodeData(data.qr_code);
      setSecretKey(data.secret_key);
    } catch (error) {
      toast.fire({ icon: "error", title: "QR Kod oluşturulamadı." });
      setIs2FAModalOpen(false);
    } finally {
      setIs2FASetupLoading(false);
    }
  };

  // 🎯 2FA Doğrulama (Aktifleştirme)
  const handleVerify2FA = async () => {
    if (otpCode.length !== 6) return toast.fire({ icon: "warning", title: "Lütfen 6 haneli kodu girin." });

    try {
      const response = await authApi.verify2FA(otpCode);
      toast.fire({ icon: "success", title: response.message });
      setIs2FAModalOpen(false);
      setOtpCode("");
      setProfileData((prev) => ({ ...prev, is_2fa_enabled: true }));
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "Kod doğrulanamadı." });
    }
  };

  // 🎯 YENİ: 2FA İptal (Devre Dışı Bırakma)
  const handleDisable2FA = async () => {
    if (otpCode.length !== 6) return toast.fire({ icon: "warning", title: "Lütfen 6 haneli kodu girin." });

    try {
      const response = await authApi.disable2FA(otpCode);
      toast.fire({ icon: "success", title: response.message });
      setIsDisableModalOpen(false);
      setOtpCode("");
      setProfileData((prev) => ({ ...prev, is_2fa_enabled: false }));
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "Kod doğrulanamadı, iptal reddedildi." });
    }
  };

  if (loading)
    return (
      <div className="w-full relative flex justify-center pt-20 text-slate-500 font-mono tracking-widest animate-pulse">YÜKLENİYOR...</div>
    );

  return (
    <div className="w-full relative selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="cyber-card p-6 md:p-10 border border-slate-700/50 relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

          <h1 className="text-2xl font-black text-slate-100 mb-8 flex items-center gap-3 cursor-default">⚙️ Hesap Ayarları</h1>

          {/* SEKMELER */}
          <div className="flex gap-4 border-b border-slate-700/50 mb-8 relative">
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-3 text-sm font-bold transition-all relative cursor-pointer hover:scale-105 active:scale-95 ${activeTab === "profile" ? "text-blue-400" : "text-slate-400 hover:text-slate-200"}`}>
              👤 Profil Bilgileri
              {activeTab === "profile" && (
                <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`pb-3 text-sm font-bold transition-all relative cursor-pointer hover:scale-105 active:scale-95 ${activeTab === "security" ? "text-blue-400" : "text-slate-400 hover:text-slate-200"}`}>
              🔒 Güvenlik & Şifre
              {activeTab === "security" && (
                <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
              )}
            </button>
          </div>

          <div className="relative z-10">
            {activeTab === "profile" && (
              // (PROFIL FORMU AYNI - BURAYI KIRPMADIM, KENDI KODUNDAKI GIBI KALSIN)
              <motion.form
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleProfileSubmit}
                className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Kullanıcı Adı</label>
                    <input
                      type="text"
                      name="username"
                      value={profileData.username}
                      onChange={handleProfileChange}
                      className="cyber-input w-full hover:border-blue-500/50 transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">E-Posta Adresi</label>
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      className="cyber-input w-full hover:border-blue-500/50 transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Ad</label>
                    <input
                      type="text"
                      name="first_name"
                      value={profileData.first_name}
                      onChange={handleProfileChange}
                      className="cyber-input w-full hover:border-blue-500/50 transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Soyad</label>
                    <input
                      type="text"
                      name="last_name"
                      value={profileData.last_name}
                      onChange={handleProfileChange}
                      className="cyber-input w-full hover:border-blue-500/50 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Telefon Numarası</label>
                    <div className="flex gap-2">
                      <select
                        name="country_code"
                        value={profileData.country_code}
                        onChange={handleCountryCodeChange}
                        className="cyber-input max-w-[100px] cursor-pointer hover:border-blue-500/50 transition-colors">
                        {countriesJson.map((country, i) => (
                          <option key={i} value={country.dial_code}>
                            {country.code} ({country.dial_code})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        name="phone"
                        value={profileData.phone}
                        onChange={handlePhoneChange}
                        maxLength={profileData.country_code === "+90" ? "12" : "20"}
                        className="cyber-input w-full hover:border-blue-500/50 transition-colors"
                        placeholder={profileData.country_code === "+90" ? "555-555-5555" : "Telefon Numarası"}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Meslek / Unvan</label>
                    <select
                      name="occupation"
                      value={profileData.occupation || ""}
                      onChange={handleProfileChange}
                      className="cyber-input w-full cursor-pointer hover:border-blue-500/50 transition-colors">
                      <option value="">Meslek Seçin</option>
                      {occupationsList.map((occ, i) => (
                        <option key={i} value={occ}>
                          {occ}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Şehir</label>
                    <select
                      name="city"
                      value={profileData.city || ""}
                      onChange={handleCityChange}
                      className="cyber-input w-full cursor-pointer hover:border-blue-500/50 transition-colors">
                      <option value="">Şehir Seçin</option>
                      {Object.keys(formattedTurkeyData).map((city, i) => (
                        <option key={i} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">İlçe</label>
                    <select
                      name="district"
                      value={profileData.district || ""}
                      onChange={handleProfileChange}
                      disabled={!profileData.city}
                      className="cyber-input w-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-500/50 transition-colors">
                      <option value="">İlçe Seçin</option>
                      {profileData.city &&
                        formattedTurkeyData[profileData.city]?.districts.map((dist, i) => (
                          <option key={i} value={dist}>
                            {dist}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="bg-[#0f172a]/50 border border-slate-700/50 p-4 rounded-xl flex items-center justify-between mt-4 hover:bg-[#0f172a]/80 transition-colors cursor-default">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">Tam İsmimi Platformda Göster</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 max-w-sm">
                      Kapatırsanız, ilanlarınızda ve profilinizde isminiz yerine yalnızca{" "}
                      <span className="font-mono text-blue-400">@{profileData.username || "kullaniciadi"}</span> görünür.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="show_name"
                      checked={profileData.show_name}
                      onChange={handleProfileChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="btn-gradient px-8 py-3 w-full sm:w-auto shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all">
                    Değişiklikleri Kaydet
                  </button>
                </div>
              </motion.form>
            )}

            {activeTab === "security" && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8">
                {/* 🛡️ 2FA ALANI GÜNCELLENDİ (İptal Butonu Eklendi) */}
                <div
                  className={`p-5 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg transition-colors ${profileData.is_2fa_enabled ? "bg-emerald-900/10 border-emerald-500/30 shadow-emerald-500/5" : "bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-blue-500/30 shadow-blue-500/5"}`}>
                  <div>
                    <h3 className="text-base font-black text-slate-100 flex items-center gap-2">🛡️ İki Aşamalı Doğrulama (2FA)</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md">
                      Cüzdanınızdaki parayı çekmek ve hesabınızı çalınmaya karşı korumak için 2FA sistemini aktifleştirin.
                    </p>
                  </div>

                  {profileData.is_2fa_enabled ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-2 cursor-default">
                        ✅ Aktif ve Korunuyor
                      </div>
                      <button
                        onClick={() => {
                          setOtpCode(""); // Kodu sıfırla
                          setIsDisableModalOpen(true);
                        }}
                        className="px-4 py-2 bg-transparent border border-rose-500/50 hover:bg-rose-500 hover:text-white text-rose-400 text-xs font-bold rounded-lg transition-all active:scale-95 shrink-0 cursor-pointer">
                        Kapat
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleSetup2FA}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95 shrink-0 cursor-pointer">
                      Kurulumu Başlat
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-700/50 my-6"></div>

                <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-md">
                  <h3 className="text-base font-black text-slate-100 mb-2">🔑 Şifre Değiştir</h3>
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/80 mb-6 leading-relaxed cursor-default">
                    ⚠️ Güvenliğiniz için şifre değişikliği yaptıktan sonra diğer tüm cihazlardaki oturumlarınız kapatılabilir. Lütfen tahmin
                    edilmesi zor, güçlü bir şifre belirleyin.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 cursor-default">Mevcut Şifre</label>
                    <input
                      type="password"
                      name="old_password"
                      value={passwordData.old_password}
                      onChange={handlePasswordChange}
                      className="cyber-input w-full"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-blue-400 cursor-default">Yeni Şifre</label>
                    <input
                      type="password"
                      name="new_password"
                      value={passwordData.new_password}
                      onChange={handlePasswordChange}
                      className="cyber-input w-full border-blue-500/30"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-blue-400 cursor-default">
                      Yeni Şifre (Tekrar)
                    </label>
                    <input
                      type="password"
                      name="confirm_password"
                      value={passwordData.confirm_password}
                      onChange={handlePasswordChange}
                      className="cyber-input w-full border-blue-500/30"
                      required
                    />
                  </div>

                  <div className="pt-6">
                    <button
                      type="submit"
                      className="btn-slate bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500 hover:text-white w-full p-3 font-bold transition-all shadow-lg active:scale-95">
                      Şifreyi Güncelle
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* 🛡️ 2FA KURULUM MODALI */}
      <AnimatePresence>
        {is2FAModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="cyber-card bg-[#1e293b] border border-blue-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-blue-500/20 relative">
              <button
                onClick={() => setIs2FAModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm font-bold cursor-pointer">
                ✕
              </button>

              <h2 className="text-lg font-black text-white text-center mb-5 flex items-center justify-center gap-2">
                <span className="text-blue-400">🛡️</span> 2FA Kurulumu
              </h2>

              {is2FASetupLoading ? (
                <div className="flex flex-col justify-center items-center h-48 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-400 animate-pulse font-mono text-xs">Şifreli Kalkan Oluşturuluyor...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <p className="text-xs text-slate-300 text-center mb-5 leading-relaxed">
                    Google veya Microsoft Authenticator uygulamasını açın ve aşağıdaki QR kodu okutun.
                  </p>
                  {qrCodeData && (
                    <div className="p-2 bg-white rounded-xl mb-5 shadow-lg shadow-white/10 ring-4 ring-blue-500/20">
                      <img src={qrCodeData} alt="2FA QR Code" className="w-40 h-40 object-contain" />
                    </div>
                  )}
                  <div className="w-full bg-[#0f172a]/50 border border-slate-700/50 rounded-lg p-3 mb-6 text-center">
                    <p className="text-[10px] text-slate-400 mb-1">Kamera çalışmıyorsa şu kodu manuel girin:</p>
                    <span className="font-mono text-blue-400 font-bold tracking-widest text-sm select-all">{secretKey}</span>
                  </div>
                  <div className="w-full space-y-2 mb-6">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center block">
                      Uygulamadaki 6 Haneli Kodu Girin
                    </label>
                    <input
                      type="text"
                      maxLength="6"
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold bg-[#0f172a] border border-blue-500/50 text-white rounded-xl p-3 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleVerify2FA}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2">
                    🔒 Kalkanı Aktifleştir
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚨 YENİ: 2FA DEVRE DIŞI BIRAKMA MODALI */}
      <AnimatePresence>
        {isDisableModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="cyber-card bg-[#1e293b] border border-rose-500/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-rose-500/20 relative">
              <button
                onClick={() => setIsDisableModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm font-bold cursor-pointer">
                ✕
              </button>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">⚠️</span>
                </div>

                <h2 className="text-lg font-black text-white text-center mb-2">Güvenlik Uyarısı</h2>
                <p className="text-xs text-rose-300/80 text-center mb-6 leading-relaxed bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                  2FA'yı kapattığınızda cüzdanınızdaki paralar ve hesabınız saldırılara karşı <b>korunmasız</b> kalacaktır.
                </p>

                <div className="w-full space-y-2 mb-6">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center block">
                    Kapatmayı Onaylamak İçin 6 Haneli Kodu Girin
                  </label>
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold bg-[#0f172a] border border-rose-500/50 focus:border-rose-400 text-rose-400 rounded-xl p-3 outline-none"
                  />
                </div>

                <button
                  onClick={handleDisable2FA}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-rose-500/30 transition-all active:scale-95 cursor-pointer">
                  Evet, 2FA'yı Devre Dışı Bırak
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
