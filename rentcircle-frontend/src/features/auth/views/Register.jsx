import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../services/authApi";
import { occupationsList } from "../data/mockData";
import formattedTurkeyData from "../data/parseData";
import countriesJson from "../data/phoneCodes";
import { toast } from "../../../utils/alerts";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setIsSubmitting(false);
      return toast.fire({ icon: "warning", title: "Lütfen geçerli bir e-posta adresi giriniz." });
    }
    if (formData.password !== formData.confirm_password) {
      setIsSubmitting(false);
      return toast.fire({ icon: "error", title: "Girdiğiniz şifreler birbiriyle uyuşmuyor." });
    }

    if (formData.password.length < 8) {
      setIsSubmitting(false);
      return toast.fire({ icon: "warning", title: "Şifreniz çok kısa. Güvenliğiniz için en az 8 karakterli bir şifre belirleyin." });
    }
    if (!/\d/.test(formData.password) || !/[a-zA-Z]/.test(formData.password)) {
      setIsSubmitting(false);
      return toast.fire({
        icon: "warning",
        title: "Şifreniz çok zayıf. Lütfen içinde hem harf hem de rakam bulunan daha güçlü bir şifre belirleyin.",
      });
    }

    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
      if (age < 18) {
        setIsSubmitting(false);
        return toast.fire({ icon: "error", title: "Platforma kayıt olabilmek için en az 18 yaşında olmalısınız." });
      }
    }

    const finalData = {
      ...formData,
      phone: `${formData.country_code.trim()} ${formData.phone.trim()}`,
      region: formData.city ? formattedTurkeyData[formData.city]?.region : "",
    };

    try {
      const data = await authApi.register(finalData);
      toast.fire({ icon: "success", title: data.message || "Kayıt başarılı! Lütfen e-postanızı onaylayın." });

      setFormData({
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
    } catch (err) {
      // 🛡️ YENİ: Bot Spam Koruması (Rate Limiting 429 Yakalama)
      if (err.response && err.response.status === 429) {
        return toast.fire({
          icon: "warning",
          title: err.response.data.error || "Kısa sürede çok fazla kayıt denemesi yaptınız. Lütfen biraz bekleyin.",
        });
      }

      const errData = err.response?.data;
      let errMsg = "Kayıt olurken beklenmeyen bir hata oluştu.";

      if (errData?.email) {
        errMsg = "Bu e-posta adresiyle daha önce bir hesap oluşturulmuş. Şifrenizi unuttuysanız giriş ekranından sıfırlayabilirsiniz.";
      } else if (errData?.username) {
        errMsg = "Bu kullanıcı adı maalesef başkası tarafından kullanılıyor. Lütfen başka bir kullanıcı adı seçin.";
      } else if (errData?.phone) {
        errMsg =
          "Bu telefon numarasıyla kayıtlı bir hesap zaten var. Şifrenizi unuttuysanız 'Şifremi Unuttum' sayfasından yeni şifre alabilirsiniz.";
      } else if (errData) {
        errMsg = Object.values(errData).flat().join(" ");
      }

      toast.fire({ icon: "error", title: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Aramıza Katıl" subtitle="Hesabını oluştur, e-postanı onayla ve güvenli kiralamaya başla.">
      <form onSubmit={handleSubmit} className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
            className="cyber-input hover:border-blue-500/50 transition-colors"
            placeholder="İsim"
          />
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
            className="cyber-input hover:border-blue-500/50 transition-colors"
            placeholder="Soyisim"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            className="cyber-input hover:border-blue-500/50 transition-colors"
            placeholder="Kullanıcı Adı"
          />
          <input
            type="date"
            name="date_of_birth"
            value={formData.date_of_birth}
            onChange={handleChange}
            required
            className="cyber-input hover:border-blue-500/50 transition-colors cursor-pointer"
          />
        </div>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="cyber-input w-full hover:border-blue-500/50 transition-colors"
          placeholder="E-posta"
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="cyber-input hover:border-blue-500/50 transition-colors"
            placeholder="Şifre"
          />
          <input
            type="password"
            name="confirm_password"
            value={formData.confirm_password}
            onChange={handleChange}
            required
            className="cyber-input hover:border-blue-500/50 transition-colors"
            placeholder="Şifre Tekrar"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 cursor-default">Telefon Numarası</label>
          <div className="flex gap-2">
            <select
              name="country_code"
              value={formData.country_code}
              onChange={handleCountryCodeChange}
              className="cyber-input max-w-[120px] cursor-pointer hover:border-blue-500/50 transition-colors">
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
              className="cyber-input w-full hover:border-blue-500/50 transition-colors"
              placeholder={formData.country_code === "+90" ? "555-555-5555" : "Telefon Numarası"}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 cursor-default">Şehir</label>
            <select
              name="city"
              value={formData.city}
              onChange={handleCityChange}
              required
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
            <label className="text-xs font-semibold text-slate-400 cursor-default">İlçe</label>
            <select
              name="district"
              value={formData.district}
              onChange={handleChange}
              required
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
          <label className="text-xs font-semibold text-slate-400 cursor-default">Meslek</label>
          <select
            name="occupation"
            value={formData.occupation}
            onChange={handleChange}
            required
            className="cyber-input cursor-pointer hover:border-blue-500/50 transition-colors">
            <option value="">Meslek Seçin</option>
            {occupationsList.map((occ, i) => (
              <option key={i} value={occ}>
                {occ}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end text-xs text-[#cbd5e1] pt-1">
          <span className="cursor-default">
            Zaten hesabın var mı?{" "}
            <Link to="/login" className="text-blue-400 font-semibold hover:underline cursor-pointer transition-colors">
              Giriş Yap
            </Link>
          </span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-gradient w-full p-3.5 mt-2 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? "Kaydediliyor..." : "Hesap Oluştur"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Register;
