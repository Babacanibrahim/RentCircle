import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../services/authApi";
import { toast } from "../../../utils/alerts"; // 🎯 YENİ

const Login = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const isActivated = searchParams.get("activated");
    if (isActivated === "true") {
      toast.fire({ icon: "success", title: "Hesabınız başarıyla aktifleştirildi, giriş yapabilirsiniz." });
      setSearchParams({}); // Bildirimi verip URL'yi temizliyoruz
    } else if (isActivated === "false") {
      toast.fire({ icon: "error", title: "Aktivasyon linki geçersiz veya süresi dolmuş." });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      email: loginInput.trim(),
      username: loginInput.trim(),
      password: password,
    };

    try {
      const data = await authApi.login(payload);

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");

      if (rememberMe) {
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
      } else {
        sessionStorage.setItem("access_token", data.access);
        sessionStorage.setItem("refresh_token", data.refresh);
      }

      toast.fire({ icon: "success", title: "Giriş başarılı! Yönlendiriliyorsunuz..." });

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

      toast.fire({ icon: "error", title: errMsg });
    }
  };

  return (
    <AuthLayout title="Tekrar Hoş Geldin" subtitle="Hesabına giriş yap ve topluluğunda güvenle kiralamaya devam et.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#cbd5e1] tracking-wide cursor-default">Kullanıcı Adı veya E-posta</label>
          <input
            type="text"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            required
            className="cyber-input hover:border-blue-500/50 transition-colors"
            placeholder="Kullanıcı adı veya e-posta adresi"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-[#cbd5e1] tracking-wide cursor-default">Şifre</label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer hover:underline">
              Şifremi Unuttum
            </Link>
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="cyber-input w-full pr-10 hover:border-blue-500/50 transition-colors"
              placeholder="Şifre"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-400 focus:outline-none transition-colors cursor-pointer active:scale-90 hover:scale-110">
              {showPassword ? "👁️" : "🙈"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[#cbd5e1] pt-1">
          <label className="flex items-center space-x-2 cursor-pointer select-none hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Beni Hatırla</span>
          </label>
          <span className="cursor-default">
            Hesabın yok mu?{" "}
            <Link to="/register" className="text-blue-400 font-semibold hover:underline cursor-pointer transition-colors">
              Kayıt Ol
            </Link>
          </span>
        </div>

        <button
          type="submit"
          className="btn-gradient w-full p-3.5 mt-2 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
          Giriş Yap
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
