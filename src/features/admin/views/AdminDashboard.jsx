import React, { useEffect, useState } from "react";
import { itemApi } from "../../items/services/itemApi";
import { motion, AnimatePresence } from "framer-motion";
import { toast, cyberConfirm } from "../../../utils/alerts";
import NotFound from "../../components/NotFound";
import { useNavigate, useSearchParams } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // URL tab hafızası
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "stats");

  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, setSearchParams]);

  // VERİ STATE'LERİ
  const [stats, setStats] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reports, setReports] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tickets, setTickets] = useState([]);

  // FİLTRE VE ARAMA
  const [searchQuery, setSearchQuery] = useState("");
  const [bannedFilter, setBannedFilter] = useState("all");

  // MODAL STATE'LERİ
  const [pendingAction, setPendingAction] = useState(null);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: "" });

  const [supportModal, setSupportModal] = useState({ isOpen: false, type: null, data: null });
  const [supportReplyText, setSupportReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  // 🎯 YENİ: Anlaşmazlık fotoğraflarına tıklayınca büyütmek için
  const [previewImage, setPreviewImage] = useState(null);

  const openSupportModal = (type, data) => {
    setSupportModal({ isOpen: true, type, data });
    setSupportReplyText("");
  };

  const handleSendSupportReply = async (e) => {
    e.preventDefault();
    if (!supportReplyText.trim()) return toast.fire({ icon: "warning", title: "Lütfen bir mesaj yazın." });

    setIsReplying(true);
    try {
      const targetUsername = supportModal.type === "ticket" ? supportModal.data.user_username : supportModal.data.reporter_username;
      const targetUser = users.find((u) => u.username === targetUsername);

      if (!targetUser) throw new Error("Kullanıcı sistemde bulunamadı.");

      await itemApi.replyToSupport({
        user_id: targetUser.id,
        message: supportReplyText,
        ticket_id: supportModal.type === "ticket" ? supportModal.data.id : null,
      });

      toast.fire({ icon: "success", title: "Yanıtınız iletildi." });
      setSupportModal({ isOpen: false, type: null, data: null });
      fetchAdminData();
    } catch (error) {
      toast.fire({ icon: "error", title: "Mesaj gönderilemedi." });
    } finally {
      setIsReplying(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [statsData, disputesData, usersData, itemsData, logsData, withdrawalsData, categoriesData, reportsData] = await Promise.all([
        itemApi.getAdminStats(),
        itemApi.getDisputedBookings(),
        itemApi.getAdminUsers(searchQuery),
        itemApi.getAdminItems(searchQuery),
        itemApi.getSystemLogs(),
        itemApi.getAdminWithdrawals(),
        itemApi.getCategories(),
        itemApi.getAdminReports(),
      ]);

      setStats(statsData);
      setDisputes(disputesData);
      setUsers(usersData);
      setItems(itemsData);
      setLogs(logsData);
      setWithdrawals(withdrawalsData);
      setCategories(categoriesData);
      setReports(reportsData);

      try {
        setBookings(await itemApi.getAdminBookings());
      } catch (e) {
        setBookings([]);
      }
      try {
        setReviews(await itemApi.getAdminReviews());
      } catch (e) {
        setReviews([]);
      }
      try {
        setTickets(await itemApi.getAdminTickets());
      } catch (e) {
        setTickets([]);
      }
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

  const executeDeleteAPI = async (type, id) => {
    try {
      if (type === "user") await itemApi.adminDeleteUser(id);
      if (type === "item") await itemApi.adminDeleteItem(id);
      if (type === "category") await itemApi.deleteCategory(id);
      if (type === "booking") await itemApi.adminDeleteBooking(id);
      if (type === "review") await itemApi.adminDeleteReview(id);
      toast.fire({ icon: "success", title: "Kalıcı olarak silindi." });
      fetchAdminData();
    } catch (e) {
      toast.fire({ icon: "error", title: "Silme başarısız." });
      fetchAdminData();
    }
    setPendingAction(null);
  };

  const requestDelete = async (type, obj) => {
    const titleMap = {
      user: "Kullanıcıyı Sil",
      item: "İlanı Sil",
      category: "Kategoriyi Sil",
      booking: "Rezervasyonu Sil",
      review: "Yorumu Sil",
    };
    const result = await cyberConfirm.fire({
      title: titleMap[type],
      text: "Silinen veri geri getirilemez. 5 saniye içinde iptal edebilirsiniz.",
      icon: "warning",
      confirmButtonText: "Sil",
      confirmButtonColor: "#e11d48",
    });

    if (result.isConfirmed) {
      setIsCategoryModalOpen(false);
      if (type === "user") setUsers((p) => p.filter((u) => u.id !== obj.id));
      if (type === "item") setItems((p) => p.filter((i) => i.id !== obj.id));
      if (type === "category") setCategories((p) => p.filter((c) => c.id !== obj.id));
      if (type === "booking") setBookings((p) => p.filter((b) => b.id !== obj.id));
      if (type === "review") setReviews((p) => p.filter((r) => r.id !== obj.id));

      const timeoutId = setTimeout(() => {
        executeDeleteAPI(type, obj.id);
      }, 5000);
      setPendingAction({ type, obj, timeoutId });
    }
  };

  const undoDelete = () => {
    if (!pendingAction) return;
    clearTimeout(pendingAction.timeoutId);
    if (pendingAction.type === "user") setUsers((p) => [pendingAction.obj, ...p]);
    if (pendingAction.type === "item") setItems((p) => [pendingAction.obj, ...p]);
    if (pendingAction.type === "category") setCategories((p) => [pendingAction.obj, ...p]);
    if (pendingAction.type === "booking") setBookings((p) => [pendingAction.obj, ...p]);
    if (pendingAction.type === "review") setReviews((p) => [pendingAction.obj, ...p]);
    setPendingAction(null);
    toast.fire({ icon: "info", title: "Silme işlemi geri alındı." });
  };

  const openCategoryModal = (cat = null) => {
    setSelectedCategory(cat);
    setCategoryForm(cat ? { name: cat.name } : { name: "" });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return toast.fire({ icon: "warning", title: "Kategori adı boş olamaz." });
    try {
      if (selectedCategory) {
        await itemApi.updateCategory(selectedCategory.id, categoryForm);
        toast.fire({ icon: "success", title: "Kategori güncellendi." });
      } else {
        await itemApi.createCategory(categoryForm);
        toast.fire({ icon: "success", title: "Yeni kategori eklendi." });
      }
      setIsCategoryModalOpen(false);
      fetchAdminData();
    } catch (e) {
      toast.fire({ icon: "error", title: "İşlem başarısız." });
    }
  };

  const handleWithdrawalAction = async (id, action) => {
    let reason = "";
    if (action === "reject") {
      const { value, isConfirmed } = await cyberConfirm.fire({
        title: "Talebi Reddet",
        input: "text",
        inputPlaceholder: "Sebep girin...",
        showCancelButton: true,
        confirmButtonText: "Reddet ve İade Et",
      });
      if (!isConfirmed) return;
      if (!value) return toast.fire({ icon: "warning", title: "Sebep giriniz." });
      reason = value;
    } else {
      const { isConfirmed } = await cyberConfirm.fire({
        title: "EFT Onayı",
        text: "Parayı gönderdiğinizi onaylıyor musunuz?",
        confirmButtonText: "Evet, Gönderdim",
      });
      if (!isConfirmed) return;
    }
    try {
      await itemApi.handleAdminWithdrawal({ request_id: id, action, reason });
      toast.fire({ icon: "success", title: "İşlem tamamlandı." });
      fetchAdminData();
    } catch (e) {
      toast.fire({ icon: "error", title: "Başarısız oldu." });
    }
  };

  const handleResolveDispute = async (bookingId, winner) => {
    const { value, isConfirmed } = await cyberConfirm.fire({
      title: winner === "owner" ? "Satıcı Haklı" : "Kiracı Haklı",
      input: "textarea",
      inputPlaceholder: "Yöneticinin Karar Gerekçesi (Kullanıcılara iletilecek)...",
      showCancelButton: true,
      confirmButtonText: "Kararı Onayla",
    });
    if (isConfirmed && value) {
      try {
        await itemApi.resolveDispute(bookingId, { winner, resolution_note: value });
        toast.fire({ icon: "success", title: "Anlaşmazlık Çözüldü." });
        setSelectedDispute(null);
        fetchAdminData();
      } catch (e) {
        toast.fire({ icon: "error", title: "Hata" });
      }
    } else if (isConfirmed) toast.fire({ icon: "warning", title: "Gerekçe zorunludur." });
  };

  const handleLogout = async () => {
    const result = await cyberConfirm.fire({
      title: "Çıkış Yap",
      text: "Sistemden çıkış yapmak istediğinize emin misiniz?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Evet, Çıkış Yap",
      cancelButtonText: "İptal",
    });
    if (result.isConfirmed) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      navigate("/login");
    }
  };

  const getBannedUsers = () => users.filter((u) => u.banned_until || u.is_active === false);
  const getBannedItems = () => items.filter((i) => i.is_banned);

  if (isUnauthorized) return <NotFound />;
  if (loading)
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-blue-500 font-bold animate-pulse">
        SİSTEM BAŞLATILIYOR...
      </div>
    );

  const TABS = [
    { id: "stats", label: "Dashboard", icon: "📊" },
    { id: "finances", label: "Finans Yönetimi", icon: "💳" },
    { id: "tickets", label: "Destek Biletleri", icon: "🎫" },
    { id: "reports", label: "Şikayetler", icon: "🚩" },
    { id: "users", label: "Kullanıcılar", icon: "👥" },
    { id: "items", label: "İlanlar", icon: "📦" },
    { id: "bookings", label: "Kiralamalar", icon: "🤝" },
    { id: "reviews", label: "Yorumlar", icon: "⭐" },
    { id: "disputes", label: "Çözüm Merkezi", icon: "⚖️" },
    { id: "banned", label: "Yasaklılar", icon: "🚫" },
    { id: "categories", label: "Kategoriler", icon: "📂" },
    { id: "logs", label: "Sistem Logları", icon: "📋" },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0 shadow-sm z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 cursor-default select-none">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30">
              <span className="text-white text-lg font-black">R</span>
            </div>
            <span className="text-xl font-black tracking-tight text-slate-800">
              Rent<span className="text-blue-600">Circle</span>
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 scrollbar-hide">
          <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3 ml-2">Yönetim Menüsü</div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
              }`}>
              <span className="text-base opacity-90">{tab.icon}</span>
              {tab.label}
              {tab.id === "finances" && withdrawals.filter((w) => w.status === "PENDING").length > 0 && (
                <span className="ml-auto bg-amber-400 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                  {withdrawals.filter((w) => w.status === "PENDING").length}
                </span>
              )}
              {tab.id === "reports" && reports.filter((r) => r.status === "pending").length > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                  {reports.filter((r) => r.status === "pending").length}
                </span>
              )}
              {tab.id === "tickets" && tickets.filter((t) => t.status === "open").length > 0 && (
                <span className="ml-auto bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                  {tickets.filter((t) => t.status === "open").length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 space-y-2 bg-slate-50/50">
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer active:scale-95">
            <span>🌍</span> Vitrine Dön
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 text-rose-600 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer active:scale-95">
            <span>🚪</span> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* ANA İÇERİK */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2.5 w-96 border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all shadow-inner">
            <span className="text-slate-400 mr-2">🔍</span>
            <input
              type="text"
              placeholder="Modellerde arama yap..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm text-slate-700 placeholder-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-sm font-bold text-slate-800">Sistem Yöneticisi</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Yetkili Hesap</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-white shadow-md">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-slate-300">
          {/* TAB 1: STATS */}
          {activeTab === "stats" && stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                  💰
                </div>
                <div className="text-slate-500 text-sm font-semibold mb-1">Kullanıcı Cüzdanları</div>
                <div className="text-3xl font-black text-slate-800">₺{stats.finances.total_wallets}</div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                  🔄
                </div>
                <div className="text-slate-500 text-sm font-semibold mb-1">Havuzdaki Kira Bedeli</div>
                <div className="text-3xl font-black text-slate-800">₺{stats.finances.pool_rent}</div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                  🛡️
                </div>
                <div className="text-slate-500 text-sm font-semibold mb-1">Havuzdaki Depozitolar</div>
                <div className="text-3xl font-black text-slate-800">₺{stats.finances.pool_deposit}</div>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCES */}
          {activeTab === "finances" && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Bekleyen Finansal İşlemler</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Tarih</th>
                      <th className="px-6 py-4">Kullanıcı</th>
                      <th className="px-6 py-4">IBAN</th>
                      <th className="px-6 py-4">Tutar</th>
                      <th className="px-6 py-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{w.created_at_formatted}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">
                            {w.user_name} {w.user_surname}
                          </div>
                          <div className="text-[11px] text-slate-500">{w.user_email}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-blue-600 text-xs">{w.iban}</td>
                        <td className="px-6 py-4 font-black text-slate-800 text-lg">₺{w.amount}</td>
                        <td className="px-6 py-4 text-center">
                          {w.status === "PENDING" ? (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleWithdrawalAction(w.id, "approve")}
                                className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer">
                                ONAYLA
                              </button>
                              <button
                                onClick={() => handleWithdrawalAction(w.id, "reject")}
                                className="bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer">
                                REDDET
                              </button>
                            </div>
                          ) : w.status === "APPROVED" ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">ÖDENDİ</span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">İPTAL EDİLDİ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TICKETS */}
          {activeTab === "tickets" && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Kullanıcı Destek Talepleri (Tickets)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Bilet No / Tarih</th>
                      <th className="px-6 py-4">Kullanıcı</th>
                      <th className="px-6 py-4">Konu</th>
                      <th className="px-6 py-4 w-1/3">Mesaj</th>
                      <th className="px-6 py-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs font-bold text-slate-700 mb-1">
                            #{String(t.id).substring(0, 6).toUpperCase()}
                          </div>
                          <div className="text-[11px] text-slate-400">{t.created_at_formatted}</div>
                        </td>
                        <td className="px-6 py-4 font-bold text-indigo-600">@{t.user_username}</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{t.topic_display}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700 text-sm">{t.subject}</div>
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{t.description}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => openSupportModal("ticket", t)}
                            className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg transition-colors border border-indigo-200 hover:bg-indigo-600 hover:text-white">
                            İncele & Yanıtla
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tickets.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-slate-400 font-medium text-sm">
                          Bekleyen destek talebi bulunmuyor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: REPORTS */}
          {activeTab === "reports" && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Gelen Şikayet Raporları</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Tarih / Gönderen</th>
                      <th className="px-6 py-4">Hedef</th>
                      <th className="px-6 py-4 w-1/3">Sebep</th>
                      <th className="px-6 py-4 text-center">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-[11px] text-slate-400 mb-1">{rep.created_at_formatted}</div>
                          <div className="font-bold text-slate-700">@{rep.reporter_username}</div>
                        </td>
                        <td className="px-6 py-4">
                          {rep.target_type === "item" ? (
                            <>
                              <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded font-bold mr-2">İLAN</span>
                              <span className="font-semibold text-slate-700">{rep.reported_item_title}</span>
                            </>
                          ) : (
                            <>
                              <span className="bg-fuchsia-50 text-fuchsia-600 text-[10px] px-2 py-0.5 rounded font-bold mr-2">
                                KULLANICI
                              </span>
                              <span className="font-semibold text-slate-700">@{rep.reported_username}</span>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-rose-500 text-sm">{rep.reason}</div>
                          {rep.description && <div className="text-xs text-slate-500 mt-1 italic">"{rep.description}"</div>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {rep.status === "pending" ? (
                            <div className="flex justify-center items-center">
                              <button
                                onClick={() =>
                                  navigate(
                                    rep.target_type === "item"
                                      ? `/admin-dashboard/items/${rep.reported_item}`
                                      : `/admin-dashboard/users/${rep.reported_user}`,
                                  )
                                }
                                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm">
                                Profili İncele
                              </button>
                              <button
                                onClick={() => openSupportModal("report", rep)}
                                className="bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm ml-2">
                                Mesaj At
                              </button>
                            </div>
                          ) : rep.status === "resolved" ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">İŞLEM YAPILDI</span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">REDDEDİLDİ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reports.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-10 text-slate-400 font-medium text-sm">
                          Bekleyen şikayet bulunmuyor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: USERS */}
          {activeTab === "users" && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Tüm Kullanıcılar</h3>
              </div>
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Kullanıcı Bilgileri</th>
                    <th className="px-6 py-4">Cüzdan</th>
                    <th className="px-6 py-4">Yetki</th>
                    <th className="px-6 py-4 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="px-6 py-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-xs text-slate-400">@{user.username}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-700 text-lg">₺{user.wallet_balance}</td>
                      <td className="px-6 py-4">
                        {user.is_staff ? (
                          <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-full">YÖNETİCİ</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full">ÜYE</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/admin-dashboard/users/${user.id}`)}
                          className="text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-200 px-4 py-2 rounded-lg font-bold transition-all shadow-sm">
                          İncele
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 6: ITEMS */}
          {activeTab === "items" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all flex flex-col group relative">
                  <div className="flex gap-4 items-center mb-4">
                    <img
                      src={item.images?.[0]?.image || "https://via.placeholder.com/80"}
                      alt="item"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-100"
                    />
                    <div className="flex-1 overflow-hidden">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{item.title}</h3>
                      <div className="text-xs text-slate-400 mt-1">@{item.owner_username}</div>
                      <div className="text-lg font-black text-slate-800 mt-1">₺{item.price_per_day}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/admin-dashboard/items/${item.id}`)}
                    className="w-full bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white font-bold text-xs py-2.5 rounded-xl border border-emerald-200 transition-colors shadow-sm">
                    Detaylı İncele
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 7: CATEGORIES */}
          {activeTab === "categories" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => openCategoryModal()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 text-sm flex items-center gap-2">
                  <span>➕</span> Yeni Kategori
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{cat.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">/{cat.slug}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openCategoryModal(cat)}
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors">
                        ✎
                      </button>
                      <button
                        onClick={() => requestDelete("category", cat)}
                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: BOOKINGS */}
          {activeTab === "bookings" && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Tüm Kiralamalar</h3>
              </div>
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Kiralama ID</th>
                    <th className="px-6 py-4">Ürün</th>
                    <th className="px-6 py-4">Süreç</th>
                    <th className="px-6 py-4 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">#{booking.id.split("-")[0]}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{booking.item_detail?.title || "Bilinmiyor"}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">{booking.status}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => requestDelete("booking", booking)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline">
                          SİL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 9: REVIEWS */}
          {activeTab === "reviews" && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700">Tüm Yorumlar</h3>
              </div>
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Kullanıcı</th>
                    <th className="px-6 py-4">Ürün</th>
                    <th className="px-6 py-4 w-1/2">Yorum & Puan</th>
                    <th className="px-6 py-4 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reviews.map((review) => (
                    <tr key={review.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">@{review.reviewer_username}</td>
                      <td className="px-6 py-4 font-semibold text-slate-600">{review.item_title || "Bilinmiyor"}</td>
                      <td className="px-6 py-4">
                        <div className="text-amber-500 text-xs mb-1">{"⭐".repeat(review.rating)}</div>
                        <div className="text-slate-500 italic">"{review.comment}"</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => requestDelete("review", review)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline">
                          SİL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 10: DISPUTES (ÇÖZÜM MERKEZİ) */}
          {activeTab === "disputes" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {disputes.map((booking) => (
                <div key={booking.id} className="bg-white p-6 rounded-3xl border border-rose-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full blur-xl pointer-events-none"></div>
                  <div className="text-[10px] font-black tracking-widest text-rose-500 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>AÇIK ANLAŞMAZLIK
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4">{booking.item_detail.title}</h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-5">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Şikayet Nedeni</div>
                    <div className="text-sm text-slate-600 italic">"{booking.dispute_reason}"</div>
                  </div>
                  <button
                    onClick={() => setSelectedDispute(booking)}
                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl shadow-md shadow-rose-500/20 active:scale-95 transition-all">
                    Dosyayı İncele ve Karar Ver
                  </button>
                </div>
              ))}
              {disputes.length === 0 && (
                <div className="col-span-full p-10 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 border-dashed">
                  Şu an için inceleme bekleyen bir uyuşmazlık bulunmuyor. 🎉
                </div>
              )}
            </div>
          )}

          {/* TAB 11: BANNED */}
          {activeTab === "banned" && (
            <div className="space-y-6">
              <div className="flex gap-2">
                {["all", "permanent", "temporary"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setBannedFilter(f)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      bannedFilter === f
                        ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
                        : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                    }`}>
                    {f === "all" ? "Tümü" : f === "permanent" ? "Süresiz Yasaklılar" : "Süreli Cezalılar"}
                  </button>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-rose-600">Yasaklı Hesap ve İlanlar</h3>
                </div>
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Tip</th>
                      <th className="px-6 py-4">Kim / Ne</th>
                      <th className="px-6 py-4 w-1/3">Ban Sebebi</th>
                      <th className="px-6 py-4">Ceza Bitiş</th>
                      <th className="px-6 py-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getBannedUsers().map((u) => (
                      <tr key={`user-${u.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="bg-fuchsia-50 text-fuchsia-600 px-2 py-1 rounded text-[10px] font-black">KULLANICI</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700">@{u.username}</td>
                        <td className="px-6 py-4 text-xs text-rose-500 font-medium">{u.ban_reason || "Sebep belirtilmemiş."}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {!u.is_active ? "SÜRESİZ BAN" : new Date(u.banned_until).toLocaleDateString("tr-TR")}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => navigate(`/admin-dashboard/users/${u.id}`)}
                            className="text-emerald-500 hover:underline font-bold text-xs">
                            Detay
                          </button>
                        </td>
                      </tr>
                    ))}
                    {getBannedItems().map((i) => (
                      <tr key={`item-${i.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[10px] font-black">İLAN</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700 truncate max-w-[200px]">{i.title}</td>
                        <td className="px-6 py-4 text-xs text-rose-500 font-medium">{i.ban_reason || "Kurallara aykırı içerik."}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {i.banned_until ? new Date(i.banned_until).toLocaleDateString("tr-TR") : "Bilinmiyor"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => navigate(`/admin-dashboard/items/${i.id}`)}
                            className="text-emerald-500 hover:underline font-bold text-xs">
                            Detay
                          </button>
                        </td>
                      </tr>
                    ))}
                    {getBannedUsers().length === 0 && getBannedItems().length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-slate-400 font-medium text-sm">
                          Sistemde yasaklı kimse bulunmuyor. Temiz!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 12: LOGS */}
          {activeTab === "logs" && (
            <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-xl">
              <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 text-xs text-slate-400 font-mono flex items-center justify-between">
                <div>
                  <span className="text-emerald-400">admin</span>@server:~/logs$ tail -f system.log
                </div>
              </div>
              <div className="p-5 h-[600px] overflow-y-auto font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-slate-600 text-slate-300">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-4 border-b border-slate-700/50 pb-2 hover:bg-slate-700/30 transition-colors">
                    <span className="text-slate-500 shrink-0">[{log.created_at_formatted}]</span>
                    <span className="shrink-0 font-bold w-32 text-blue-400">{log.action_type}</span>
                    <span className="text-slate-400 w-28 shrink-0">@{log.username}</span>
                    <span className="text-slate-200 flex-1">{log.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ======================= MODALLAR ======================= */}

      {/* DESTEK YANIT MODALI */}
      <AnimatePresence>
        {supportModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white shadow-2xl rounded-3xl w-full max-w-2xl my-8 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  {supportModal.type === "ticket" ? "🎫 Destek Biletini Yanıtla" : "🚩 Şikayeti Yanıtla"}
                </h2>
                <button
                  onClick={() => setSupportModal({ isOpen: false, type: null, data: null })}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg">
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="bg-slate-100 p-5 rounded-2xl border border-slate-200 mb-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Gönderen: @{supportModal.type === "ticket" ? supportModal.data.user_username : supportModal.data.reporter_username}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">{supportModal.data.created_at_formatted}</div>
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">
                    {supportModal.type === "ticket" ? supportModal.data.subject : `Şikayet Sebebi: ${supportModal.data.reason}`}
                  </h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{supportModal.data.description}</p>

                  {(supportModal.data.attachment || supportModal.data.proof_image) && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">Eklenen Kanıt / Görsel</div>
                      <img
                        src={supportModal.data.attachment || supportModal.data.proof_image}
                        alt="Kanıt"
                        className="w-full max-h-64 object-contain bg-slate-200 rounded-xl border border-slate-300 cursor-zoom-in"
                        onClick={() => setPreviewImage(supportModal.data.attachment || supportModal.data.proof_image)}
                      />
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendSupportReply} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      RentCircle Destek Olarak Yanıtla
                    </label>
                    <textarea
                      rows="4"
                      required
                      placeholder="Kullanıcıya iletilecek resmi sistem mesajını buraya yazın..."
                      value={supportReplyText}
                      onChange={(e) => setSupportReplyText(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-blue-500 text-slate-800 text-sm rounded-xl p-4 outline-none resize-none transition-colors"></textarea>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSupportModal({ isOpen: false, type: null, data: null })}
                      className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl text-xs transition-colors">
                      İptal
                    </button>
                    <div className="flex-1"></div>
                    <button
                      type="submit"
                      disabled={isReplying}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                      {isReplying ? "Gönderiliyor..." : "Mesajı Gönder 🚀"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* KATEGORİ MODALI */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white shadow-2xl rounded-3xl w-full max-w-md overflow-hidden">
              <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">{selectedCategory ? "Kategori Düzenle" : "Yeni Kategori Ekle"}</h2>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Kategori Adı</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ name: e.target.value })}
                    className="w-full border border-slate-200 focus:border-blue-500 text-slate-800 font-medium text-sm rounded-xl p-3 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl text-xs transition-colors">
                    İptal
                  </button>
                  <div className="flex-1"></div>
                  <button
                    onClick={handleSaveCategory}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95">
                    Kaydet
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🎯 GELİŞTİRİLMİŞ ÇÖZÜM MERKEZİ MODALI (FOTOĞRAFLI) */}
      <AnimatePresence>
        {selectedDispute && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white shadow-2xl rounded-3xl w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto relative">
              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-rose-500">🚨</span> Anlaşmazlık: {selectedDispute.item_detail?.title}
              </h2>

              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 mb-6">
                <div className="text-[10px] uppercase font-bold text-rose-500 mb-1">Şikayet Nedeni</div>
                <div className="text-sm text-slate-700 font-medium">"{selectedDispute.dispute_reason}"</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* 📦 KİRACI TESLİMAT KANITLARI */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">Kiracının Teslimat Kanıtları</div>
                  <p className="text-xs text-slate-600 italic mb-3">Not: {selectedDispute.handover_notes || "Not bırakılmamış."}</p>

                  {selectedDispute.handover_images && selectedDispute.handover_images.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedDispute.handover_images.map((img, i) => (
                        <img
                          key={i}
                          src={img.image || img}
                          onClick={() => setPreviewImage(img.image || img)}
                          className="w-16 h-16 object-cover rounded-lg border border-slate-300 cursor-zoom-in hover:scale-105 transition-transform shadow-sm"
                          alt="teslimat kanıtı"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 font-mono">Fotoğraf yüklenmemiş.</div>
                  )}
                </div>

                {/* 🔄 SATICI İADE KANITLARI */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">Satıcının İade Kanıtları</div>
                  <p className="text-xs text-slate-600 italic mb-3">Not: {selectedDispute.return_notes || "Not bırakılmamış."}</p>

                  {selectedDispute.return_images && selectedDispute.return_images.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedDispute.return_images.map((img, i) => (
                        <img
                          key={i}
                          src={img.image || img}
                          onClick={() => setPreviewImage(img.image || img)}
                          className="w-16 h-16 object-cover rounded-lg border border-slate-300 cursor-zoom-in hover:scale-105 transition-transform shadow-sm"
                          alt="iade kanıtı"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 font-mono">Fotoğraf yüklenmemiş.</div>
                  )}
                </div>
              </div>

              {/* KARAR BUTONLARI */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleResolveDispute(selectedDispute.id, "owner")}
                  className="flex-1 min-w-[140px] bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-200 py-3 rounded-xl font-bold text-xs transition-colors">
                  Satıcı Haklı
                </button>
                <button
                  onClick={() => handleResolveDispute(selectedDispute.id, "renter")}
                  className="flex-1 min-w-[140px] bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 py-3 rounded-xl font-bold text-xs transition-colors">
                  Kiracı Haklı
                </button>
                <button
                  onClick={() => setSelectedDispute(null)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition-colors">
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SİLME GERİ ALMA TOAST'I */}
      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-slate-800 text-white shadow-2xl px-6 py-4 rounded-2xl flex items-center gap-6">
            <div>
              <div className="font-bold text-sm text-white">İşlem siliniyor...</div>
              <div className="text-xs text-slate-400 mt-0.5">5 saniye içinde tamamlanacak.</div>
            </div>
            <button
              onClick={undoDelete}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-2 rounded-lg shadow-md transition-colors text-xs">
              Geri Al
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎯 LIGHTBOX (RESİM BÜYÜTME) MODALI */}
      <AnimatePresence>
        {previewImage && (
          <div
            className="fixed inset-0 z-[250] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setPreviewImage(null)}>
            <button className="absolute top-6 right-6 btn-slate !font-mono tracking-widest z-20">KAPAT [ESC]</button>
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={previewImage}
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl border border-slate-700/50 cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
