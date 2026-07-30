import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../services/authApi";
import { toast } from "../../../utils/alerts";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [method, setMethod] = useState("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [passwords, setPasswords] = useState({ new_password: "", confirm_password: "" });

  const [timeLeft, setTimeLeft] = useState(180);
  const [resendCooldown, setResendCooldown] = useState(10);

  useEffect(() => {
    let timer;
    if (step === 2) {
      timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step === 2 && timeLeft === 0) {
      toast.fire({ icon: "error", title: "Doğrulama kodunun süresi doldu. Lütfen yeni kod isteyin." });
    }
  }, [timeLeft, step]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // 🎯 YENİ: "isResend" parametresi ekledik. İlk istekte false, Tekrar Gönder'de true olacak.
  const handleRequestOTP = async (e, isResend = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const response = await authApi.forgotPasswordRequest({ method, identifier });
      toast.fire({ icon: "success", title: response.message });

      setStep(2);
      setTimeLeft(180);

      // 🎯 DİNAMİK SAYAÇ KONTROLÜ
      if (isResend) {
        setResendCooldown(180); // Tekrar gönderimlerde artık 3 dakika (180 saniye) bekleyecek
      } else {
        setResendCooldown(10); // Sadece ilk sayfadan gelirken 10 saniye bekleyecek
      }

      setOtp("");
    } catch (err) {
      toast.fire({ icon: "error", title: "Bir hata oluştu, lütfen tekrar deneyin." });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (timeLeft === 0) return;
    setLoading(true);
    try {
      await authApi.verifyOtp({ identifier, otp });
      toast.fire({ icon: "success", title: "Kod doğrulandı! Yeni şifrenizi belirleyebilirsiniz." });
      setStep(3);
    } catch (err) {
      toast.fire({ icon: "error", title: err.response?.data?.error || "Geçersiz kod." });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (passwords.new_password !== passwords.confirm_password) {
      return toast.fire({ icon: "error", title: "Şifreler birbiriyle uyuşmuyor." });
    }
    if (passwords.new_password.length < 8) {
      return toast.fire({ icon: "warning", title: "Yeni şifreniz çok kısa. En az 8 karakter belirleyin." });
    }
    if (!/\d/.test(passwords.new_password) || !/[a-zA-Z]/.test(passwords.new_password)) {
      return toast.fire({ icon: "warning", title: "Şifreniz zayıf. Hem harf hem rakam içermelidir." });
    }

    setLoading(true);
    try {
      const response = await authApi.resetPasswordConfirm({
        identifier,
        otp,
        new_password: passwords.new_password,
        confirm_password: passwords.confirm_password,
      });
      toast.fire({ icon: "success", title: response.message });
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      toast.fire({ icon: "error", title: err.response?.data?.error || "Şifre sıfırlanamadı." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Şifre Kurtarma" subtitle="Hesabınıza tekrar erişmek için adımları takip edin.">
      <div className="relative overflow-hidden min-h-[300px]">
        <AnimatePresence mode="wait">
          {/* STEP 1: KİMLİK DOĞRULAMA */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={(e) => handleRequestOTP(e, false)} // İlk istek olduğunu belirtiyoruz
              className="space-y-5">
              <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("email");
                    setIdentifier("");
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer active:scale-95 ${method === "email" ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-slate-200"}`}>
                  E-Posta ile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethod("username");
                    setIdentifier("");
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer active:scale-95 ${method === "username" ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-slate-200"}`}>
                  Kullanıcı Adı ile
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-default">
                  {method === "email" ? "E-Posta Adresiniz" : "Kullanıcı Adınız"}
                </label>
                <input
                  type={method === "email" ? "email" : "text"}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="cyber-input hover:border-blue-500/50 transition-colors"
                  placeholder={method === "email" ? "ornek@email.com" : "@kullaniciadi"}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !identifier}
                className="btn-gradient w-full p-3.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                {loading ? "Doğrulanıyor..." : "Doğrulama Kodu Gönder"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors cursor-pointer hover:underline">
                İptal Et ve Geri Dön
              </button>
            </motion.form>
          )}

          {/* STEP 2: KOD DOĞRULAMA */}
          {step === 2 && (
            <motion.form
              key="step2"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleVerifyOTP}
              className="space-y-5 text-center">
              <div className="text-5xl mb-2 cursor-default">✉️</div>
              <p className="text-xs text-slate-400 cursor-default">
                <span className="font-bold text-slate-200">{identifier}</span> hesabına bağlı e-posta adresine 6 haneli bir kod gönderdik.
              </p>

              <div className="space-y-2 pt-2">
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="cyber-input text-center text-3xl tracking-[0.5em] font-mono py-4 hover:border-blue-500/50 transition-colors"
                  placeholder="------"
                  disabled={timeLeft === 0}
                />
                <div
                  className={`text-xs font-mono font-bold cursor-default ${timeLeft < 60 ? "text-rose-400 animate-pulse" : "text-slate-400"}`}>
                  Kalan Süre: {formatTime(timeLeft)}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || timeLeft === 0}
                className="btn-gradient w-full p-3.5 mt-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                {loading ? "Doğrulanıyor..." : "Kodu Onayla"}
              </button>

              {/* 🎯 TEKRAR GÖNDER BUTONU: 180 saniyeyi daha şık göstermek için formatTime kullandık */}
              <button
                type="button"
                onClick={() => handleRequestOTP(null, true)} // Tekrar gönderim olduğunu belirten "true"
                disabled={loading || resendCooldown > 0}
                className={`w-full mt-3 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  resendCooldown > 0
                    ? "bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                    : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 active:scale-95"
                }`}>
                {resendCooldown > 0 ? `⏳ Tekrar Göndermek İçin Bekleyin (${formatTime(resendCooldown)})` : "🔄 Kodu Tekrar Gönder"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                }}
                className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors cursor-pointer hover:underline flex items-center justify-center gap-2">
                <span>←</span> E-Posta Seçimine Geri Dön
              </button>
            </motion.form>
          )}

          {/* STEP 3: YENİ ŞİFRE BELİRLEME */}
          {step === 3 && (
            <motion.form
              key="step3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleResetPassword}
              className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/80 mb-4 leading-relaxed cursor-default">
                ⚠️ Lütfen tahmin edilmesi zor, içinde hem harf hem de rakam bulunan en az 8 karakterli yeni bir şifre belirleyin.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 cursor-default">Yeni Şifre</label>
                <input
                  type="password"
                  required
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                  className="cyber-input hover:border-blue-500/50 transition-colors"
                  placeholder="Yeni şifreniz"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 cursor-default">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  required
                  value={passwords.confirm_password}
                  onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                  className="cyber-input hover:border-blue-500/50 transition-colors"
                  placeholder="Şifreyi doğrulayın"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !passwords.new_password || !passwords.confirm_password}
                className="btn-gradient w-full p-3.5 mt-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-blue-500/20">
                {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
