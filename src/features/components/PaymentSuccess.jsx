import React from "react";
import { useNavigate } from "react-router-dom";

const PaymentSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0f172a] text-slate-200">
      <div className="text-6xl mb-4">🎉</div>
      <h1 className="text-3xl font-black text-emerald-400 mb-2">Ödeme Başarılı!</h1>
      <p className="text-slate-400 mb-6">Kiralama talebiniz satıcıya iletildi. Para şu an güvenli havuzumuzda bekliyor.</p>
      <button onClick={() => navigate("/bookings")} className="btn-gradient px-6 py-3">
        İşlemlerime Git
      </button>
    </div>
  );
};
export default PaymentSuccess;
