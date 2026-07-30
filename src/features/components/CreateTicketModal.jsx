import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { itemApi } from "../items/services/itemApi";
import { toast } from "../../utils/alerts";

const CreateTicketModal = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({ topic: "billing", subject: "", description: "", attachment: null });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.description) return toast.fire({ icon: "warning", title: "Lütfen başlık ve açıklamayı doldurun." });

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("topic", form.topic);
      formData.append("subject", form.subject);
      formData.append("description", form.description);
      if (form.attachment) {
        formData.append("attachment", form.attachment);
      }

      await itemApi.createTicket(formData);
      toast.fire({ icon: "success", title: "Destek talebiniz başarıyla oluşturuldu!" });
      setForm({ topic: "billing", subject: "", description: "", attachment: null });
      onClose();
    } catch (err) {
      toast.fire({ icon: "error", title: "Destek talebi oluşturulamadı." });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="cyber-card p-6 w-full max-w-lg border border-blue-500/30 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">🎫 Destek Bileti Oluştur</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400">Konu Başlığı</label>
            <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="cyber-input w-full text-xs">
              <option value="billing">Ödeme ve Bakiye İşlemleri</option>
              <option value="account">Hesap ve Profil İşlemleri</option>
              <option value="item_issue">İlan ve Kiralama Sorunları</option>
              <option value="technical">Sistem ve Teknik Sorunlar</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400">Özet Konu</label>
            <input
              type="text"
              required
              placeholder="Örn: Cüzdanımdan para düşmedi ama hata aldım"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="cyber-input w-full text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400">Detaylı Açıklama</label>
            <textarea
              rows="4"
              required
              placeholder="Yaşadığınız problemi detaylıca anlatın..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="cyber-input w-full text-xs resize-none"></textarea>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400">Ek Görsel (Opsiyonel, Max 1)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setForm({ ...form, attachment: e.target.files[0] })}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-500/10 file:text-blue-400 cursor-pointer"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-slate flex-1">
              İptal
            </button>
            <button type="submit" disabled={loading} className="btn-gradient flex-1 py-2.5 font-bold text-xs uppercase">
              {loading ? "Gönderiliyor..." : "Bileti Gönder"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateTicketModal;
