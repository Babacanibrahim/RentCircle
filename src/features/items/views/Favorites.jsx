import React, { useEffect, useState } from "react";
import { itemApi } from "../services/itemApi";
import ItemCard from "../components/ItemCard";
import { useNavigate } from "react-router-dom";

const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const data = await itemApi.getFavorites();
        setFavorites(data);
      } catch (error) {
        console.error("Favoriler çekilirken hata oluştu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, []);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-32 font-mono text-sm tracking-widest text-slate-400">
        <div className="animate-pulse">FAVORİLER YÜKLENİYOR...</div>
      </div>
    );
  }

  return (
    <div className="w-full relative selection:bg-rose-500/30">
      {/* Arka Plan Kırmızımsı Neon Işıklar (Favori teması) */}
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-700/50 pb-6">
          <div className="cursor-default">
            <h1 className="text-2xl font-black tracking-tight text-slate-100 flex items-center gap-2">❤️ Favori İlanlarım</h1>
            <p className="text-xs text-slate-400 mt-1">Gözüne kestirdiğin ve kaydettiğin tüm ilanlar burada listeleniyor.</p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn-slate px-5 py-3 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-sm">
            ← İlanlara Dön
          </button>
        </div>

        {favorites.length === 0 ? (
          <div className="cyber-card text-center py-24 bg-[#0f172a]/40 border border-slate-700/50 cursor-default">
            <div className="text-4xl mb-4 opacity-50 animate-pulse">💔</div>
            <h3 className="text-slate-300 font-bold mb-1">Henüz favori ilanınız yok</h3>
            <p className="font-mono text-xs text-slate-500">
              Ana sayfadaki ilanları inceleyerek beğendiklerinizi favorilerinize ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {favorites.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
