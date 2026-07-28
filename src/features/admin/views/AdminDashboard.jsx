import React, { useEffect, useState } from "react";
import { itemApi } from "../../items/services/itemApi";
import { motion, AnimatePresence } from "framer-motion";
import { toast, cyberConfirm } from "../../../utils/alerts";
import NotFound from "../../components/NotFound";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [activeTab, setActiveTab] = useState("stats");

  const [stats, setStats] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]); // 💸 FİNANS İÇİN YENİ STATE
  const [searchQuery, setSearchQuery] = useState("");

  // ================= UNDO (GERİ AL) SİSTEMİ =================
  const [pendingAction, setPendingAction] = useState(null); // { type: 'user'|'item', obj: {...}, timeoutId }

  // Modallar
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalTab, setUserModalTab] = useState("info");
  const [selectedUserLogs, setSelectedUserLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("all");

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedDispute, setSelectedDispute] = useState(null);

  const [userForm, setUserForm] = useState({});
  const [itemForm, setItemForm] = useState({});

  const fetchAdminData = async () => {
    try {
      const [statsData, disputesData, usersData, itemsData, logsData, withdrawalsData] = await Promise.all([
        itemApi.getAdminStats(),
        itemApi.getDisputedBookings(),
        itemApi.getAdminUsers(searchQuery),
        itemApi.getAdminItems(searchQuery),
        itemApi.getSystemLogs(),
        itemApi.getAdminWithdrawals(), // 💸 Finans verisi çekildi
      ]);
      setStats(statsData);
      setDisputes(disputesData);
      setUsers(usersData);
      setItems(itemsData);
      setLogs(logsData);
      setWithdrawals(withdrawalsData);
    } catch (error) {
      if (error.response?.status === 403 || error.response?.status === 401) setIsUnauthorized(true);
      else toast.fire({ icon: "error", title: "Veriler çekilemedi." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [searchQuery]);

  // ================= UNDO İŞLEMLERİ (GERİ ALMA) =================
  const executeDeleteAPI = async (type, id) => {
    try {
      if (type === "user") await itemApi.adminDeleteUser(id);
      if (type === "item") await itemApi.adminDeleteItem(id);
      toast.fire({ icon: "success", title: "Kalıcı olarak silindi." });
      fetchAdminData();
    } catch (e) {
      toast.fire({ icon: "error", title: "Silme başarısız." });
      fetchAdminData();
    }
    setPendingAction(null);
  };

  const requestDelete = async (type, obj) => {
    const result = await cyberConfirm.fire({
      title: type === "user" ? "Kullanıcıyı Sil" : "İlanı Sil",
      text: "Silinen veri geri getirilemez. Ancak 5 saniye içinde geri alma (Undo) şansınız olacak.",
      icon: "warning",
      confirmButtonText: "Sil",
      confirmButtonColor: "#e11d48",
    });

    if (result.isConfirmed) {
      setSelectedUser(null);
      setSelectedItem(null);
      if (type === "user") setUsers((prev) => prev.filter((u) => u.id !== obj.id));
      if (type === "item") setItems((prev) => prev.filter((i) => i.id !== obj.id));

      const timeoutId = setTimeout(() => {
        executeDeleteAPI(type, obj.id);
      }, 5000);
      setPendingAction({ type, obj, timeoutId });
    }
  };

  const undoDelete = () => {
    if (!pendingAction) return;
    clearTimeout(pendingAction.timeoutId);
    if (pendingAction.type === "user") setUsers((prev) => [pendingAction.obj, ...prev]);
    if (pendingAction.type === "item") setItems((prev) => [pendingAction.obj, ...prev]);
    setPendingAction(null);
    toast.fire({ icon: "info", title: "Silme işlemi geri alındı." });
  };

  // ================= KULLANICI İŞLEMLERİ =================
  const openUserGodMode = async (user) => {
    setSelectedUser(user);
    setUserModalTab("info");
    setLogFilter("all");
    setUserForm({ wallet_balance: user.wallet_balance, trust_score: user.trust_score, is_staff: user.is_staff });
    try {
      const uLogs = await itemApi.getAdminUserLogs(user.id);
      setSelectedUserLogs(uLogs);
    } catch (error) {}
  };

  const handleUpdateUser = async () => {
    try {
      await itemApi.updateAdminUser({ user_id: selectedUser.id, ...userForm });
      toast.fire({ icon: "success", title: "Güncellendi." });
      setSelectedUser(null);
      fetchAdminData();
    } catch (error) {
      toast.fire({ icon: "error", title: "Başarısız." });
    }
  };

  // ================= İLAN İŞLEMLERİ =================
  const openItemGodMode = (item) => {
    setSelectedItem(item);
    setItemForm({
      title: item.title,
      description: item.description,
      price_per_day: item.price_per_day,
      city: item.city,
      is_available: item.is_available,
      is_banned: item.is_banned,
    });
  };

  const handleUpdateItem = async () => {
    try {
      await itemApi.adminUpdateItem({ item_id: selectedItem.id, ...itemForm });
      toast.fire({ icon: "success", title: "İlan güncellendi." });
      setSelectedItem(null);
      fetchAdminData();
    } catch (error) {
      toast.fire({ icon: "error", title: "Başarısız." });
    }
  };

  // ================= FİNANS / PARA ÇEKME İŞLEMLERİ =================
  const handleWithdrawalAction = async (id, action) => {
    let reason = "";
    if (action === "reject") {
      const { value, isConfirmed } = await cyberConfirm.fire({
        title: "Talebi Reddet",
        input: "text",
        inputPlaceholder: "Reddetme sebebi (Örn: Hatalı IBAN)...",
        showCancelButton: true,
        confirmButtonText: "Reddet ve İade Et",
        confirmButtonColor: "#e11d48",
      });
      if (!isConfirmed) return;
      if (!value) return toast.fire({ icon: "warning", title: "Lütfen bir sebep girin." });
      reason = value;
    } else {
      const { isConfirmed } = await cyberConfirm.fire({
        title: "EFT Onayı",
        text: "Kullanıcıya parayı gönderdiğinizi onaylıyor musunuz?",
        confirmButtonText: "Evet, Gönderdim",
      });
      if (!isConfirmed) return;
    }

    try {
      await itemApi.handleAdminWithdrawal({ request_id: id, action, reason });
      toast.fire({ icon: "success", title: "İşlem tamamlandı." });
      fetchAdminData();
    } catch (e) {
      toast.fire({ icon: "error", title: "İşlem başarısız oldu." });
    }
  };

  // ================= ÇÖZÜM MERKEZİ =================
  const handleResolveDispute = async (bookingId, winner) => {
    const result = await cyberConfirm.fire({
      title: winner === "owner" ? "Satıcıyı Haklı Bul" : "Kiracıyı Haklı Bul",
      input: "textarea",
      inputPlaceholder: "Gerekçe giriniz...",
      showCancelButton: true,
      confirmButtonText: "⚖️ Onayla",
    });
    if (result.isConfirmed) {
      if (!result.value) return toast.fire({ icon: "warning", title: "Gerekçe zorunludur." });
      try {
        await itemApi.resolveDispute(bookingId, { winner, resolution_note: result.value });
        toast.fire({ icon: "success", title: "Depozito aktarıldı." });
        setSelectedDispute(null);
        fetchAdminData();
      } catch (error) {
        toast.fire({ icon: "error", title: "Hata oluştu" });
      }
    }
  };

  if (isUnauthorized) return <NotFound />;
  if (loading) return <div className="pt-20 text-center text-slate-500 font-mono animate-pulse">SİSTEM BAŞLATILIYOR...</div>;

  return (
    <div className="w-full relative selection:bg-rose-500/30 min-h-screen bg-[#0a0f16] pb-32">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* ÜST MENÜ */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-600 tracking-tighter">
            KOMUTA MERKEZİ
          </h1>
          <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 overflow-x-auto shadow-2xl">
            {["stats", "finances", "users", "items", "disputes", "logs"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors flex items-center gap-2 ${activeTab === tab ? "bg-slate-800 text-rose-400" : "text-slate-500 hover:text-slate-300"}`}>
                {tab === "stats"
                  ? "📊 İstatistik"
                  : tab === "finances"
                    ? "💸 Finans Onay"
                    : tab === "users"
                      ? "👥 Kullanıcılar"
                      : tab === "items"
                        ? "📦 İlanlar"
                        : tab === "disputes"
                          ? "🚨 Kriz Merkezi"
                          : "📋 Terminal"}
                {tab === "finances" && withdrawals.filter((w) => w.status === "PENDING").length > 0 && (
                  <span className="bg-emerald-500 text-slate-900 text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                    {withdrawals.filter((w) => w.status === "PENDING").length}
                  </span>
                )}
                {tab === "disputes" && disputes.length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{disputes.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ORTAK ARAMA ÇUBUĞU */}
        {["users", "items"].includes(activeTab) && (
          <div className="relative mb-6">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">🔍</span>
            <input
              type="text"
              placeholder="Veritabanında ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-xl pl-10 pr-4 py-3 focus:border-rose-500 outline-none"
            />
          </div>
        )}

        {/* 1. İSTATİSTİKLER */}
        {activeTab === "stats" && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <div className="text-emerald-500 text-xs font-black font-mono mb-2">Kullanıcı Cüzdanları</div>
                <div className="text-4xl font-black text-slate-100">₺{stats.finances.total_wallets}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <div className="text-blue-500 text-xs font-black font-mono mb-2">Havuzdaki Kira Bedelleri</div>
                <div className="text-4xl font-black text-slate-100">₺{stats.finances.pool_rent}</div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <div className="text-amber-500 text-xs font-black font-mono mb-2">Havuzdaki Depozitolar</div>
                <div className="text-4xl font-black text-slate-100">₺{stats.finances.pool_deposit}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 💸 2. FİNANS VE ÖDEME ONAYLARI */}
        {activeTab === "finances" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase text-slate-500 font-black border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Tarih</th>
                    <th className="px-6 py-4">Kullanıcı</th>
                    <th className="px-6 py-4">IBAN</th>
                    <th className="px-6 py-4">Tutar</th>
                    <th className="px-6 py-4 text-center">Durum / İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{w.created_at_formatted}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200">
                          {w.user_name} {w.user_surname}
                        </div>
                        <div className="text-[10px] text-slate-500">{w.user_email}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-indigo-300 text-xs tracking-wider">{w.iban}</td>
                      <td className="px-6 py-4 font-black text-emerald-400 text-lg">₺{w.amount}</td>
                      <td className="px-6 py-4 text-center">
                        {w.status === "PENDING" ? (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleWithdrawalAction(w.id, "approve")}
                              className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                              Onayla
                            </button>
                            <button
                              onClick={() => handleWithdrawalAction(w.id, "reject")}
                              className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                              Reddet
                            </button>
                          </div>
                        ) : w.status === "APPROVED" ? (
                          <span className="text-[10px] font-black tracking-widest text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            ÖDENDİ
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                            İPTAL EDİLDİ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {withdrawals.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-10 text-slate-500 font-mono">
                        Bekleyen finansal işlem bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* 👥 3. KULLANICILAR */}
        {activeTab === "users" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase text-slate-500 font-black border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Kullanıcı</th>
                    <th className="px-6 py-4">Kayıt</th>
                    <th className="px-6 py-4">Cüzdan</th>
                    <th className="px-6 py-4">Yetki</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {users.map((user) => (
                    <tr key={user.id} onClick={() => openUserGodMode(user)} className="hover:bg-slate-800/50 cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200 group-hover:text-indigo-400">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-slate-500">@{user.username}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{user.date_joined.split(" ")[0]}</td>
                      <td className="px-6 py-4 font-black text-emerald-500">₺{user.wallet_balance}</td>
                      <td className="px-6 py-4">
                        {user.is_staff ? (
                          <span className="bg-rose-500/10 text-rose-500 text-[9px] font-black px-2 py-1 rounded">ADMIN</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[9px] font-black px-2 py-1 rounded">USER</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* 📦 4. İLANLAR */}
        {activeTab === "items" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => openItemGodMode(item)}
                className="bg-slate-900 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/50 cursor-pointer shadow-xl flex gap-4 items-center">
                <img
                  src={item.images?.[0]?.image || "https://via.placeholder.com/80"}
                  alt="item"
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700"
                />
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-sm font-bold text-slate-200 truncate">{item.title}</h3>
                  <div className="text-[10px] text-slate-500 mt-1">@{item.owner_username}</div>
                  <div className="text-lg font-black text-slate-300 mt-1">₺{item.price_per_day}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* 🚨 5. KRİZ MERKEZİ */}
        {activeTab === "disputes" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disputes.map((booking) => (
              <div key={booking.id} className="bg-slate-900 p-5 rounded-2xl border border-rose-500/30 shadow-xl">
                <h3 className="text-sm font-bold text-slate-100">{booking.item_detail.title}</h3>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 my-4 text-sm text-slate-300 italic">
                  "{booking.dispute_reason}"
                </div>
                <button
                  onClick={() => setSelectedDispute(booking)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700">
                  Kanıtları Karşılaştır & Çöz
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {/* 📋 6. GLOBAL LOGLAR */}
        {activeTab === "logs" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-black/95 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 text-[10px] text-slate-500 font-mono">
              <span className="text-emerald-400">root@godmode</span>:/var/log/global.log
            </div>
            <div className="p-4 h-[600px] overflow-y-auto font-mono text-[11px] md:text-xs space-y-2 scrollbar-thin">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col md:flex-row md:items-start gap-1 md:gap-3 border-b border-slate-900/50 pb-1.5 hover:bg-slate-900/30">
                  <span className="text-slate-500 shrink-0">[{log.created_at_formatted}]</span>
                  <span className="shrink-0 font-bold w-32 text-indigo-400">{log.action_type}</span>
                  <span className="text-slate-400 w-24">@{log.username}</span>
                  <span className="text-slate-300 flex-1">{log.description}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ================= MODALLAR ================= */}

      {/* KULLANICI MODALI */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-3xl overflow-hidden my-8">
              <div className="bg-slate-950 border-b border-slate-800">
                <div className="p-6 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black text-indigo-400">@{selectedUser.username}</h2>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-slate-500 bg-slate-800 rounded-full w-8 h-8">
                    ✕
                  </button>
                </div>
                <div className="flex px-6 gap-6 text-sm font-bold">
                  <button
                    onClick={() => setUserModalTab("info")}
                    className={`pb-3 border-b-2 ${userModalTab === "info" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-500"}`}>
                    Genel Bilgiler
                  </button>
                  <button
                    onClick={() => setUserModalTab("items")}
                    className={`pb-3 border-b-2 ${userModalTab === "items" ? "border-emerald-500 text-emerald-400" : "border-transparent text-slate-500"}`}>
                    Açtığı İlanlar
                  </button>
                  <button
                    onClick={() => setUserModalTab("logs")}
                    className={`pb-3 border-b-2 ${userModalTab === "logs" ? "border-amber-500 text-amber-400" : "border-transparent text-slate-500"}`}>
                    Hareket Logları
                  </button>
                </div>
              </div>

              <div className="p-6">
                {userModalTab === "info" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Cüzdan Bakiyesi</label>
                        <input
                          type="number"
                          value={userForm.wallet_balance}
                          onChange={(e) => setUserForm({ ...userForm, wallet_balance: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-black text-xl rounded-xl p-3"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Güven Puanı</label>
                        <input
                          type="number"
                          step="0.1"
                          value={userForm.trust_score}
                          onChange={(e) => setUserForm({ ...userForm, trust_score: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 text-amber-400 font-black text-xl rounded-xl p-3"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="text-sm font-bold text-slate-200">Sistem Yöneticisi Yap</div>
                      <input
                        type="checkbox"
                        checked={userForm.is_staff}
                        onChange={(e) => setUserForm({ ...userForm, is_staff: e.target.checked })}
                        className="w-6 h-6 accent-indigo-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => requestDelete("user", selectedUser)}
                        className="px-6 py-3 bg-rose-500/10 text-rose-500 rounded-xl font-bold">
                        Kullanıcıyı Sil
                      </button>
                      <div className="flex-1"></div>
                      <button onClick={handleUpdateUser} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold">
                        Kaydet
                      </button>
                    </div>
                  </div>
                )}

                {userModalTab === "items" && (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
                    {items
                      .filter((i) => i.owner_username === selectedUser.username)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-xl">
                          <div className="text-sm text-slate-200 font-bold">{item.title}</div>
                          <button
                            onClick={() => {
                              setSelectedUser(null);
                              openItemGodMode(item);
                            }}
                            className="text-xs bg-slate-800 text-white px-3 py-2 rounded-lg">
                            İncele
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                {userModalTab === "logs" && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLogFilter("all")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${logFilter === "all" ? "bg-slate-800 text-white border-slate-700" : "text-slate-500 border-slate-800"}`}>
                        Tümü
                      </button>
                      <button
                        onClick={() => setLogFilter("wallet")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${logFilter === "wallet" ? "bg-emerald-900/50 text-emerald-400 border-emerald-800" : "text-slate-500 border-slate-800"}`}>
                        Cüzdan
                      </button>
                      <button
                        onClick={() => setLogFilter("operations")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${logFilter === "operations" ? "bg-blue-900/50 text-blue-400 border-blue-800" : "text-slate-500 border-slate-800"}`}>
                        Kiralama & İlan
                      </button>
                    </div>
                    <div className="bg-black/90 rounded-xl border border-slate-800 p-4 h-[350px] overflow-y-auto font-mono text-[11px] space-y-2 scrollbar-thin">
                      {selectedUserLogs
                        .filter((log) => {
                          if (logFilter === "wallet") return log.action_type.includes("PARA");
                          if (logFilter === "operations") return !log.action_type.includes("PARA");
                          return true;
                        })
                        .map((log) => (
                          <div key={log.id} className="flex gap-3 border-b border-slate-900/80 pb-2 hover:bg-slate-900/30">
                            <span className="text-slate-500 shrink-0">[{log.created_at_formatted}]</span>
                            <span
                              className={`shrink-0 font-bold w-24 ${log.action_type.includes("PARA") ? "text-emerald-400" : "text-blue-400"}`}>
                              {log.action_type}
                            </span>
                            <span className="text-slate-300 break-words">{log.description}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* İLAN MODALI */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-2xl overflow-hidden my-8">
              <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-start">
                <div className="flex gap-4">
                  <img src={selectedItem.images?.[0]?.image} className="w-16 h-16 rounded-xl object-cover" alt="img" />
                  <div>
                    <h2 className="text-lg font-black text-emerald-400">{selectedItem.title}</h2>
                    <div className="text-xs text-slate-500 font-mono mt-1">Sahibi: @{selectedItem.owner_username}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-slate-500 hover:text-white bg-slate-800 rounded-full w-8 h-8">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Fiyat (₺)</label>
                  <input
                    type="number"
                    value={itemForm.price_per_day}
                    onChange={(e) => setItemForm({ ...itemForm, price_per_day: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-emerald-400 font-black rounded-xl p-3"
                  />
                </div>

                <div className="flex gap-3 pt-6 border-t border-slate-800">
                  <button
                    onClick={() => requestDelete("item", selectedItem)}
                    className="px-6 py-3 bg-rose-500/10 text-rose-500 rounded-xl font-bold">
                    İlanı Sil
                  </button>
                  <div className="flex-1"></div>
                  <button onClick={handleUpdateItem} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold">
                    Kaydet
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DISPUTE (ANLAŞMAZLIK) MODALI - TAM KAPSAMLI EKLENDİ */}
      <AnimatePresence>
        {selectedDispute && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 shadow-2xl rounded-3xl w-full max-w-4xl overflow-hidden my-8">
              <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-black text-rose-400">🚨 Anlaşmazlık Dosyası</h2>
                <button onClick={() => setSelectedDispute(null)} className="text-slate-500 hover:text-white">
                  ✕ Kapat
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl">
                  <h3 className="text-[10px] text-rose-400 uppercase font-black mb-1">İtiraz Gerekçesi</h3>
                  <p className="text-slate-200 text-sm">"{selectedDispute.dispute_reason}"</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Teslimat */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <h4 className="font-bold text-indigo-400 mb-2 border-b border-slate-800 pb-2">📦 Teslimat (Kiracı)</h4>
                    <div className="text-xs text-slate-400 mb-2">Not: "{selectedDispute.handover_notes || "-"}"</div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedDispute.handover_images?.map((img) => (
                        <a key={img.id} href={img.image} target="_blank" rel="noreferrer">
                          <img
                            src={img.image}
                            className="w-full h-24 object-cover rounded border border-slate-700 hover:border-indigo-500"
                            alt="img"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                  {/* İade */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <h4 className="font-bold text-fuchsia-400 mb-2 border-b border-slate-800 pb-2">🔄 İade (Satıcı)</h4>
                    <div className="text-xs text-slate-400 mb-2">Not: "{selectedDispute.return_notes || "-"}"</div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedDispute.return_images?.map((img) => (
                        <a key={img.id} href={img.image} target="_blank" rel="noreferrer">
                          <img
                            src={img.image}
                            className="w-full h-24 object-cover rounded border border-slate-700 hover:border-fuchsia-500"
                            alt="img"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => handleResolveDispute(selectedDispute.id, "owner")}
                    className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500 hover:bg-emerald-500 hover:text-white py-3 rounded-xl font-bold transition-all">
                    Satıcı Haklı (Hasar Var)
                  </button>
                  <button
                    onClick={() => handleResolveDispute(selectedDispute.id, "renter")}
                    className="flex-1 bg-blue-500/10 text-blue-400 border border-blue-500 hover:bg-blue-500 hover:text-white py-3 rounded-xl font-bold transition-all">
                    Kiracı Haklı (Sorunsuz)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= PENDING ACTION BAR (GERİ ALMA BARI) ================= */}
      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-slate-800 text-white border border-slate-700 shadow-2xl px-6 py-4 rounded-2xl flex items-center gap-6">
            <div>
              <div className="font-bold">{pendingAction.type === "user" ? "Kullanıcı" : "İlan"} siliniyor...</div>
              <div className="text-xs text-slate-400">İşlem 5 saniye içinde tamamlanacak.</div>
            </div>
            <button
              onClick={undoDelete}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black px-4 py-2 rounded-xl transition-colors shadow-lg shadow-emerald-500/20">
              Geri Al (Undo)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
