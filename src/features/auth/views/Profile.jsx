import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authApi } from "../services/authApi";
import { occupationsList } from "../data/mockData";
import formattedTurkeyData from "../data/parseData";
import countriesJson from "../data/phoneCodes";
import { toast } from "../../../utils/alerts"; // 🎯 YENİ: Bildirim kütüphanesi

const Profile = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);

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
      // 🎯 UX DOSTU GÜNCELLEME HATALARI
      const errData = error.response?.data;
      let errMsg = "Güncelleme başarısız oldu. Lütfen bilgileri kontrol edin.";

      if (errData?.email) {
        errMsg = "Girdiğiniz e-posta adresi başka bir hesaba tanımlı. Lütfen kendinize ait farklı bir adres deneyin.";
      } else if (errData?.username) {
        errMsg = "Bu kullanıcı adı alınmış. Lütfen başka bir tane seçin.";
      } else if (errData?.phone) {
        errMsg = "Bu telefon numarası zaten sistemde kayıtlı. Lütfen size ait olan doğru numarayı girin.";
      } else if (errData) {
        errMsg = Object.values(errData).flat().join(" ");
      }

      toast.fire({ icon: "warning", title: errMsg });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.old_password === passwordData.new_password) {
      return toast.fire({ icon: "warning", title: "Yeni şifreniz mevcut şifrenizle aynı olamaz. Lütfen farklı bir şifre belirleyin." });
    }

    // 🎯 YENİ: Frontend Şifre Zayıflık ve Eşleşme Kontrolleri
    if (passwordData.new_password !== passwordData.confirm_password) {
      return toast.fire({ icon: "error", title: "Girdiğiniz yeni şifreler birbiriyle uyuşmuyor." });
    }
    if (passwordData.new_password.length < 8) {
      return toast.fire({ icon: "warning", title: "Yeni şifreniz çok kısa. Güvenliğiniz için en az 8 karakterli bir şifre belirleyin." });
    }
    if (!/\d/.test(passwordData.new_password) || !/[a-zA-Z]/.test(passwordData.new_password)) {
      return toast.fire({
        icon: "warning",
        title: "Yeni şifreniz çok zayıf. Lütfen içinde hem harf hem de rakam bulunan daha güçlü bir şifre belirleyin.",
      });
    }

    try {
      const response = await authApi.changePassword(passwordData);
      toast.fire({ icon: "success", title: response.message || "Şifreniz başarıyla güncellendi." });
      setPasswordData({ old_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      const errData = error.response?.data;
      let errMsg = "Şifre güncellenemedi.";

      // Hataları düzgün okuma
      if (errData?.old_password) errMsg = errData.old_password[0];
      else if (errData?.new_password) errMsg = errData.new_password[0] || errData.new_password;
      else if (errData?.confirm_password) errMsg = errData.confirm_password[0] || errData.confirm_password;
      else if (errData?.error) errMsg = errData.error;

      toast.fire({ icon: "error", title: errMsg });
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

          {/* İÇERİK ALANI */}
          <div className="relative z-10">
            {activeTab === "profile" && (
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

                  {/* TELEFON BÖLÜMÜ */}
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

                  {/* MESLEK BÖLÜMÜ */}
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

                  {/* ŞEHİR BÖLÜMÜ */}
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

                  {/* İLÇE BÖLÜMÜ */}
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
              <motion.form
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-5 max-w-md">
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
                    className="cyber-input w-full hover:border-slate-500 transition-colors"
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
                    className="cyber-input w-full border-blue-500/30 hover:border-blue-500/50 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-blue-400 cursor-default">Yeni Şifre (Tekrar)</label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    className="cyber-input w-full border-blue-500/30 hover:border-blue-500/50 transition-colors"
                    required
                  />
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    className="btn-slate bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500 hover:text-white hover:border-rose-500 w-full p-3 font-bold transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95">
                    Şifreyi Güncelle
                  </button>
                </div>
              </motion.form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
