import Swal from "sweetalert2";

// 1. TEMEL TOAST AYARLARI
const baseToast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener("mouseenter", Swal.stopTimer);
    toast.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

// 2. 🎯 DİNAMİK VE HAVALI (CYBER) TOAST FONKSİYONU
// Uygulamanın her yerinden gelen toast.fire() isteklerini araya girip süslüyoruz!
export const toast = {
  fire: (options) => {
    // Varsayılan tema (Info/Bilinmeyen durumlar için)
    let borderGlow = "border-blue-500 shadow-blue-500/40";
    let iconColor = "#3b82f6";
    let progressClass = "bg-gradient-to-r from-blue-600 to-cyan-400";

    // Gelen mesaja göre (Success, Error, Warning) neon renklerini değiştir
    if (options.icon === "success") {
      borderGlow = "border-emerald-500 shadow-emerald-500/40";
      iconColor = "#10b981";
      progressClass = "bg-gradient-to-r from-emerald-600 to-green-400";
    } else if (options.icon === "error") {
      borderGlow = "border-rose-500 shadow-rose-500/40";
      iconColor = "#f43f5e";
      progressClass = "bg-gradient-to-r from-rose-600 to-pink-500";
    } else if (options.icon === "warning") {
      borderGlow = "border-amber-500 shadow-amber-500/40";
      iconColor = "#f59e0b";
      progressClass = "bg-gradient-to-r from-amber-600 to-yellow-400";
    }

    // Swal'ı yeni havalı ayarlarıyla tetikle
    return baseToast.fire({
      ...options,
      background: "rgba(15, 23, 42, 0.70)", // Arka plan şeffaf lacivert (Glassmorphism)
      color: "#f8fafc", // Metin rengi bembeyaz
      iconColor: iconColor,
      customClass: {
        // Tailwind class'ları ile Glow (Parlama) ve Blur (Buzlu cam) efektleri
        popup: `backdrop-blur-xl border-l-4 ${borderGlow} shadow-2xl rounded-2xl !py-3 !px-5 mt-4 mr-4`,
        title: "text-[13px] font-bold tracking-wider font-mono mt-1",
        icon: "scale-75", // İkon zarif dursun diye hafif küçültüyoruz
        timerProgressBar: `!h-1.5 ${progressClass} rounded-b-2xl`, // Neon alt çizgi
      },
    });
  },
};

// 3. 🎯 ONAY PENCERESİ (CYBER CONFIRM)
// Madem toast'ları havalı yaptık, onay pencereleri de eksik kalmasın.
export const cyberConfirm = Swal.mixin({
  background: "rgba(15, 23, 42, 0.85)",
  color: "#f8fafc",
  customClass: {
    popup: "backdrop-blur-xl border border-slate-700/60 shadow-2xl shadow-blue-500/10 rounded-3xl",
    title: "text-lg font-black tracking-tight text-slate-100 uppercase",
    htmlContainer: "text-sm text-slate-400 font-medium",
    confirmButton: "btn-gradient !bg-blue-600 !border-blue-500 px-6 py-2.5 mx-2 shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-transform cursor-pointer",
    cancelButton: "btn-slate px-6 py-2.5 mx-2 hover:scale-105 active:scale-95 transition-transform cursor-pointer",
  },
  buttonsStyling: false,
});