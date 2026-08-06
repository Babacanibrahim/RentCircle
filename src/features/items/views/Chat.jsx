import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { itemApi } from "../services/itemApi";
import { toast, cyberConfirm } from "../../../utils/alerts";

// HARİTA İMPORTLARI
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import axios from "axios";

// TAKVİM İMPORTLARI
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { parseISO } from "date-fns";

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

  const chatContainerRef = useRef(null);
  const wsRef = useRef(null);

  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState(null);

  const scrollToBottom = (smooth = true) => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    }, 100);
  };

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalMapCenter, setModalMapCenter] = useState([37.7765, 29.0864]);
  const [mapPosition, setMapPosition] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationNote, setLocationNote] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerDates, setOfferDates] = useState({ start_date: "", end_date: "" });
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [activeItemDetails, setActiveItemDetails] = useState(null);

  const formatLastSeen = (isoString) => {
    if (!isoString) return "Yakın zamanda";

    const lastSeenDate = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - lastSeenDate) / 1000);

    if (diffInSeconds < 60) return "Az önce";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dk önce`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;

    const diffInDays = Math.floor(diffInSeconds / 86400);
    if (diffInDays === 1) return "Dün";
    if (diffInDays < 7) return `${diffInDays} gün önce`;

    return lastSeenDate.toLocaleDateString("tr-TR");
  };

  useEffect(() => {
    if (!searchQuery.trim()) setSearchResults([]);
  }, [searchQuery]);

  useEffect(() => {
    if (activeChat && (activeChat.item_id || activeChat.item)) {
      itemApi
        .getListingDetail(activeChat.item_id || activeChat.item)
        .then((data) => setActiveItemDetails(data))
        .catch((err) => console.error("İlan detayları çekilemedi", err));
    }
  }, [activeChat]);

  const excludedIntervals =
    activeItemDetails?.booked_dates?.map((range) => ({ start: parseISO(range.start), end: parseISO(range.end) })) || [];

  // 🎯 YENİ YARDIMCI FONKSİYON: Tarihleri kontrol edip teklifin hala geçerli olup olmadığını hesaplar
  const isOfferValidAndAvailable = (msgStartDate, msgEndDate) => {
    if (!msgStartDate || !msgEndDate) return false;

    // Geçmiş Tarih Kontrolü
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offerStart = new Date(msgStartDate);
    if (offerStart < today) return false;

    // Dolu Tarih (Çakışma) Kontrolü
    const isOverlap = excludedIntervals.some((interval) => {
      const oStart = new Date(msgStartDate);
      const oEnd = new Date(msgEndDate);
      oStart.setHours(0, 0, 0, 0);
      oEnd.setHours(0, 0, 0, 0);
      const iStart = new Date(interval.start);
      const iEnd = new Date(interval.end);
      iStart.setHours(0, 0, 0, 0);
      iEnd.setHours(0, 0, 0, 0);
      return oStart <= iEnd && oEnd >= iStart;
    });

    return !isOverlap;
  };

  useEffect(() => {
    if (startDate && endDate && activeChat?.item_price) {
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const calculatedTotal = diffDays * parseFloat(activeChat.item_price);
      setOfferPrice(calculatedTotal.toString());
      setOfferDates({
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      });
    } else {
      setOfferDates({ start_date: "", end_date: "" });
    }
  }, [startDate, endDate, activeChat]);

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

        if (activeChat && !activeChat.isNew) {
          const msgData = await itemApi.getMessages(activeChat.id);
          const fetchedMsgs = msgData.results ? msgData.results : msgData;
          setMessages((currentMsgs) => (JSON.stringify(currentMsgs) !== JSON.stringify(fetchedMsgs) ? fetchedMsgs : currentMsgs));
        }
      } catch (err) {
        console.error("Sohbetler yüklenemedi:", err);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [searchParams, activeChat]);

  const getPartnerInfo = (chat) => {
    if (!chat || !currentUserId) return { id: null, name: "Bilinmiyor", role: "Üye" };
    if (chat.isNew) return { id: null, name: "Satıcı", role: "İlan Sahibi" };
    const isOwner = String(chat.owner).toLowerCase() === currentUserId;
    return {
      id: isOwner ? chat.renter : chat.owner,
      name: isOwner ? chat.renter_name : chat.owner_name,
      role: isOwner ? "Kiracı Adayı" : "İlan Sahibi",
      isOwner: isOwner,
    };
  };

  const partner = getPartnerInfo(activeChat);

  useEffect(() => {
    let isSubscribed = true;
    let pingInterval;
    let statusCheckInterval;

    const connectWebSocket = () => {
      if (!activeChat || activeChat.isNew) return;

      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${activeChat.id}/`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`Oda ${activeChat.id} için gerçek zamanlı bağlantı kuruldu.`);

        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        statusCheckInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN && partner.id) {
            ws.send(JSON.stringify({ type: "check_status", target_user_id: partner.id }));
          }
        }, 5000);

        if (partner.id) ws.send(JSON.stringify({ type: "check_status", target_user_id: partner.id }));
      };

      ws.onmessage = (event) => {
        const incomingData = JSON.parse(event.data);

        if (incomingData.type === "pong") return;

        if (incomingData.type === "status_update") {
          if (isSubscribed) {
            setIsPartnerOnline(incomingData.is_online);
            setPartnerLastSeen(incomingData.last_seen);
          }
          return;
        }

        const newMsg = {
          id: Date.now(),
          sender: incomingData.sender,
          content: incomingData.content,
          is_offer: incomingData.is_offer,
          offer_price: incomingData.offer_price,
          offer_start_date: incomingData.offer_start_date,
          offer_end_date: incomingData.offer_end_date,
          offer_status: incomingData.offer_status,
          is_location_share: incomingData.is_location_share,
          location_lat: incomingData.location_lat,
          location_lon: incomingData.location_lon,
          location_address: incomingData.location_address,
          created_at: new Date().toISOString(),
        };

        if (isSubscribed) {
          setMessages((prev) => [...prev, newMsg]);
          scrollToBottom(true);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket bağlantısı sonlandı. 3 Saniye içinde tekrar deneniyor...");
        clearInterval(pingInterval);
        clearInterval(statusCheckInterval);
        if (isSubscribed) {
          setTimeout(connectWebSocket, 3000);
        }
      };
    };

    if (activeChat && !activeChat.isNew) {
      itemApi
        .getMessages(activeChat.id)
        .then((data) => {
          if (isSubscribed) {
            const fetchedMessages = data.results ? data.results : data;
            setMessages(fetchedMessages);
            scrollToBottom(false);
          }
        })
        .catch((err) => console.error("Mesaj geçmişi çekilemedi:", err));

      connectWebSocket();
    } else if (activeChat && activeChat.isNew) {
      setMessages([]);
      setIsPartnerOnline(false);
      setPartnerLastSeen(null);
    }

    return () => {
      isSubscribed = false;
      clearInterval(pingInterval);
      clearInterval(statusCheckInterval);
      setIsPartnerOnline(false);
      setPartnerLastSeen(null);
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.close();
      }
    };
  }, [activeChat, partner.id]);

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
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              sender_id: currentUserId,
              content: messageContent,
              is_offer: false,
              is_location_share: false,
            }),
          );
        } else {
          toast.fire({ icon: "error", title: "Bağlantı koptu. Lütfen sayfayı yenileyin." });
        }
      }
    } catch (error) {
      toast.fire({ icon: "error", title: "Mesajınız iletilemedi." });
      setNewMessage(messageContent);
    }
  };

  const handleSendLocation = async () => {
    if (!mapPosition) return toast.fire({ icon: "warning", title: "Lütfen haritadan bir buluşma noktası seçin." });

    const payload = {
      sender_id: currentUserId,
      content: locationNote || "📍 Yeni bir buluşma noktası önerildi.",
      is_location_share: true,
      location_lat: mapPosition[0],
      location_lon: mapPosition[1],
      location_address: locationAddress || "Haritadan seçilen konum",
      is_offer: false,
      offer_status: "pending",
    };

    try {
      if (activeChat.isNew) {
        payload.item_id = activeChat.item_id;
        const result = await itemApi.sendDirectMessage(payload);
        navigate(`/chat?conv_id=${result.conversation_id}`, { replace: true });
      } else {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
      }

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

  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!offerPrice || !offerDates.start_date || !offerDates.end_date) {
      return toast.fire({ icon: "warning", title: "Lütfen takvimden tarihleri ve bütçenizi eksiksiz girin." });
    }

    const isOverlap = excludedIntervals.some((interval) => {
      const oStart = new Date(offerDates.start_date);
      const oEnd = new Date(offerDates.end_date);
      oStart.setHours(0, 0, 0, 0);
      oEnd.setHours(0, 0, 0, 0);
      const iStart = new Date(interval.start);
      const iEnd = new Date(interval.end);
      iStart.setHours(0, 0, 0, 0);
      iEnd.setHours(0, 0, 0, 0);
      return oStart <= iEnd && oEnd >= iStart;
    });

    if (isOverlap) {
      return toast.fire({ icon: "error", title: "Seçtiğiniz tarihlerde ürün dolu! Lütfen gri renkli (dolu) günleri seçmeyin." });
    }

    setIsSubmittingOffer(true);
    try {
      const payload = {
        sender_id: currentUserId,
        content: `Size yeni bir fiyat teklifim var: ${formatReadableDate(offerDates.start_date)} - ${formatReadableDate(offerDates.end_date)} arası toplam ${offerPrice} ₺`,
        is_offer: true,
        offer_price: offerPrice,
        offer_start_date: offerDates.start_date,
        offer_end_date: offerDates.end_date,
        offer_status: "pending",
        is_location_share: false,
      };

      if (activeChat.isNew) {
        payload.item_id = activeChat.item_id;
        const result = await itemApi.sendDirectMessage(payload);
        navigate(`/chat?conv_id=${result.conversation_id}`, { replace: true });
      } else {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
      }

      setIsOfferModalOpen(false);
      setDateRange([null, null]);
      setOfferPrice("");
      toast.fire({ icon: "success", title: "Teklifiniz karşı tarafa iletildi!" });
    } catch (error) {
      toast.fire({ icon: "error", title: "Teklif gönderilirken bir hata oluştu." });
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handlePayOffer = async (msg) => {
    const basePrice = parseFloat(msg.offer_price);
    const deposit = basePrice * 0.15;
    const totalToPay = basePrice + deposit;

    // 🎯 EĞER TEKLİF GEÇERSİZSE VEYA ÇAKIŞIYORSA KİLİTLE!
    if (!isOfferValidAndAvailable(msg.offer_start_date, msg.offer_end_date)) {
      return toast.fire({
        icon: "error",
        title: "Üzgünüz, bu teklifteki tarihler artık dolu veya geçmişte kaldı! Yeni bir teklif isteyin.",
      });
    }

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
      } else if (error.response?.data?.error?.toLowerCase().includes("başka bir kullanıcı")) {
        // Backend çakışmayı reddederse mesajları sessizce güncelleyelim ki teklif iptal olarak görünsün.
        const msgData = await itemApi.getMessages(activeChat.id);
        setMessages(msgData.results ? msgData.results : msgData);
      }
    }
  };

  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
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

  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setMapPosition([lat, lon]);
    setModalMapCenter([lat, lon]);
    setLocationAddress(result.name || result.display_name.split(",")[0]);
    searchResults([]);
  };

  const openOfferModal = (specificOffer = null) => {
    if (specificOffer) {
      setDateRange([new Date(specificOffer.start), new Date(specificOffer.end)]);
      setOfferPrice(specificOffer.price);
    } else {
      const lastOffer = [...messages].reverse().find((m) => m.is_offer);
      if (lastOffer) {
        setDateRange([new Date(lastOffer.offer_start_date), new Date(lastOffer.offer_end_date)]);
        setOfferPrice(lastOffer.offer_price);
      } else {
        setDateRange([null, null]);
        setOfferPrice("");
      }
    }
    setIsOfferModalOpen(true);
  };

  const handleOfferResponse = async (msg, action) => {
    // 🛡️ Satıcı kabul etmeden önce UX açısından uyar
    if (action === "accept") {
      const result = await cyberConfirm.fire({
        title: "Teklifi Onaylıyor musunuz?",
        html: `Bu teklifi kabul ettiğinizde, <b>${formatReadableDate(msg.offer_start_date)} - ${formatReadableDate(msg.offer_end_date)}</b> tarihleri ile çakışan diğer tüm kullanıcılardan gelen bekleyen teklifler <b>otomatik olarak reddedilecektir.</b><br><br>Onaylıyor musunuz?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Evet, Kabul Et",
        cancelButtonText: "Vazgeç",
      });

      if (!result.isConfirmed) return; // Vazgeçerse işlemi durdur
    }

    try {
      // Backend'e sadece ID'yi yolluyoruz
      await itemApi.respondToOffer(msg.id, action);

      toast.fire({ icon: "success", title: action === "accept" ? "Teklif Kabul Edildi!" : "Teklif Reddedildi." });

      // Anında güncel mesajları çekip ekrana yansıt
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

  const formatReadableDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  };

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
                          {chat.last_message?.is_offer
                            ? "🤝 Yeni teklif var"
                            : chat.last_message?.is_location_share
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
                    <Link to={`/listings/${activeChat.item_id || activeChat.item}`} className="shrink-0 block relative">
                      <img
                        src={activeChat.item_image}
                        alt="ilan"
                        className="w-10 h-10 rounded-md object-cover border border-slate-600/50 hover:scale-110 transition-transform"
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-[#0f172a] rounded-full transition-colors duration-500 ${
                          isPartnerOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-slate-500"
                        }`}
                        title={isPartnerOnline ? "Çevrimiçi" : "Çevrimdışı"}
                      />
                    </Link>
                  )}
                  <div>
                    <h3 className="text-sm font-black text-slate-100 tracking-tight flex items-center gap-2">
                      <Link
                        to={`/listings/${activeChat.item_id || activeChat.item}`}
                        className="cursor-pointer hover:text-blue-400 transition-colors">
                        {activeChat.item_title}
                      </Link>
                      {activeChat.item_price && (
                        <span className="text-xs font-mono text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-default">
                          ₺{activeChat.item_price}/Gün
                        </span>
                      )}
                    </h3>
                    <div className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-2">
                      <span>👤 Konuştuğun Kişi:</span>
                      {!activeChat.isNew ? (
                        <Link
                          to={`/stores/${partner.id}`}
                          className="text-blue-400 hover:text-blue-300 font-bold hover:underline transition-all">
                          {partner.name}
                        </Link>
                      ) : (
                        <span className="text-slate-300 cursor-default">{partner.name}</span>
                      )}
                      <span className="text-[9px] bg-slate-700/50 px-1.5 py-0.5 rounded font-mono cursor-default">{partner.role}</span>

                      <span
                        className={`text-[10px] font-bold tracking-wider uppercase ml-1 transition-colors duration-500 ${isPartnerOnline ? "text-emerald-400" : "text-slate-500"}`}>
                        {isPartnerOnline ? "🟢 Çevrimiçi" : `⚪ Son Görülme: ${formatLastSeen(partnerLastSeen)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/listings/${activeChat.item_id || activeChat.item}`}
                  className="btn-slate text-[10px] !py-1.5 !px-3 hover:scale-105 active:scale-95 transition-transform hover:bg-slate-700 flex items-center justify-center">
                  İlana Git ↗
                </Link>
              </div>

              {/* MESAJLAŞMA ALANI */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin flex flex-col bg-[#0f172a]/15 relative">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center flex-col text-slate-500">
                    <span className="text-3xl mb-2 animate-bounce">👋</span>
                    <p className="text-xs font-mono text-center">
                      {activeChat.isNew ? "Sohbete başlamak için bir mesaj yazın veya teklif verin." : "Henüz mesaj yok. İlk adımı sen at!"}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.sender).toLowerCase() === currentUserId;
                    const isSupport = msg.sender_username === "rentcircle_destek" || msg.sender_name === "RentCircle Destek";

                    // 🎯 DURUM KONTROLÜ: Teklifin arka planda iptal olup olmadığını denetle
                    const isValidOffer = isOfferValidAndAvailable(msg.offer_start_date, msg.offer_end_date);
                    // Eğer Backend'den "accepted" gelmiş olsa bile tarihler geçmiş/doluysa onu "expired/rejected" gibi göster
                    const visualOfferStatus = msg.offer_status === "accepted" && !isValidOffer ? "expired" : msg.offer_status;

                    if (msg.is_offer) {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col w-full max-w-[85%] sm:max-w-[380px] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                          <div
                            className={`p-4 rounded-2xl shadow-md border transition-all w-full ${visualOfferStatus === "accepted" ? "bg-emerald-900/20 border-emerald-500/30" : visualOfferStatus === "rejected" || visualOfferStatus === "expired" ? "bg-rose-900/20 border-rose-500/30 opacity-75" : "bg-amber-900/20 border-amber-500/30"}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">🤝</span>
                              <span className="text-xs font-black tracking-widest uppercase text-slate-200">
                                {visualOfferStatus === "expired" ? "GEÇERSİZ TEKLİF" : isMe ? "GÖNDERDİĞİN TEKLİF" : "YENİ TEKLİF GELDİ"}
                              </span>
                            </div>

                            <div
                              className={`bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 mb-3 cursor-default transition-colors ${visualOfferStatus === "expired" ? "line-through text-slate-500" : "hover:bg-slate-900/70"}`}>
                              <div className="flex flex-col gap-1.5 text-center">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kiralama Tarihleri</span>
                                <span
                                  className={`font-bold text-[11px] bg-slate-800/50 py-1.5 rounded-lg border border-slate-700/50 ${visualOfferStatus === "expired" ? "text-slate-500" : "text-slate-200"}`}>
                                  {formatReadableDate(msg.offer_start_date)} <span className="text-slate-500 mx-1">→</span>{" "}
                                  {formatReadableDate(msg.offer_end_date)}
                                </span>
                              </div>

                              <div className="flex justify-between items-center border-t border-slate-700/50 pt-2.5 mt-2.5">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Önerilen Fiyat:</span>
                                <span
                                  className={`font-black text-sm ${visualOfferStatus === "expired" ? "text-slate-500" : "text-amber-400"}`}>
                                  ₺{msg.offer_price}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 italic mb-4">&quot;{msg.content}&quot;</p>

                            {visualOfferStatus === "pending" ? (
                              isMe ? (
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 cursor-default">
                                  ⏳ Yanıt bekleniyor...
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2 w-full">
                                  <div className="flex gap-2">
                                    <button
                                      // 🎯 DÜZELTME: msg.id YERİNE msg KULLANILDI
                                      onClick={() => handleOfferResponse(msg, "reject")}
                                      className="flex-1 btn-slate !py-1.5 text-[10px] !text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 cursor-pointer active:scale-95 transition-transform">
                                      Reddet
                                    </button>
                                    <button
                                      // 🎯 DÜZELTME: msg.id YERİNE msg KULLANILDI
                                      onClick={() => handleOfferResponse(msg, "accept")}
                                      className="flex-1 btn-gradient !bg-emerald-500 !border-emerald-400 !py-1.5 text-[10px] hover:scale-[1.02] cursor-pointer active:scale-95 transition-transform shadow-lg shadow-emerald-500/20">
                                      Kabul Et
                                    </button>
                                  </div>
                                  <button
                                    onClick={() =>
                                      openOfferModal({ start: msg.offer_start_date, end: msg.offer_end_date, price: msg.offer_price })
                                    }
                                    className="w-full btn-slate !py-1.5 text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm">
                                    💡 Karşı Teklif İlet (Fiyatı Güncelle)
                                  </button>
                                </div>
                              )
                            ) : visualOfferStatus === "accepted" ? (
                              <div className="flex flex-col gap-2 w-full mt-2">
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 cursor-default">
                                  ✅ Teklif Kabul Edildi
                                </div>
                                {!partner.isOwner && (
                                  <button
                                    onClick={() => handlePayOffer(msg)}
                                    className="btn-gradient w-full !bg-emerald-500 !border-emerald-400 !py-2 text-[11px] hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/30 cursor-pointer">
                                    💳 Kirala ve Öde
                                  </button>
                                )}
                              </div>
                            ) : visualOfferStatus === "expired" ? (
                              <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-rose-500/5 text-rose-400/80 font-bold border border-rose-500/10 cursor-not-allowed">
                                ❌ İptal Edildi (Tarihler Dolu/Geçmiş)
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
                              <span className="text-xs font-black tracking-widest uppercase text-slate-200">Buluşma Noktası</span>
                            </div>

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

                            <p className="text-xs text-slate-300 italic mb-4">&quot;{msg.content}&quot;</p>

                            {msg.offer_status === "pending" ? (
                              isMe ? (
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 cursor-default mb-3">
                                  ⏳ Karşı tarafın onayı bekleniyor...
                                </div>
                              ) : (
                                <div className="flex gap-2 mb-3">
                                  <button
                                    // 🎯 DÜZELTME: msg.id YERİNE msg KULLANILDI
                                    onClick={() => handleOfferResponse(msg, "reject")}
                                    className="flex-1 btn-slate !py-2 text-[10px] !text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 cursor-pointer active:scale-95 transition-transform">
                                    Reddet
                                  </button>
                                  <button
                                    // 🎯 DÜZELTME: msg.id YERİNE msg KULLANILDI
                                    onClick={() => handleOfferResponse(msg, "accept")}
                                    className="flex-1 btn-gradient !bg-emerald-500 !border-emerald-400 !py-2 text-[10px] cursor-pointer active:scale-95 transition-transform shadow-lg shadow-emerald-500/20">
                                    Kabul Et
                                  </button>
                                </div>
                              )
                            ) : msg.offer_status === "accepted" ? (
                              <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 cursor-default mb-3">
                                ✅ Buluşma Noktası Onaylandı
                              </div>
                            ) : msg.offer_status === "rejected" ? (
                              <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20 cursor-default mb-3">
                                ❌ Konum Reddedildi
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

                    return (
                      <div
                        key={msg.id}
                        className={`flex w-full my-2 ${isSupport ? "justify-start" : isMe ? "justify-end" : "justify-start"}`}>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isSupport ? "items-start" : isMe ? "items-end" : "items-start"}`}>
                          <div
                            className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm border relative group cursor-default transition-all ${
                              isSupport
                                ? "bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-amber-500/50 text-blue-50 shadow-amber-500/10 rounded-tl-none"
                                : isMe
                                  ? "bg-gradient-to-tr from-blue-600 via-blue-600 to-indigo-600 text-white rounded-br-none border-blue-500/20"
                                  : "bg-[#334155]/80 text-slate-200 rounded-bl-none border-[#475569]/40 backdrop-blur-sm"
                            }`}>
                            {isSupport && (
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/30">
                                <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500 text-amber-400 flex items-center justify-center text-[10px] font-black shadow-inner">
                                  🛡️
                                </div>
                                <span className="text-xs font-black tracking-widest text-amber-400 uppercase font-mono">
                                  RentCircle Destek
                                </span>
                              </div>
                            )}

                            <p className="whitespace-pre-wrap">{msg.content}</p>

                            <div
                              className={`text-[9px] mt-2 font-mono flex items-center gap-1.5 opacity-70 ${isSupport ? "justify-end text-amber-400/70" : isMe ? "justify-end text-blue-100" : "justify-start text-slate-400"}`}>
                              <span>{formatMessageTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* MESAJ YAZMA ALANI VE BUTONLAR */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-[#475569]/40 bg-[#0f172a]/30 flex gap-2.5 items-center">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="w-12 h-12 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-xl hover:bg-slate-700 hover:border-blue-400 transition-colors cursor-pointer active:scale-90 flex-shrink-0 shadow-sm"
                  title="Buluşma Noktası Öner">
                  📍
                </button>

                <button
                  type="button"
                  onClick={() => openOfferModal()}
                  className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-xl hover:bg-amber-500/20 hover:border-amber-400 transition-colors cursor-pointer active:scale-90 flex-shrink-0 shadow-sm"
                  title="Yeni Teklif Öner">
                  🤝
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
                Sohbet detaylarını görmek ve pazarlık yapmak için sol panelden bir ilan seçin.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TEKLİF MODALI */}
      <AnimatePresence>
        {isOfferModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cyber-card p-6 w-full max-w-[340px] border border-amber-500/30 shadow-2xl shadow-amber-500/10">
              <h3 className="text-lg font-black text-slate-100 mb-1 cursor-default">🤝 Teklif İlet</h3>
              <p className="text-[10px] text-slate-400 mb-4 cursor-default">Müsait tarihleri seçin ve tutarı belirleyin.</p>

              <form onSubmit={handleSendOffer} className="space-y-4">
                <div className="w-full bg-slate-900/50 p-2 rounded-xl border border-slate-700/50 flex justify-center scale-90 origin-top">
                  <DatePicker
                    selectsRange={true}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(update) => setDateRange(update)}
                    excludeDateIntervals={excludedIntervals}
                    minDate={new Date()}
                    inline
                  />
                </div>

                <div className="space-y-1 -mt-4">
                  <label className="text-[10px] uppercase font-black text-slate-400 font-mono block cursor-default">
                    Teklif Edilen Toplam Tutar (₺)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Örn: 500"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    className="cyber-input w-full text-base font-bold hover:border-amber-500/50 transition-colors focus:border-amber-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOfferModalOpen(false)}
                    className="btn-slate flex-1 cursor-pointer hover:bg-slate-700 active:scale-95 transition-all">
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOffer}
                    className="btn-gradient flex-1 !bg-amber-500 !border-amber-400 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20">
                    {isSubmittingOffer ? "Gönderiliyor..." : "Teklifi Gönder"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LOKASYON MODALI */}
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

              <div className="w-full relative shrink-0 mb-4 z-[1001]">
                <form onSubmit={handleSearchLocation} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Mekan, cadde veya işletme ara..."
                    className="cyber-input flex-1 text-xs py-3 hover:border-blue-500/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="btn-slate !py-3 !px-5 text-xs font-bold shrink-0 cursor-pointer active:scale-95">
                    {isSearching ? "⏳ Aranıyor..." : "🔍 Bul"}
                  </button>
                </form>

                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-[#475569]/80 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
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
              </div>

              <div className="space-y-3 shrink-0">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-slate-400 font-mono block cursor-default">Seçilen Adres</label>
                  <input
                    type="text"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    className="cyber-input w-full text-xs bg-slate-900/50 hover:border-blue-500/50 transition-colors"
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
