import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { itemApi } from "../services/itemApi";

const ItemCard = ({ item }) => {
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);

  const handleFavoriteClick = async (e) => {
    e.stopPropagation();
    const token = localStorage.getItem("access_token");
    if (!token) return alert("Favoriye eklemek için giriş yapmalısınız.");

    try {
      await itemApi.toggleFavorite(item.id, token);
      setIsFavorite(!isFavorite);
    } catch (err) {
      console.error("Favori işlemi başarısız:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.3 }}
      className="group relative cyber-card overflow-hidden hover:shadow-blue-500/10 hover:border-blue-500/30">
      {/* Görsel Alanı */}
      <div className="relative h-48 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

        {/* ❤️ NEON FAVORİ BUTONU */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 z-20 p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-xs transition-all active:scale-90 hover:border-rose-500/50 group/heart">
          <span
            className={`transition-colors duration-200 block text-[14px] ${isFavorite ? "text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" : "text-slate-500 group-hover/heart:text-rose-400"}`}>
            {isFavorite ? "❤️" : "🤍"}
          </span>
        </button>

        {item.images && item.images.length > 0 ? (
          (() => {
            const mainImage = item.images.find((img) => img.is_main) || item.images[0];
            return (
              <img
                src={mainImage.image}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            );
          })()
        ) : (
          <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase group-hover:text-blue-400 transition-colors">
            {item.category_detail?.name || "Ürün Görseli"}
          </span>
        )}

        <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-[11px] font-medium text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/80 z-10">
          📍 {item.city}, {item.district}
        </div>
      </div>

      {/* İçerik Alanı */}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 tracking-wide line-clamp-1 group-hover:text-blue-400 transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 h-8 leading-relaxed">{item.description}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <div>
            <span className="text-xs text-slate-500 block">Günlük Bedel</span>
            <span className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              ₺{parseFloat(item.price_per_day).toLocaleString("tr-TR")}
            </span>
          </div>
          <button
            onClick={() => navigate(`/listings/${item.id}`)}
            className="btn-slate hover:bg-blue-600 hover:text-white hover:border-blue-500">
            İncele
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ItemCard;
