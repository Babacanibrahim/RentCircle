import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { walletApi } from "../../auth/services/authApi";
import { motion } from "framer-motion";

const WalletDashboard = () => {
  const [searchParams] = useSearchParams();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [iban, setIban] = useState("TR");

  useEffect(() => {
    fetchWallet();
    const status = searchParams.get("status");
    if (status === "success") {
      alert("✅ Ödeme başarılı! Bakiyeniz cüzdanınıza eklendi.");
    } else if (status === "fail") {
      alert("❌ Ödeme işlemi başarısız oldu veya iptal edildi.");
    }
  }, [searchParams]);

  const fetchWallet = async () => {
    try {
      const data = await walletApi.getWalletDetails();
      setWallet(data);
    } catch (error) {
      console.error("Cüzdan bilgileri alınamadı:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    if (!depositAmount || depositAmount <= 0) return alert("Geçerli bir tutar girin.");

    try {
      const result = await walletApi.initiateDeposit(depositAmount);
      if (result.status === "success" && result.paymentPageUrl) {
        window.location.href = result.paymentPageUrl;
      } else {
        alert("Ödeme başlatılamadı: " + (result.errorMessage || "Bilinmeyen hata"));
      }
    } catch (error) {
      console.error(error);
      alert("Bir hata oluştu.");
    }
  };

  const handleIbanChange = (e) => {
    let rawValue = e.target.value.toUpperCase();
    if (!rawValue.startsWith("TR")) {
      rawValue = "TR" + rawValue.replace(/[^0-9]/g, "");
    } else {
      const prefix = "TR";
      const numbers = rawValue.slice(2).replace(/[^0-9]/g, "");
      rawValue = prefix + numbers;
    }
    if (rawValue.length > 26) rawValue = rawValue.slice(0, 26);
    setIban(rawValue);
  };

  const handleWithdrawAmountChange = (e) => {
    let val = e.target.value;
    if (val < 0) val = 0;
    setWithdrawAmount(val);
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amountToWithdraw = parseFloat(withdrawAmount);
    const currentBalance = parseFloat(wallet?.balance || 0);

    if (amountToWithdraw > currentBalance) {
      return alert("❌ Çekmek istediğiniz tutar mevcut bakiyenizden fazla olamaz.");
    }

    if (iban.length !== 26) {
      return alert("❌ Lütfen 26 haneli geçerli bir IBAN girin (TR + 24 Rakam).");
    }

    try {
      await walletApi.requestWithdrawal(amountToWithdraw, iban);
      alert("💸 Para çekme talebiniz başarıyla alındı! Admin onayından sonra IBAN'ınıza gönderilecektir.");
      setWithdrawAmount("");
      setIban("TR");
      fetchWallet();
    } catch (error) {
      alert(error.response?.data?.error || "Para çekme işlemi başarısız oldu.");
    }
  };

  if (loading) {
    return <div className="text-center text-slate-400 mt-20 animate-pulse font-mono">CÜZDAN YÜKLENİYOR...</div>;
  }

  const isWithdrawDisabled = !withdrawAmount || parseFloat(withdrawAmount) > parseFloat(wallet?.balance) || iban.length !== 26;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-black text-slate-100 mb-8 tracking-tight">Dijital Cüzdanım</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="col-span-1 p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-2xl rounded-full"></div>
          <h2 className="text-slate-400 font-bold mb-2">Mevcut Bakiye</h2>
          <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            ₺{wallet?.balance}
          </div>
          <p className="text-xs text-emerald-400 mt-4">Kullanıma Hazır</p>
        </motion.div>

        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-slate-200 font-bold mb-4 flex items-center gap-2">💳 Kredi Kartı ile Yükle</h3>
              <p className="text-xs text-slate-400 mb-4">Güvenli İyzico altyapısı ile anında cüzdanınıza bakiye yükleyin.</p>
            </div>
            <form onSubmit={handleDeposit} className="space-y-4">
              <input
                type="number"
                min="1"
                placeholder="Yüklenecek Tutar (₺)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-500/20">
                Güvenli Ödeme Yap
              </button>
            </form>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">🏦 IBAN'a Para Çek</h3>
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mb-4">
                <p className="text-[10px] text-amber-400 font-bold">⚠️ ÖNEMLİ GÜVENLİK UYARISI</p>
                <p className="text-[10px] text-slate-300 mt-1">
                  Sadece kendi adınıza (
                  <span className="text-white font-bold">
                    {wallet?.user?.first_name} {wallet?.user?.last_name}
                  </span>
                  ) kayıtlı vadesiz banka hesaplarına çekim yapabilirsiniz.
                </p>
              </div>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <input
                  type="number"
                  placeholder="Çekilecek Tutar (₺)"
                  value={withdrawAmount}
                  onChange={handleWithdrawAmountChange}
                  className={`w-full bg-slate-900 border rounded-lg px-4 py-3 text-slate-200 focus:outline-none transition-colors ${parseFloat(withdrawAmount) > parseFloat(wallet?.balance) ? "border-rose-500 focus:border-rose-500" : "border-slate-700 focus:border-indigo-500"}`}
                />
                {parseFloat(withdrawAmount) > parseFloat(wallet?.balance) && (
                  <p className="text-rose-400 text-[10px] mt-1 ml-1">Yetersiz bakiye!</p>
                )}
              </div>
              <input
                type="text"
                placeholder="TR__"
                value={iban}
                onChange={handleIbanChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm tracking-widest"
              />
              <button
                type="submit"
                disabled={isWithdrawDisabled}
                className={`w-full font-bold py-3 rounded-lg transition-colors shadow-lg ${
                  isWithdrawDisabled
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
                }`}>
                Çekim Talebi Gönder
              </button>
            </form>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-slate-200 mb-4">İşlem Geçmişi (Hesap Özeti)</h2>
      <div className="bg-slate-800/40 rounded-2xl border border-slate-700 overflow-x-auto">
        {wallet?.transactions?.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-sm">Henüz bir işlem yapmadınız.</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-300 min-w-[800px]">
            <thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500">
              <tr>
                <th className="px-6 py-4 w-32">Tarih</th>
                <th className="px-6 py-4 w-40">İşlem Türü</th>
                <th className="px-6 py-4">Açıklama Detayı</th>
                <th className="px-6 py-4 text-right w-32">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {wallet?.transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-mono whitespace-nowrap text-xs">{new Date(txn.created_at).toLocaleDateString("tr-TR")}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                        txn.transaction_type === "DEPOSIT" || txn.transaction_type === "INCOME" || txn.transaction_type === "REFUND"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                      {txn.transaction_type_display}
                    </span>
                  </td>
                  {/* 🎯 YENİ: Açıklama kısmı artık satır atlayan, okunaklı, destansı bir formatta */}
                  <td className="px-6 py-4">
                    <div className="max-w-xs md:max-w-md whitespace-normal leading-relaxed text-[13px] text-slate-300">
                      {txn.description || "-"}
                    </div>
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-bold font-mono whitespace-nowrap ${
                      txn.transaction_type === "DEPOSIT" || txn.transaction_type === "INCOME" || txn.transaction_type === "REFUND"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}>
                    {txn.transaction_type === "DEPOSIT" || txn.transaction_type === "INCOME" || txn.transaction_type === "REFUND"
                      ? "+"
                      : "-"}
                    ₺{txn.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default WalletDashboard;
