import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../services/authApi";
import { occupationsList } from "../data/mockData";
import formattedTurkeyData from "../data/parseData";
import countriesJson from "../data/phoneCodes";

const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    country_code: "+90",
    phone: "",
    city: "",
    district: "",
    occupation: "",
  });
  const [statusInfo, setStatusInfo] = useState({ type: "", message: "" });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleCityChange = (e) => setFormData({ ...formData, city: e.target.value, district: "" });
  const handleCountryCodeChange = (e) => setFormData({ ...formData, country_code: e.target.value, phone: "" });

  const handlePhoneChange = (e) => {
    const rawInput = e.target.value;
    if (formData.country_code === "+90") {
      const digits = rawInput.replace(/\D/g, "");
      let formatted = "";
      if (digits.length <= 3) formatted = digits;
      else if (digits.length <= 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
      else formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
      setFormData({ ...formData, phone: formatted });
    } else {
      setFormData({ ...formData, phone: rawInput.replace(/[^\d\s-]/g, "") });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusInfo({ type: "", message: "" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) return setStatusInfo({ type: "error", message: "Lütfen geçerli bir e-posta adresi giriniz." });
    if (formData.password !== formData.confirm_password)
      return setStatusInfo({ type: "error", message: "Girdiğiniz şifreler birbiriyle uyuşmuyor." });

    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
      if (age < 18) return setStatusInfo({ type: "error", message: "Platforma kayıt olabilmek için en az 18 yaşında olmalısınız." });
    }

    const finalData = {
      ...formData,
      phone: `${formData.country_code.trim()} ${formData.phone.trim()}`,
      region: formData.city ? formattedTurkeyData[formData.city]?.region : "",
    };

    try {
      const data = await authApi.register(finalData);
      setStatusInfo({ type: "success", message: data.message });
    } catch (err) {
      const errMsg = err.response?.data ? Object.values(err.response.data).flat().join(" ") : "Bir hata oluştu.";
      setStatusInfo({ type: "error", message: errMsg });
    }
  };

  return (
    <AuthLayout title="Aramıza Katıl" subtitle="Hesabını oluştur, e-postanı onayla ve güvenli kiralamaya baş.">
      <AnimatePresence mode="wait">
        {statusInfo.message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-xl text-sm font-medium border ${statusInfo.type === "success" ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50" : "bg-rose-900/30 text-rose-400 border-rose-800/50"}`}>
            {statusInfo.message}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
        <div className="grid grid-cols-2 gap-4">
          <input type="text" name="first_name" onChange={handleChange} required className="cyber-input" placeholder="İsim" />
          <input type="text" name="last_name" onChange={handleChange} required className="cyber-input" placeholder="Soyisim" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input type="text" name="username" onChange={handleChange} required className="cyber-input" placeholder="Kullanıcı Adı" />
          <input type="date" name="date_of_birth" onChange={handleChange} required className="cyber-input" />
        </div>
        <input type="email" name="email" onChange={handleChange} required className="cyber-input" placeholder="E-posta" />
        <div className="grid grid-cols-2 gap-4">
          <input type="password" name="password" onChange={handleChange} required className="cyber-input" placeholder="Şifre" />
          <input
            type="password"
            name="confirm_password"
            onChange={handleChange}
            required
            className="cyber-input"
            placeholder="Şifre Tekrar"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Telefon Numarası</label>
          <div className="flex gap-2">
            <select
              name="country_code"
              value={formData.country_code}
              onChange={handleCountryCodeChange}
              className="cyber-input max-w-[120px]">
              {countriesJson.map((country, i) => (
                <option key={i} value={country.dial_code}>
                  {country.code} ({country.dial_code})
                </option>
              ))}
            </select>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handlePhoneChange}
              maxLength={formData.country_code === "+90" ? "12" : "20"}
              required
              className="cyber-input"
              placeholder={formData.country_code === "+90" ? "555-555-5555" : "Telefon Numarası"}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Şehir</label>
            <select name="city" value={formData.city} onChange={handleCityChange} required className="cyber-input">
              <option value="">Şehir Seçin</option>
              {Object.keys(formattedTurkeyData).map((city, i) => (
                <option key={i} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">İlçe</label>
            <select
              name="district"
              value={formData.district}
              onChange={handleChange}
              required
              disabled={!formData.city}
              className="cyber-input disabled:opacity-40 disabled:cursor-not-allowed">
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
          <label className="text-xs font-semibold text-slate-400">Meslek</label>
          <select name="occupation" onChange={handleChange} required className="cyber-input">
            <option value="">Meslek Seçin</option>
            {occupationsList.map((occ, i) => (
              <option key={i} value={occ}>
                {occ}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-gradient w-full p-3.5 mt-2">
          Hesap Oluştur
        </button>
      </form>
    </AuthLayout>
  );
};

export default Register;
