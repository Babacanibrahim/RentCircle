import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { itemApi } from "../services/itemApi";
import { toast, cyberConfirm } from "../../../utils/alerts";

// 🎯 YENİ HARİTA İMPORTLARI
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

// Leaflet Varsayılan İkon Ayarı
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ChangeMapCenter = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// Haritaya tıklanınca adresi çeken akıllı bileşen
const MapClickHandler = ({ setMapPosition, setLocationAddress, setModalMapCenter }) => {
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setMapPosition([lat, lng]);
      if (setModalMapCenter) setModalMapCenter([lat, lng]);

      try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
        const addr = response.data.address;

        let street = (addr.road || addr.pedestrian || "").trim();
        let region = (addr.neighbourhood || addr.suburb || "").trim();
        let dist = (addr.district || addr.town || "").trim();

        let fullAddr = [street, region, dist].filter(Boolean).join(", ");
        setLocationAddress(fullAddr || response.data.display_name || "Bilinmeyen Konum");
      } catch (error) {
        console.error("Adres alınamadı", error);
      }
    },
  });
  return null;
};

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const messagesEndRef = useRef(null);

  // 🎯 YENİ LOKASYON STATE'LERİ
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalMapCenter, setModalMapCenter] = useState([37.7765, 29.0864]); // Varsayılan Denizli
  const [mapPosition, setMapPosition] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationNote, setLocationNote] = useState("");

  // 🎯 YENİ ARAMA STATE'LERİ
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Arama çubuğu temizlendiğinde sonuçları da temizle
  useEffect(() => {
    if (!searchQuery.trim()) setSearchResults([]);
  }, [searchQuery]);

  useEffect(() => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (token) {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(window.atob(base64));
        setCurrentUserId(String(payload.user_id).toLowerCase());
      } catch (e) {
        console.error("Token çözümlenemedi:", e);
      }
    } else {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await itemApi.getConversations();
        const chatList = data.results ? data.results : data;
        setConversations(chatList);

        const convId = searchParams.get("conv_id");
        const newItemId = searchParams.get("new_item");
        const newItemTitle = searchParams.get("title");

        if (convId && !activeChat) {
          const found = chatList.find((c) => String(c.id) === convId);
          if (found) setActiveChat(found);
        } else if (newItemId && !activeChat) {
          setActiveChat({
            isNew: true,
            item_id: newItemId,
            item_title: newItemTitle,
            owner_name: "Satıcı",
            item_image: null,
            unread_count: 0,
          });
        }
      } catch (err) {
        console.error("Sohbetler yüklenemedi:", err);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [searchParams]);

  useEffect(() => {
    let interval;
    if (activeChat && !activeChat.isNew) {
      let currentMsgCount = 0;
      const fetchMessages = () => {
        itemApi
          .getMessages(activeChat.id)
          .then((data) => {
            const fetchedMessages = data.results ? data.results : data;
            setMessages(fetchedMessages);
            if (fetchedMessages.length > currentMsgCount) {
              currentMsgCount = fetchedMessages.length;
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }
          })
          .catch((err) => console.error("Mesajlar güncellenemedi:", err));
      };

      fetchMessages();
      interval = setInterval(fetchMessages, 3000);
    } else if (activeChat && activeChat.isNew) {
      setMessages([]);
    }
    return () => clearInterval(interval);
  }, [activeChat]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const messageContent = newMessage;
    setNewMessage("");

    try {
      if (activeChat.isNew) {
        const result = await itemApi.sendDirectMessage({
          item_id: activeChat.item_id,
          content: messageContent,
          is_offer: false,
        });
        navigate(`/chat?conv_id=${result.conversation_id}`, { replace: true });
      } else {
        const sentMessage = await itemApi.sendMessage(activeChat.id, { content: messageContent });
        setMessages((prev) => [...prev, sentMessage]);

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);

        const updatedChats = await itemApi.getConversations();
        setConversations(updatedChats.results ? updatedChats.results : updatedChats);
      }
    } catch (error) {
      toast.fire({ icon: "error", title: "Mesajınız iletilemedi. Lütfen bağlantınızı kontrol edin." });
      setNewMessage(messageContent);
    }
  };

  // 🎯 YENİ: MEKAN / ADRES ARAMA FONKSİYONU
  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // Sadece Türkiye içindeki sonuçları getirmesi için countrycodes=tr eklendi
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=tr&limit=5`,
      );
      setSearchResults(res.data);
      if (res.data.length === 0) {
        toast.fire({ icon: "info", title: "Sonuç bulunamadı. Lütfen daha genel bir arama yapın." });
      }
    } catch (error) {
      toast.fire({ icon: "error", title: "Arama yapılırken hata oluştu." });
    } finally {
      setIsSearching(false);
    }
  };

  // 🎯 YENİ: ARAMA SONUCUNDAN MEKAN SEÇME
  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setMapPosition([lat, lon]);
    setModalMapCenter([lat, lon]);

    // Adres alanına mekanın kısa adını veya tam adresini yaz
    setLocationAddress(result.name || result.display_name.split(",")[0]);
    setSearchResults([]); // Listeyi kapat
  };

  const handleSendLocation = async () => {
    if (!mapPosition) return toast.fire({ icon: "warning", title: "Lütfen haritadan bir buluşma noktası seçin." });

    const payload = {
      content: locationNote || "📍 Yeni bir buluşma noktası önerildi.",
      is_location_share: true,
      location_lat: mapPosition[0],
      location_lon: mapPosition[1],
      location_address: locationAddress || "Haritadan seçilen konum",
      is_offer: false,
      offer_status: "pending", // 🎯 YENİ EKLENDİ: Karşı tarafın onayı beklenecek
    };

    try {
      if (activeChat.isNew) {
        payload.item_id = activeChat.item_id;
        const result = await itemApi.sendDirectMessage(payload);
        navigate(`/chat?conv_id=${result.conversation_id}`, { replace: true });
      } else {
        const sentMessage = await itemApi.sendMessage(activeChat.id, payload);
        setMessages((prev) => [...prev, sentMessage]);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }

      // Modalı Kapat ve State'leri Temizle
      setIsLocationModalOpen(false);
      setMapPosition(null);
      setLocationAddress("");
      setLocationNote("");
      setSearchQuery("");
      setSearchResults([]);
      toast.fire({ icon: "success", title: "Buluşma noktası karşı tarafa iletildi!" });
    } catch (error) {
      toast.fire({ icon: "error", title: "Konum paylaşılamadı." });
    }
  };

  const handlePayOffer = async (msg) => {
    const basePrice = parseFloat(msg.offer_price);
    const deposit = basePrice * 0.15;
    const totalToPay = basePrice + deposit;

    const result = await cyberConfirm.fire({
      title: "Hemen Öde ve Kirala",
      html:
        `🤝 Kabul Edilen Teklif Tutarı: <b>₺${basePrice.toFixed(2)}</b><br/>` +
        `🛡️ Güvence Bedeli (%15): <b>₺${deposit.toFixed(2)}</b><br/><br/>` +
        `Toplam <b>₺${totalToPay.toFixed(2)}</b> cüzdanınızdan tahsil edilecektir.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "💳 Onayla ve Öde",
      cancelButtonText: "İptal",
    });

    if (!result.isConfirmed) return;

    try {
      const payload = {
        start_date: msg.offer_start_date,
        end_date: msg.offer_end_date,
        total_price: basePrice,
      };

      await itemApi.payWithWallet(activeChat.item_id || activeChat.item, payload);
      toast.fire({ icon: "success", title: "Ödeme başarılı! Kiralama işlemi başlatıldı." });
      navigate("/bookings");
    } catch (error) {
      toast.fire({ icon: "error", title: error.response?.data?.error || "Ödeme işlemi başarısız oldu." });
      if (error.response?.data?.error?.toLowerCase().includes("yetersiz")) {
        navigate("/wallet");
      }
    }
  };

  const handleOfferResponse = async (messageId, action) => {
    try {
      await itemApi.respondToOffer(messageId, action);
      toast.fire({ icon: "success", title: action === "accept" ? "Teklif Kabul Edildi!" : "Teklif Reddedildi." });
      const fetchedMessages = await itemApi.getMessages(activeChat.id);
      setMessages(fetchedMessages.results ? fetchedMessages.results : fetchedMessages);
    } catch (error) {
      toast.fire({ icon: "error", title: "İşlem başarısız: " + (error.response?.data?.error || "Bilinmeyen hata") });
    }
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return `${date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} • ${date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getPartnerInfo = (chat) => {
    if (!chat || !currentUserId) return { name: "Bilinmiyor", role: "Üye" };
    if (chat.isNew) return { name: "Satıcı", role: "İlan Sahibi" };
    const isOwner = String(chat.owner).toLowerCase() === currentUserId;
    return {
      id: isOwner ? chat.renter : chat.owner,
      name: isOwner ? chat.renter_name : chat.owner_name,
      role: isOwner ? "Kiracı Adayı" : "İlan Sahibi",
      isOwner: isOwner,
    };
  };

  const partner = getPartnerInfo(activeChat);

  return (
    <div className="w-full relative h-screen flex flex-col overflow-hidden bg-[#1e293b]">
      <div className="absolute top-20 left-1/3 w-96 h-96 bg-blue-500/5 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full flex-1 flex gap-5 p-4 sm:p-6 lg:p-8 min-h-0 relative z-10">
        {/* SOL TARAF: SOHBET LİSTESİ */}
        <div className="cyber-card w-full md:w-1/3 lg:w-1/4 flex flex-col h-full overflow-hidden shrink-0 border border-slate-700/50">
          <div className="p-4 border-b border-[#475569]/40 bg-[#0f172a]/40 cursor-default">
            <h2 className="text-sm font-black text-slate-100 tracking-wide font-mono uppercase">💬 Mesajlarım</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {conversations.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 font-mono cursor-default">Aktif sohbetiniz bulunmuyor.</div>
            ) : (
              conversations.map((chat) => {
                const isActive = activeChat?.id === chat.id;
                const partnerInfo = getPartnerInfo(chat);
                const unreadCount = chat.unread_count || 0;
                const hasUnread = unreadCount > 0;

                return (
                  <motion.div
                    key={chat.id}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setActiveChat(chat);
                      setConversations((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unread_count: 0 } : c)));
                      navigate(`/chat?conv_id=${chat.id}`);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all border flex items-center gap-3 relative ${
                      isActive
                        ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/50 shadow-md shadow-blue-500/5"
                        : hasUnread
                          ? "bg-blue-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                          : "bg-slate-800/10 border-transparent hover:border-[#475569]/50 hover:bg-slate-800/40"
                    }`}>
                    <div className="w-12 h-12 rounded-lg bg-slate-700/50 shrink-0 overflow-hidden border border-slate-600/50 relative">
                      {chat.item_image ? (
                        <img src={chat.item_image} alt={chat.item_title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-xs font-black truncate pr-2 ${hasUnread ? "text-blue-400" : "text-slate-200"}`}>
                          {chat.item_title}
                        </span>
                      </div>
                      <div className="text-[10px] text-blue-400 font-medium truncate mb-1">{partnerInfo.name}</div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={`text-[11px] truncate ${hasUnread ? "text-slate-200 font-bold" : "text-slate-400"}`}>
                          {chat.last_message?.is_location_share
                            ? "📍 Konum paylaştı"
                            : chat.last_message?.content || "İlk mesajı sen gönder..."}
                        </p>
                      </div>
                    </div>

                    {hasUnread && (
                      <div className="absolute right-3 top-3 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/40">
                        {unreadCount}
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* SAĞ TARAF: AKTİF SOHBET EKRANI */}
        <div className="cyber-card flex-1 flex flex-col h-full overflow-hidden border border-slate-700/50">
          {activeChat ? (
            <>
              {/* SOHBET ÜST BİLGİ ALANI */}
              <div className="p-4 border-b border-[#475569]/40 flex items-center justify-between bg-[#0f172a]/40 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  {activeChat.item_image && (
                    <img
                      src={activeChat.item_image}
                      alt="ilan"
                      className="w-10 h-10 rounded-md object-cover border border-slate-600/50 cursor-pointer hover:scale-110 transition-transform"
                      onClick={() => navigate(`/listings/${activeChat.item_id || activeChat.item}`)}
                    />
                  )}
                  <div>
                    <h3 className="text-sm font-black text-slate-100 tracking-tight flex items-center gap-2">
                      <span
                        className="cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => navigate(`/listings/${activeChat.item_id || activeChat.item}`)}>
                        {activeChat.item_title}
                      </span>
                      {activeChat.item_price && (
                        <span className="text-xs font-mono text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-default">
                          ₺{activeChat.item_price}/Gün
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1.5">
                      👤 Konuştuğun Kişi:
                      {!activeChat.isNew ? (
                        <span
                          onClick={() => navigate(`/stores/${partner.id}`)}
                          className="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer transition-all">
                          {partner.name}
                        </span>
                      ) : (
                        <span className="text-slate-300 cursor-default">{partner.name}</span>
                      )}
                      <span className="text-[9px] bg-slate-700/50 px-1.5 py-0.5 rounded font-mono cursor-default">{partner.role}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/listings/${activeChat.item_id || activeChat.item}`)}
                  className="btn-slate text-[10px] !py-1.5 !px-3 hover:scale-105 active:scale-95 transition-transform cursor-pointer hover:bg-slate-700">
                  İlana Git ↗
                </button>
              </div>

              {/* MESAJLAŞMA ALANI */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin flex flex-col bg-[#0f172a]/15">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center flex-col text-slate-500">
                    <span className="text-3xl mb-2 animate-bounce">👋</span>
                    <p className="text-xs font-mono text-center">
                      {activeChat.isNew
                        ? "Bu satıcıya henüz mesaj göndermediniz. Sorularınızı sorabilir veya teklif verebilirsiniz."
                        : "Henüz mesaj yok. İlk adımı sen at!"}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.sender).toLowerCase() === currentUserId;

                    // 1️⃣ TEKLİF KARTI
                    if (msg.is_offer) {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col w-full max-w-[85%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                          <div
                            className={`p-4 rounded-2xl shadow-md border transition-all ${msg.offer_status === "accepted" ? "bg-emerald-900/20 border-emerald-500/30" : msg.offer_status === "rejected" ? "bg-rose-900/20 border-rose-500/30" : "bg-amber-900/20 border-amber-500/30"}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">🤝</span>
                              <span className="text-xs font-black tracking-widest uppercase text-slate-200">ÖZEL TEKLİF KARTI</span>
                            </div>

                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 space-y-2 mb-3 cursor-default hover:bg-slate-900/70 transition-colors">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Tarih Aralığı:</span>
                                <span className="font-mono text-slate-200">
                                  {msg.offer_start_date} <span className="text-slate-500 mx-1">→</span> {msg.offer_end_date}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Önerilen Fiyat:</span>
                                <span className="font-black text-amber-400">₺{msg.offer_price}</span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 italic mb-4">"{msg.content}"</p>

                            {msg.offer_status === "pending" ? (
                              isMe ? (
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 cursor-default">
                                  ⏳ Satıcıdan yanıt bekleniyor...
                                </div>
                              ) : (
                                partner.isOwner && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleOfferResponse(msg.id, "reject")}
                                      className="flex-1 btn-slate !py-1.5 text-[10px] !text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 cursor-pointer active:scale-95 transition-transform">
                                      Reddet
                                    </button>
                                    <button
                                      onClick={() => handleOfferResponse(msg.id, "accept")}
                                      className="flex-1 btn-gradient !bg-emerald-500 !border-emerald-400 !py-1.5 text-[10px] hover:scale-[1.02] cursor-pointer active:scale-95 transition-transform shadow-lg shadow-emerald-500/20">
                                      Kabul Et
                                    </button>
                                  </div>
                                )
                              )
                            ) : msg.offer_status === "accepted" ? (
                              <div className="flex flex-col gap-2 w-full mt-2">
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 cursor-default">
                                  ✅ Teklif Kabul Edildi
                                </div>
                                {isMe && (
                                  <button
                                    onClick={() => handlePayOffer(msg)}
                                    className="btn-gradient w-full !bg-emerald-500 !border-emerald-400 !py-2 text-[11px] hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/30 cursor-pointer">
                                    💳 Hemen Öde ve Kirala
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20 cursor-default">
                                ❌ Teklif Reddedildi
                              </div>
                            )}

                            <div
                              className={`text-[9px] mt-2 font-mono flex items-center gap-1.5 opacity-70 cursor-default ${isMe ? "justify-end text-blue-200" : "justify-start text-slate-400"}`}>
                              <span>{formatMessageTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    // 2️⃣ YENİ: LOKASYON PAYLAŞIM KARTI VE KABUL/RET
                    if (msg.is_location_share) {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col w-full max-w-[85%] sm:max-w-[70%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                          <div
                            className={`p-4 rounded-2xl shadow-md border w-full transition-all ${isMe ? "bg-indigo-900/20 border-indigo-500/30" : "bg-slate-800/60 border-slate-600/40"}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg animate-bounce">📍</span>
                              <span className="text-xs font-black tracking-widest uppercase text-slate-200">Buluşma Noktası Önerisi</span>
                            </div>

                            {/* Sohbet İçi Mini Harita */}
                            {msg.location_lat && msg.location_lon && (
                              <div className="h-32 w-full mt-2 mb-3 rounded-xl overflow-hidden border border-slate-700/50 relative z-0">
                                <MapContainer
                                  center={[parseFloat(msg.location_lat), parseFloat(msg.location_lon)]}
                                  zoom={15}
                                  zoomControl={false}
                                  dragging={false}
                                  scrollWheelZoom={false}
                                  doubleClickZoom={false}
                                  touchZoom={false}
                                  className="w-full h-full">
                                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                  <Marker position={[parseFloat(msg.location_lat), parseFloat(msg.location_lon)]} />
                                </MapContainer>
                                <div className="absolute inset-0 z-[1000] cursor-default" />
                              </div>
                            )}

                            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-700/50 space-y-1 mb-3 cursor-default">
                              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Adres:</span>
                              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                                {msg.location_address || "Haritadan İşaretlendi"}
                              </p>
                            </div>

                            <p className="text-xs text-slate-300 italic mb-4">"{msg.content}"</p>

                            {/* 🎯 YENİ: KONUM KABUL / RET DURUMLARI */}
                            {msg.offer_status === "pending" ? (
                              isMe ? (
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 cursor-default mb-3">
                                  ⏳ Karşı tarafın konumu onaylaması bekleniyor...
                                </div>
                              ) : (
                                <div className="flex gap-2 mb-3">
                                  <button
                                    onClick={() => handleOfferResponse(msg.id, "reject")}
                                    className="flex-1 btn-slate !py-2 text-[10px] !text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 cursor-pointer active:scale-95 transition-transform">
                                    📍 Konumu Reddet
                                  </button>
                                  <button
                                    onClick={() => handleOfferResponse(msg.id, "accept")}
                                    className="flex-1 btn-gradient !bg-emerald-500 !border-emerald-400 !py-2 text-[10px] cursor-pointer active:scale-95 transition-transform shadow-lg shadow-emerald-500/20">
                                    ✅ Uygun, Kabul Et
                                  </button>
                                </div>
                              )
                            ) : msg.offer_status === "accepted" ? (
                              <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 cursor-default mb-3">
                                ✅ Buluşma Noktası İki Tarafça Onaylandı
                              </div>
                            ) : msg.offer_status === "rejected" ? (
                              <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20 cursor-default mb-3">
                                ❌ Konum Reddedildi, Yeni Öneri Bekleniyor
                              </div>
                            ) : null}

                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${msg.location_lat},${msg.location_lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-gradient !bg-indigo-500 !border-indigo-400 w-full !py-2.5 text-[11px] hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2">
                              🚗 Yol Tarifi Al
                            </a>

                            <div
                              className={`text-[9px] mt-2 font-mono flex items-center gap-1.5 opacity-70 cursor-default ${isMe ? "justify-end text-blue-200" : "justify-start text-slate-400"}`}>
                              <span>{formatMessageTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    // 3️⃣ NORMAL MESAJ BALONLARI
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm border relative group cursor-default hover:opacity-90 transition-opacity ${isMe ? "bg-gradient-to-tr from-blue-600 via-blue-600 to-indigo-600 text-white rounded-br-none border-blue-500/20" : "bg-[#334155]/80 text-slate-200 rounded-bl-none border-[#475569]/40 backdrop-blur-sm"}`}>
                          {msg.content}
                          <div
                            className={`text-[9px] mt-1.5 font-mono flex items-center gap-1.5 opacity-70 ${isMe ? "justify-end text-blue-100" : "justify-start text-slate-400"}`}>
                            <span>{formatMessageTime(msg.created_at)}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* MESAJ YAZMA ALANI VE KONUM BUTONU */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-[#475569]/40 bg-[#0f172a]/30 flex gap-2.5 items-center">
                {/* 📍 KONUM EKLE BUTONU */}
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-xl hover:bg-slate-700 hover:border-blue-400 transition-colors cursor-pointer active:scale-90 flex-shrink-0 shadow-sm"
                  title="Buluşma Noktası Öner">
                  📍
                </button>

                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="cyber-input flex-1 !rounded-full !px-5 !py-3 border-[#475569]/50 shadow-inner hover:border-blue-500/50 focus:border-blue-500 transition-colors"
                />

                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`btn-gradient !rounded-full !px-6 !py-3 h-full flex items-center justify-center font-bold tracking-wider uppercase transition-all shrink-0 ${!newMessage.trim() ? "opacity-30 cursor-not-allowed shadow-none" : "cursor-pointer hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"}`}>
                  Gönder 🚀
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col text-slate-500 p-6">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="text-5xl mb-4 cursor-default">
                💬
              </motion.div>
              <h3 className="text-slate-300 font-bold mb-1 cursor-default">Mesajlarınız</h3>
              <p className="font-mono text-xs tracking-widest text-slate-400 uppercase text-center max-w-sm cursor-default">
                Sohbet detaylarını görmek ve mesajlaşmak için sol panelden bir ilan seçin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 🎯 YENİ: HARİTA ÜZERİNDEN KONUM VE MEKAN ARAMA MODALI */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cyber-card p-6 w-full max-w-3xl border border-blue-500/30 shadow-2xl shadow-blue-500/10 flex flex-col h-[85vh]">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2 cursor-default">📍 Buluşma Noktası Öner</h3>
                <button
                  onClick={() => setIsLocationModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-xs font-bold cursor-pointer active:scale-90">
                  ✕
                </button>
              </div>

              {/* 🎯 YENİ: AKILLI ARAMA ÇUBUĞU */}
              <div className="w-full relative shrink-0 mb-4 z-[1001]">
                <form onSubmit={handleSearchLocation} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Mekan, cadde veya işletme ara... (Örn: Pamukkale Üniversitesi)"
                    className="cyber-input flex-1 text-xs py-3 hover:border-blue-500/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="btn-slate !py-3 !px-5 text-xs font-bold shrink-0 cursor-pointer active:scale-95">
                    {isSearching ? "⏳ Aranıyor..." : "🔍 Bul"}
                  </button>
                </form>

                {/* Arama Sonuçları Dropdown */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-[#475569]/80 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                      {searchResults.map((res, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectSearchResult(res)}
                          className="p-3 border-b border-slate-700/50 hover:bg-slate-700/70 cursor-pointer text-xs text-slate-200 transition-colors flex items-start gap-2">
                          <span className="mt-0.5 opacity-70">📍</span>
                          <span>{res.display_name}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* HARİTA ALANI */}
              <div className="flex-1 w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50 mb-4 relative z-0">
                <MapContainer center={modalMapCenter} zoom={13} className="w-full h-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ChangeMapCenter center={modalMapCenter} zoom={15} />
                  <MapClickHandler
                    setMapPosition={setMapPosition}
                    setLocationAddress={setLocationAddress}
                    setModalMapCenter={setModalMapCenter}
                  />
                  {mapPosition && <Marker position={mapPosition} />}
                </MapContainer>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-950/90 text-slate-200 text-[10px] font-bold px-4 py-2 rounded-full border border-slate-700/50 shadow-lg pointer-events-none">
                  Arama yapın veya haritaya tıklayın
                </div>
              </div>

              {/* NOT VE GÖNDER BÖLÜMÜ */}
              <div className="space-y-3 shrink-0">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 font-mono block cursor-default">Seçilen Adres</label>
                  <input
                    type="text"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    className="cyber-input w-full text-xs bg-slate-900/50 hover:border-blue-500/50 transition-colors"
                    placeholder="Haritadan seçin veya manuel yazın"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 font-mono block cursor-default">
                    Karşı Tarafa Notunuz
                  </label>
                  <input
                    type="text"
                    value={locationNote}
                    onChange={(e) => setLocationNote(e.target.value)}
                    className="cyber-input w-full text-xs hover:border-blue-500/50 transition-colors"
                    placeholder="Örn: Kafenin önünde bekliyor olacağım."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsLocationModalOpen(false)}
                    className="btn-slate flex-1 cursor-pointer hover:bg-slate-700 active:scale-95 transition-all">
                    İptal
                  </button>
                  <button
                    onClick={handleSendLocation}
                    disabled={!mapPosition}
                    className="btn-gradient flex-1 cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20">
                    Konumu Gönder 🚀
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;
