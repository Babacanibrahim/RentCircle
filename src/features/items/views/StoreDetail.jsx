import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { itemApi } from "../services/itemApi";
import ItemCard from "../components/ItemCard";

const DefaultAvatar = () => (
  <svg className="w-8 h-8 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const StoreDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const data = await itemApi.getStoreDetail(id);
        setStore(data);
      } catch (error) {
        console.error("Mağaza detayları çekilemedi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [id]);

  if (loading)
    return (
      <div className="w-full relative flex items-center justify-center font-mono text-xs tracking-widest text-slate-400 animate-pulse">
        MAĞAZA PROFİLİ YÜKLENİYOR...
      </div>
    );
  if (!store) return <div className="w-full relative text-center pt-20">Mağaza bulunamadı.</div>;

  const activeListings = store.active_listings || [];
  const rentedListings = store.rented_listings || [];
  const storeReviews = store.reviews || [];

  return (
    <div className="w-full relative p-6 lg:p-12 selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* HERO KART */}
        <div className="cyber-card p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

          <div className="flex items-center gap-5 flex-col md:flex-row text-center md:text-left z-10">
            {/* AVATAR KISMI */}
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center shadow-xl border border-slate-700/50 overflow-hidden font-black text-2xl text-slate-300 uppercase">
              {store.profile_image ? (
                <img src={store.profile_image} alt={store.username} className="w-full h-full object-cover" />
              ) : store.show_name ? (
                store.first_name?.[0]
              ) : (
                store.username?.[0] || <DefaultAvatar />
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                ✔️ KAYITLI KULLANICI
              </span>

              {/* DİNAMİK İSİM GÖSTERİMİ */}
              <h1 className="text-2xl font-black tracking-tight text-slate-100">
                {store.show_name ? `${store.first_name} ${store.last_name}` : `@${store.username}`}
              </h1>

              {/* Eğer show_name false ise, username yukarıya geçtiği için h3 boş kalır, kalabalık yapmaz */}
              {store.show_name && <h3 className="text-sm font-medium text-slate-400">@{store.username}</h3>}

              {/* DİNAMİK PUANLAMA */}
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs text-amber-400 font-semibold bg-slate-900/50 px-3 py-1 rounded-lg w-fit mx-auto md:mx-0 mt-2">
                ⭐ {store.rating > 0 ? store.rating : "Yeni"}
                <span className="text-slate-400 font-normal">({store.review_count || storeReviews.length} Değerlendirme)</span>
              </div>
            </div>
          </div>
        </div>

        {/* TABS KISMI (Değişiklik yok) */}
        <div className="space-y-6">
          <div className="flex gap-2 border-b border-slate-700/50 pb-px">
            <button
              onClick={() => setActiveTab("active")}
              className={`pb-3 text-xs font-bold tracking-wider uppercase transition-all relative px-2 ${activeTab === "active" ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
              Aktif İlanlar ({activeListings.length})
              {activeTab === "active" && (
                <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("rented")}
              className={`pb-3 text-xs font-bold tracking-wider uppercase transition-all relative px-2 ${activeTab === "rented" ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
              Şu Anda Kirada ({rentedListings.length})
              {activeTab === "rented" && (
                <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          <div>
            {activeTab === "active" ? (
              activeListings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeListings.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-slate-500 py-6">Kullanıcının henüz aktif bir ilanı bulunmuyor.</p>
              )
            ) : rentedListings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                {rentedListings.map((item) => (
                  <div key={item.id} className="relative group">
                    <ItemCard item={item} />
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center pointer-events-none z-20">
                      <span className="bg-slate-900/90 text-amber-400 border border-amber-500/30 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-xl">
                        🔒 KİRADA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-500 py-6">Kullanıcının şu anda kirada olan bir ürünü bulunmuyor.</p>
            )}
          </div>
        </div>

        {/* YORUMLAR (GİZLİLİK KURALLARINA GÖRE) */}
        <div className="border-t border-slate-700/50 pt-8 space-y-5">
          <h2 className="text-sm font-bold tracking-widest text-slate-300 uppercase font-mono">💬 Kullanıcı Değerlendirmeleri</h2>

          {storeReviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeReviews.map((review) => {
                // YORUM YAPANIN İSMİ GÖZÜKSÜN MÜ?
                const reviewerName = review.reviewer_show_name
                  ? `${review.reviewer_first_name} ${review.reviewer_last_name?.[0]}.`
                  : `@${review.reviewer_username}`;

                const reviewerInitial = review.reviewer_show_name ? review.reviewer_first_name?.[0] : review.reviewer_username?.[0];

                return (
                  <div key={review.id} className="cyber-card p-5 space-y-3 !bg-slate-800/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-200 uppercase shadow-inner border border-slate-600/50">
                          {reviewerInitial || "K"}
                        </div>
                        <span className="text-xs font-bold text-slate-200">{reviewerName || "Kullanıcı"}</span>
                      </div>
                      <span className="text-[10px] tracking-widest">{"⭐".repeat(review.rating)}</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed italic pl-9">"{review.comment || "Sadece puanlama yapıldı."}"</p>

                    <div className="mt-3 pl-9">
                      <div
                        onClick={() => navigate(`/listings/${review.item}`)}
                        className="inline-flex items-center gap-2 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/50 rounded-lg p-1.5 cursor-pointer transition-colors">
                        <img
                          src={review.item_image || "https://via.placeholder.com/40"}
                          alt="item"
                          className="w-8 h-8 rounded-md object-cover border border-slate-700"
                        />
                        <div className="flex flex-col pr-2">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kiralanan Ürün</span>
                          <span className="text-[10px] text-blue-400 font-semibold truncate max-w-[150px]">
                            {review.item_title || "Ürün İlanı"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="cyber-card p-8 text-center text-slate-500 border-dashed text-xs">
              Kullanıcı henüz bir değerlendirme almamış. İlk kiralayan ve değerlendiren siz olun!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreDetail;
