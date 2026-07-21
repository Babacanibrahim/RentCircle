import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../services/authApi";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // 🎯 YENİ: URL parametrelerini okumak için eklendi

  // Form State'leri
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [statusInfo, setStatusInfo] = useState({ type: "", message: "" });

  // Gelişmiş UX State'leri
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // 🎯 YENİ: Sayfa yüklendiğinde URL'deki 'activated' parametresini kontrol et
  useEffect(() => {
    const isActivated = searchParams.get("activated");
    if (isActivated === "true") {
      setStatusInfo({ type: "success", message: "✅ Hesabınız başarıyla aktifleştirildi, giriş yapabilirsiniz." });
    } else if (isActivated === "false") {
      setStatusInfo({ type: "error", message: "❌ Aktivasyon linki geçersiz veya süresi dolmuş." });
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusInfo({ type: "", message: "" });

    const payload = {
      email: loginInput.trim(),
      username: loginInput.trim(),
      password: password,
    };

    try {
      const data = await authApi.login(payload);

      // 1. ÖNEMLİ EMNİYET: Çakışmayı önlemek için önce tüm eski tokenları temizle
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");

      // 2. Token'ları tercihe göre kaydet
      if (rememberMe) {
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
      } else {
        sessionStorage.setItem("access_token", data.access);
        sessionStorage.setItem("refresh_token", data.refresh);
      }

      setStatusInfo({ type: "success", message: "Giriş başarılı! Yönlendiriliyorsunuz..." });

      // 3. KESİN ÇÖZÜM: Navbar'ın ve tüm state'lerin sıfırdan yüklenmesi için sert geçiş
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (err) {
      console.error("Giriş Hatası Detayı:", err.response?.data);

      let errMsg = "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.";

      if (err.response?.data) {
        if (err.response.data.detail === "No active account found with the given credentials") {
          errMsg = "Şifre hatalı veya e-posta adresiniz henüz onaylanmamış olabilir.";
        } else if (typeof err.response.data === "object") {
          errMsg = Object.values(err.response.data).flat().join(" ");
        } else {
          errMsg = err.response.data.detail || errMsg;
        }
      }

      setStatusInfo({ type: "error", message: errMsg });
    }
  };

  return (
    <AuthLayout title="Tekrar Hoş Geldin" subtitle="Hesabına giriş yap ve topluluğunda güvenle kiralamaya devam et.">
      <AnimatePresence mode="wait">
        {statusInfo.message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-4 rounded-xl text-sm font-medium border ${statusInfo.type === "success" ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/50" : "bg-rose-950/30 text-rose-400 border-rose-800/50"}`}>
            {statusInfo.message}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#cbd5e1] tracking-wide">Kullanıcı Adı veya E-posta</label>
          <input
            type="text"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            required
            className="cyber-input"
            placeholder="Kullanıcı adı veya e-posta adresi"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-[#cbd5e1] tracking-wide">Şifre</label>
            <Link to="/forgot-password" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition">
              Şifremi Unuttum
            </Link>
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="cyber-input w-full pr-10"
              placeholder="Şifre"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-400 focus:outline-none transition-colors">
              {showPassword ? "👁️" : "🙈"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[#cbd5e1] pt-1">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Beni Hatırla</span>
          </label>
          <span>
            Hesabın yok mu?{" "}
            <Link to="/register" className="text-blue-400 font-semibold hover:underline">
              Kayıt Ol
            </Link>
          </span>
        </div>

        <button type="submit" className="btn-gradient w-full p-3.5 mt-2">
          Giriş Yap
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
