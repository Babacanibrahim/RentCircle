// src/utils/alerts.js
import Swal from 'sweetalert2';

// 🎯 SAĞ ÜSTTEN ÇIKAN HIZLI BİLDİRİMLER (Toast)
export const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: '#1e293b', // Senin cyber-card arkaplan rengin
  color: '#f8fafc',
  iconColor: '#60a5fa',
  customClass: {
    popup: 'border border-[#475569]/50 shadow-2xl rounded-xl font-sans'
  },
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  }
});

// 🎯 EKRANIN ORTASINDA ÇIKAN ŞIK ONAY PENCERELERİ (Confirm)
export const cyberConfirm = Swal.mixin({
  background: '#0f172a',
  color: '#f8fafc',
  buttonsStyling: false,
  customClass: {
    popup: 'border border-[#475569]/50 shadow-2xl rounded-2xl',
    title: 'text-xl font-black text-slate-100 tracking-tight',
    htmlContainer: 'text-sm text-slate-400 mt-2',
    actions: 'flex gap-3 mt-6',
    confirmButton: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-blue-500/20',
    cancelButton: 'bg-slate-800 text-slate-300 border border-slate-700 font-bold py-2.5 px-6 rounded-xl hover:bg-slate-700 transition-colors'
  }
});