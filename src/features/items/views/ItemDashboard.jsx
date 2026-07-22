import React, { useEffect, useState } from "react";
import { itemApi } from "../services/itemApi";
import ItemCard from "../components/ItemCard";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "../../../utils/alerts"; // 🎯 YENİ: Hata bildirimleri için

const ItemDashboard = () => {
  const navigate = useNavigate();
  const { locationFilter } = useOutletContext() || {};

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- GELİŞMİŞ FİLTRE STATE'LERİ ---
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const filters = {
          city: locationFilter?.city || "",
          district: locationFilter?.district || "",
        };

        const [itemsData, categoriesData] = await Promise.all([itemApi.getListings(filters), itemApi.getCategories()]);

        setItems(itemsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Veriler çekilirken hata oluştu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [locationFilter]);

  const handleCreateListingClick = () => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) {
      toast.fire({ icon: "info", title: "İlan vermek için lütfen önce giriş yapın." });
      return navigate("/login");
    }
    navigate("/create-listing");
  };

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories((prev) => (prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]));
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category);

    const itemPrice = parseFloat(item.price_per_day) || 0;
    const minP = parseFloat(priceMin);
    const maxP = parseFloat(priceMax);

    const matchesMinPrice = isNaN(minP) || itemPrice >= minP;
    const matchesMaxPrice = isNaN(maxP) || itemPrice <= maxP;

    const isItemAvailable = item.is_available === true || item.is_available === "true";
    const matchesAvailability = !availableOnly || isItemAvailable;

    return matchesCategory && matchesMinPrice && matchesMaxPrice && matchesAvailability;
  });

  if (loading) {
    return (
      <div className="w-full relative flex items-center justify-center font-mono text-sm tracking-widest text-slate-400 pt-20">
        <div className="animate-pulse">RENTCIRCLE YÜKLENİYOR...</div>
      </div>
    );
  }

  return (
    <div className="w-full relative selection:bg-blue-500/30">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-700/50 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-100">Güvenli Paylaşım Ekosistemi</h1>
            <p className="text-xs text-slate-400 mt-1">
              📍 {locationFilter?.city || "Tüm Türkiye"} {locationFilter?.district ? `- ${locationFilter.district}` : ""} bölgesindeki
              ilanlar listeleniyor.
            </p>
          </div>
          <button
            onClick={handleCreateListingClick}
            className="btn-gradient px-5 py-3 cursor-pointer hover:scale-[1.03] active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
            + Yeni İlan Ver
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-300">
              Bulunan İlan: <span className="text-blue-400">{filteredItems.length}</span>
            </span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-slate !py-2 !px-4 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                showFilters ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : ""
              }`}>
              <span className="text-lg">⚙️</span> {showFilters ? "Filtreleri Gizle" : "Gelişmiş Filtreler"}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="cyber-card p-5 overflow-hidden border border-[#475569]/60 shadow-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">🏷️ Kategoriler</h3>
                    <div className="max-h-36 overflow-y-auto scrollbar-thin space-y-2 pr-2">
                      {categories.map((cat) => (
                        <label
                          key={cat.id}
                          className="flex items-center gap-3 cursor-pointer group hover:bg-slate-800/40 p-1.5 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.id)}
                            onChange={() => handleCategoryToggle(cat.id)}
                            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                          />
                          <span
                            className={`text-sm transition-colors cursor-pointer ${
                              selectedCategories.includes(cat.id) ? "text-blue-400 font-bold" : "text-slate-300 group-hover:text-slate-100"
                            }`}>
                            {cat.name}
                          </span>
                        </label>
                      ))}
                      {categories.length === 0 && <span className="text-xs text-slate-500">Kategori bulunamadı.</span>}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      💰 Günlük Fiyat Aralığı
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="relative w-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₺</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Min"
                          value={priceMin}
                          onChange={(e) => setPriceMin(e.target.value)}
                          className="cyber-input !pl-8 w-full hover:border-blue-500/50 transition-colors"
                        />
                      </div>
                      <span className="text-slate-500 font-bold">-</span>
                      <div className="relative w-full">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₺</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Max"
                          value={priceMax}
                          onChange={(e) => setPriceMax(e.target.value)}
                          className="cyber-input !pl-8 w-full hover:border-blue-500/50 transition-colors"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">* Boş bırakılan alanlar sınır koymaz.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">🟢 İlan Durumu</h3>
                    <label className="flex items-start gap-3 cursor-pointer group mt-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/80 transition-colors shadow-inner">
                      <input
                        type="checkbox"
                        checked={availableOnly}
                        onChange={(e) => setAvailableOnly(e.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded bg-slate-800 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                      <div className="flex flex-col cursor-pointer">
                        <span className={`text-sm font-bold transition-colors ${availableOnly ? "text-emerald-400" : "text-slate-200"}`}>
                          Sadece Şu An Müsait Olanlar
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1">
                          Aktif olarak başka birinde kirada olan ilanları listeden gizler.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-[#475569]/40 pt-4">
                  <button
                    onClick={() => {
                      setSelectedCategories([]);
                      setPriceMin("");
                      setPriceMax("");
                      setAvailableOnly(false);
                      toast.fire({ icon: "success", title: "Filtreler temizlendi." });
                    }}
                    className="text-xs text-slate-400 hover:text-rose-400 font-bold transition-colors cursor-pointer hover:scale-105 active:scale-95">
                    🗑️ Filtreleri Temizle
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 ? (
          <div className="cyber-card text-center py-20 bg-transparent border-dashed border-slate-700">
            <span className="text-4xl mb-4 block">🏜️</span>
            <p className="text-sm font-bold text-slate-300">Bu kriterlere uygun ilan bulunamadı.</p>
            <p className="text-xs text-slate-500 mt-2 font-mono">Filtreleri esnetmeyi veya farklı bir bölge seçmeyi deneyin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemDashboard;
