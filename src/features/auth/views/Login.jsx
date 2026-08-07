import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../services/authApi";
import { toast, cyberConfirm } from "../../../utils/alerts";
import { motion, AnimatePresence } from "framer-motion";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // 2FA State'leri
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const isActivated = searchParams.get("activated");
    if (isActivated === "true") {
      toast.fire({ icon: "success", title: "Hesabınız başarıyla aktifleştirildi, giriş yapabilirsiniz." });
      searchParams.delete("activated");
      setSearchParams(searchParams);
    } else if (isActivated === "false") {
      toast.fire({ icon: "error", title: "Aktivasyon linki geçersiz veya süresi dolmuş." });
      searchParams.delete("activated");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Asıl Login isteğini atan fonksiyon
  const executeLogin = async (payload) => {
    try {
      setIsSubmitting(true);
      const data = await authApi.login(payload);

      let isStaff = false;
      try {
        const userProfile = await authApi.getProfile(data.access);
        if (userProfile.is_staff === true || userProfile?.user?.is_staff === true) {
          isStaff = true;
        }
      } catch (profileErr) {
        console.error("Profil çekilemedi, normal kullanıcı varsayılıyor.", profileErr);
      }

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");

      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      toast.fire({ icon: "success", title: "Giriş başarılı! Yönlendiriliyorsunuz..." });
      setIs2FAModalOpen(false);

      setTimeout(() => {
        let nextUrl = searchParams.get("next") || location.state?.from?.pathname || location.state?.from;
        if (!nextUrl) {
          nextUrl = isStaff ? "/admin-dashboard" : "/dashboard";
        }
        window.location.href = nextUrl;
      }, 500);
    } catch (err) {
      setIsSubmitting(false);

      // 🛡️ Brute-Force Yakalama
      if (err.response && err.response.status === 429) {
        return toast.fire({
          icon: "warning",
          title: err.response.data.error || "Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.",
        });
      }

      const errData = err.response?.data;

      // DRF veriyi bazen detail objesi içine sarabilir, her iki durumu da yakalıyoruz
      const banInfo = errData?.is_banned ? errData : errData?.detail?.is_banned ? errData.detail : null;

      // 🚨 SİSTEME GİRİŞ YASAĞI (HESAP BANI) KONTROLÜ
      if (banInfo) {
        return cyberConfirm.fire({
          title: "🚫 Hesap Askıya Alındı",
          html: `
            <div style="text-align: left; font-size: 14px;">
              <p style="color: #e11d48; font-weight: bold; margin-bottom: 10px;">${banInfo.error}</p>
              <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; color: #be123c; font-style: italic; margin-bottom: 16px;">
                 <strong>Ceza Sebebi:</strong> "${banInfo.reason}"
              </div>
              <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
                 Verilen kararda bir yanlışlık olduğunu düşünüyorsanız veya itirazda bulunmak istiyorsanız, detaylı bir açıklama ile birlikte 
                 <a href="mailto:babacan-1907@outlook.com.tr" style="color: #3b82f6; font-weight: bold; text-decoration: underline;">babacan-1907@outlook.com.tr</a> 
                 adresine e-posta gönderebilirsiniz.
              </p>
            </div>
          `,
          icon: "error",
          confirmButtonText: "Anladım",
          confirmButtonColor: "#e11d48",
          showCancelButton: false,
        });
      }

      // 🛡️ SIFIR GÜVEN 2FA YAKALAMA: Backend benden 2FA Kodu istiyor!
      if (errData?.requires_2fa || errData?.detail?.requires_2fa) {
        setIs2FAModalOpen(true);
        setOtpCode(""); // Eski kodu temizle
        return;
      }

      // Standart Hata Yakalama
      let errMsg = "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.";
      if (errData) {
        if (errData.detail === "No active account found with the given credentials") {
          errMsg = "Şifre hatalı veya hesabınız sistem tarafından dondurulmuş olabilir.";
        } else if (errData.error) {
          errMsg = errData.error;
        } else if (typeof errData === "object" && !errData.requires_2fa) {
          errMsg = Object.values(errData).flat().join(" ");
        } else {
          errMsg = errData.detail || errMsg;
        }
      }
      toast.fire({ icon: "error", title: errMsg });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { email: loginInput.trim(), username: loginInput.trim(), password };
    executeLogin(payload);
  };

  const handle2FASubmit = (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      return toast.fire({ icon: "warning", title: "Lütfen 6 haneli kodu eksiksiz girin." });
    }
    const payload = { email: loginInput.trim(), username: loginInput.trim(), password, otp_code: otpCode };
    executeLogin(payload);
  };

  return (
    <AuthLayout title="Tekrar Hoş Geldin" subtitle="Hesabına giriş yap ve topluluğunda güvenle kiralamaya devam et.">
      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
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
          disabled={isSubmitting}
          className="btn-gradient w-full p-3.5 mt-2 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
          {isSubmitting && !is2FAModalOpen ? "Giriş Yapılıyor..." : "Giriş Yap"}
        </button>
      </form>

      {/* 🛡️ 2FA ONAY MODALI (LOGIN İÇİN) */}
      <AnimatePresence>
        {is2FAModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="cyber-card bg-[#1e293b] border border-blue-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-blue-500/20 relative">
              <button
                onClick={() => {
                  setIs2FAModalOpen(false);
                  setIsSubmitting(false);
                }}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm font-bold cursor-pointer hover:scale-110 active:scale-90">
                ✕
              </button>

              <div className="flex flex-col items-center pt-2">
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">🛡️</span>
                </div>

                <h2 className="text-lg font-black text-white text-center mb-2">İki Aşamalı Doğrulama</h2>
                <p className="text-xs text-slate-300 text-center mb-6 leading-relaxed">
                  Hesabınıza giriş yapmak için lütfen Authenticator uygulamanızdaki 6 haneli kodu girin.
                </p>

                <form onSubmit={handle2FASubmit} className="w-full space-y-6">
                  <input
                    type="text"
                    maxLength="6"
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold bg-[#0f172a] border border-blue-500/50 focus:border-blue-400 text-white rounded-xl p-3 outline-none transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2">
                    {isSubmitting ? "Doğrulanıyor..." : "Kodu Doğrula ve Giriş Yap"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
};

export default Login;
