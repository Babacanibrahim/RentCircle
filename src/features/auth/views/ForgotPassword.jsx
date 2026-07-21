import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { authApi } from "../services/authApi";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: İstek, 2: Doğrulama, 3: Yeni Şifre
  const [loading, setLoading] = useState(false);
  const [statusInfo, setStatusInfo] = useState({ type: "", message: "" });

  // Veri State'leri
  const [method, setMethod] = useState("email"); // 'email' veya 'username'
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [passwords, setPasswords] = useState({ new_password: "", confirm_password: "" });

  // Zamanlayıcı State'i (3 Dakika = 180 saniye)
  const [timeLeft, setTimeLeft] = useState(180);

  // Geri Sayım Mantığı
  useEffect(() => {
    let timer;
    if (step === 2 && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setStatusInfo({ type: "error", message: "Doğrulama kodunun süresi doldu." });
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  // Saniyeyi mm:ss formatına çevirir
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // 1. ADIM: Kod İsteme
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusInfo({ type: "", message: "" });
    try {
      const response = await authApi.forgotPasswordRequest({ method, identifier });
      setStatusInfo({ type: "success", message: response.message });
      setStep(2);
      setTimeLeft(180); // Süreyi başlat
    } catch (err) {
      setStatusInfo({ type: "error", message: "Bir hata oluştu, lütfen tekrar deneyin." });
    } finally {
      setLoading(false);
    }
  };

  // 2. ADIM: Kodu Doğrulama
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (timeLeft === 0) return;
    setLoading(true);
    setStatusInfo({ type: "", message: "" });
    try {
      await authApi.verifyOtp({ identifier, otp });
      setStatusInfo({ type: "success", message: "Kod doğrulandı! Yeni şifrenizi belirleyebilirsiniz." });
      setStep(3);
    } catch (err) {
      setStatusInfo({ type: "error", message: err.response?.data?.error || "Geçersiz kod." });
    } finally {
      setLoading(false);
    }
  };

  // 3. ADIM: Şifre Sıfırlama
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      return setStatusInfo({ type: "error", message: "Şifreler birbiriyle uyuşmuyor." });
    }
    setLoading(true);
    setStatusInfo({ type: "", message: "" });
    try {
      const response = await authApi.resetPasswordConfirm({
        identifier,
        otp,
        new_password: passwords.new_password,
        confirm_password: passwords.confirm_password,
      });
      setStatusInfo({ type: "success", message: response.message });
      setTimeout(() => navigate("/login"), 3000); // 3 saniye sonra girişe at
    } catch (err) {
      setStatusInfo({ type: "error", message: err.response?.data?.error || "Şifre sıfırlanamadı." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Şifre Kurtarma" subtitle="Hesabınıza tekrar erişmek için adımları takip edin.">
      <AnimatePresence mode="wait">
        {statusInfo.message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mb-4 p-4 rounded-xl text-sm font-medium border ${statusInfo.type === "success" ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50" : "bg-rose-900/30 text-rose-400 border-rose-800/50"}`}>
            {statusInfo.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative overflow-hidden min-h-[300px]">
        <AnimatePresence mode="wait">
          {/* STEP 1: Kullanıcı Bulma */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleRequestOTP}
              className="space-y-5">
              <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => {
                    setMethod("email");
                    setIdentifier("");
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${method === "email" ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-slate-200"}`}>
                  E-Posta ile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMethod("username");
                    setIdentifier("");
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${method === "username" ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:text-slate-200"}`}>
                  Kullanıcı Adı ile
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {method === "email" ? "E-Posta Adresiniz" : "Kullanıcı Adınız"}
                </label>
                <input
                  type={method === "email" ? "email" : "text"}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="cyber-input"
                  placeholder={method === "email" ? "ornek@email.com" : "@kullaniciadi"}
                />
              </div>

              <button type="submit" disabled={loading || !identifier} className="btn-gradient w-full p-3.5 disabled:opacity-50">
                {loading ? "Doğrulanıyor..." : "Doğrulama Kodu Gönder"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors">
                İptal Et ve Geri Dön
              </button>
            </motion.form>
          )}

          {/* STEP 2: Kodu Doğrulama */}
          {step === 2 && (
            <motion.form
              key="step2"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleVerifyOTP}
              className="space-y-5 text-center">
              <div className="text-5xl mb-2">✉️</div>
              <p className="text-xs text-slate-400">
                <span className="font-bold text-slate-200">{identifier}</span> hesabına bağlı e-posta adresine 6 haneli bir kod gönderdik.
              </p>

              <div className="space-y-2 pt-2">
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="cyber-input text-center text-3xl tracking-[0.5em] font-mono py-4"
                  placeholder="------"
                  disabled={timeLeft === 0}
                />
                <div className={`text-xs font-mono font-bold ${timeLeft < 60 ? "text-rose-400 animate-pulse" : "text-slate-400"}`}>
                  Kalan Süre: {formatTime(timeLeft)}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || timeLeft === 0}
                className="btn-gradient w-full p-3.5 mt-4 disabled:opacity-50">
                {loading ? "Doğrulanıyor..." : "Kodu Onayla"}
              </button>
            </motion.form>
          )}

          {/* STEP 3: Yeni Şifre Belirleme */}
          {step === 3 && (
            <motion.form
              key="step3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              onSubmit={handleResetPassword}
              className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Yeni Şifre</label>
                <input
                  type="password"
                  required
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                  className="cyber-input"
                  placeholder="Yeni şifreniz"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  required
                  value={passwords.confirm_password}
                  onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                  className="cyber-input"
                  placeholder="Şifreyi doğrulayın"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !passwords.new_password || !passwords.confirm_password}
                className="btn-gradient w-full p-3.5 mt-4 disabled:opacity-50">
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
