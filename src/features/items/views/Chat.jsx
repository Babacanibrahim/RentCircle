import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom"; // 🎯 YENİ: useSearchParams eklendi
import { motion } from "framer-motion";
import { itemApi } from "../services/itemApi";

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const messagesEndRef = useRef(null);

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

        // 🎯 YENİ: URL parametreleri ile yönlendirme (Lazy loading)
        const convId = searchParams.get("conv_id");
        const newItemId = searchParams.get("new_item");
        const newItemTitle = searchParams.get("title");

        if (convId && !activeChat) {
          const found = chatList.find((c) => String(c.id) === convId);
          if (found) setActiveChat(found);
        } else if (newItemId && !activeChat) {
          // Henüz veritabanında olmayan (Lazy) sanal bir sohbet başlat
          setActiveChat({
            isNew: true,
            item_id: newItemId,
            item_title: newItemTitle,
            owner_name: "Satıcı", // Gerçek isim ilk mesajdan sonra gelir
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
      // Yeni sohbetse mesaj listesi boş
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
        // 🎯 YENİ: Lazy Initialization - İlk mesaj atıldığında sohbet yaratılır
        const result = await itemApi.sendDirectMessage({
          item_id: activeChat.item_id,
          content: messageContent,
          is_offer: false,
        });

        // Sanal chat'i kapat, gerçek chat ID'si ile URL'yi güncelle
        navigate(`/chat?conv_id=${result.conversation_id}`, { replace: true });
        // Bir sonraki fetch döngüsünde chatList güncellenip activeChat'e oturacak
      } else {
        // Zaten var olan sohbete mesaj gönder
        const sentMessage = await itemApi.sendMessage(activeChat.id, messageContent);
        setMessages((prev) => [...prev, sentMessage]);

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);

        const updatedChats = await itemApi.getConversations();
        setConversations(updatedChats.results ? updatedChats.results : updatedChats);
      }
    } catch (error) {
      console.error("Mesaj iletilemedi:", error.response || error);
      alert("Mesajınız iletilemedi. Lütfen bağlantınızı kontrol edin.");
      setNewMessage(messageContent);
    }
  };

  const handlePayOffer = async (msg) => {
    const basePrice = parseFloat(msg.offer_price);
    const deposit = basePrice * 0.15;
    const totalToPay = basePrice + deposit;

    const confirmPay = window.confirm(
      `🤝 Kabul Edilen Teklif Tutarı: ₺${basePrice.toFixed(2)}\n` +
        `🛡️ Güvence Bedeli (%15): ₺${deposit.toFixed(2)}\n\n` +
        `Toplam ₺${totalToPay.toFixed(2)} cüzdanınızdan tahsil edilecektir. Onaylıyor musunuz?`,
    );

    if (!confirmPay) return;

    try {
      const payload = {
        start_date: msg.offer_start_date,
        end_date: msg.offer_end_date,
        total_price: basePrice, // Sadece anlaşılan kira bedelini atıyoruz
      };

      await itemApi.payWithWallet(activeChat.item_id || activeChat.item, payload);
      alert("✅ Ödeme başarılı! Kiralama işlemi başlatıldı.");
      navigate("/bookings"); // İşlem bitince Kiralamalarım sayfasına gönder
    } catch (error) {
      alert(error.response?.data?.error || "Ödeme işlemi başarısız oldu.");
      if (error.response?.data?.error?.toLowerCase().includes("yetersiz")) {
        navigate("/wallet");
      }
    }
  };

  // 🎯 YENİ: Satıcı Teklifi Yanıtlama Fonksiyonu
  const handleOfferResponse = async (messageId, action) => {
    try {
      await itemApi.respondToOffer(messageId, action);
      alert(action === "accept" ? "Teklif Kabul Edildi!" : "Teklif Reddedildi.");

      // Mesajları anında güncellemek için manuel bir tetikleme
      const fetchedMessages = await itemApi.getMessages(activeChat.id);
      setMessages(fetchedMessages.results ? fetchedMessages.results : fetchedMessages);
    } catch (error) {
      alert("İşlem başarısız: " + (error.response?.data?.error || "Bilinmeyen hata"));
    }
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
    const timePart = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    return `${datePart} • ${timePart}`;
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
        <div className="cyber-card w-full md:w-1/3 lg:w-1/4 flex flex-col h-full overflow-hidden shrink-0">
          <div className="p-4 border-b border-[#475569]/40 bg-[#0f172a]/40">
            <h2 className="text-sm font-black text-slate-100 tracking-wide font-mono uppercase">💬 Mesajlarım</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {conversations.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 font-mono">Aktif sohbetiniz bulunmuyor.</div>
            ) : (
              conversations.map((chat) => {
                const isActive = activeChat?.id === chat.id;
                const partnerInfo = getPartnerInfo(chat);
                const unreadCount = chat.unread_count || 0;
                const hasUnread = unreadCount > 0;

                return (
                  <motion.div
                    key={chat.id}
                    whileHover={{ scale: 1.01, x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setActiveChat(chat);
                      setConversations((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unread_count: 0 } : c)));
                      navigate(`/chat?conv_id=${chat.id}`); // URL'yi temizle
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all border flex items-center gap-3 relative ${
                      isActive
                        ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/50 shadow-md shadow-blue-500/5"
                        : hasUnread
                          ? "bg-blue-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                          : "bg-slate-800/10 border-transparent hover:border-[#475569]/30 hover:bg-slate-800/40"
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
                          {chat.last_message ? chat.last_message.content : "İlk mesajı sen gönder..."}
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
        <div className="cyber-card flex-1 flex flex-col h-full overflow-hidden">
          {activeChat ? (
            <>
              {/* SOHBET ÜST BİLGİ ALANI */}
              <div className="p-4 border-b border-[#475569]/40 flex items-center justify-between bg-[#0f172a]/40 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  {activeChat.item_image && (
                    <img src={activeChat.item_image} alt="ilan" className="w-10 h-10 rounded-md object-cover border border-slate-600/50" />
                  )}
                  <div>
                    <h3 className="text-sm font-black text-slate-100 tracking-tight flex items-center gap-2">
                      {activeChat.item_title}
                      {activeChat.item_price && (
                        <span className="text-xs font-mono text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded">
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
                        <span className="text-slate-300">{partner.name}</span>
                      )}
                      <span className="text-[9px] bg-slate-700/50 px-1.5 py-0.5 rounded font-mono">{partner.role}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/listings/${activeChat.item_id || activeChat.item}`)}
                  className="btn-slate text-[10px] !py-1.5 !px-3">
                  İlana Git ↗
                </button>
              </div>

              {/* MESAJLAŞMA ALANI */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin flex flex-col bg-[#0f172a]/15">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center flex-col text-slate-500">
                    <span className="text-3xl mb-2">👋</span>
                    <p className="text-xs font-mono text-center">
                      {activeChat.isNew
                        ? "Bu satıcıya henüz mesaj göndermediniz. Sorularınızı sorabilir veya teklif verebilirsiniz."
                        : "Henüz mesaj yok. İlk adımı sen at!"}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.sender).toLowerCase() === currentUserId;

                    // 🎯 YENİ: EĞER MESAJ BİR TEKLİFSE FARKLI BİR KART (COMPONENT) ÇİZİLİR
                    if (msg.is_offer) {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col w-full max-w-[85%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                          <div
                            className={`p-4 rounded-2xl shadow-md border ${msg.offer_status === "accepted" ? "bg-emerald-900/20 border-emerald-500/30" : msg.offer_status === "rejected" ? "bg-rose-900/20 border-rose-500/30" : "bg-amber-900/20 border-amber-500/30"}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-lg">🤝</span>
                              <span className="text-xs font-black tracking-widest uppercase text-slate-200">ÖZEL TEKLİF KARTI</span>
                            </div>

                            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 space-y-2 mb-3">
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

                            {/* DURUM ROZETLERİ VEYA BUTONLAR */}
                            {msg.offer_status === "pending" ? (
                              isMe ? (
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                                  ⏳ Satıcıdan yanıt bekleniyor...
                                </div>
                              ) : (
                                partner.isOwner && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleOfferResponse(msg.id, "reject")}
                                      className="flex-1 btn-slate !py-1.5 text-[10px] !text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30">
                                      Reddet
                                    </button>
                                    <button
                                      onClick={() => handleOfferResponse(msg.id, "accept")}
                                      className="flex-1 btn-gradient !bg-emerald-500 !border-emerald-400 !py-1.5 text-[10px]">
                                      Kabul Et
                                    </button>
                                  </div>
                                )
                              )
                            ) : msg.offer_status === "accepted" ? (
                              // 🎯 YENİ: KABUL EDİLEN TEKLİF VE HEMEN ÖDE BUTONU
                              <div className="flex flex-col gap-2 w-full mt-2">
                                <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                                  ✅ Teklif Kabul Edildi
                                </div>
                                {isMe && (
                                  <button
                                    onClick={() => handlePayOffer(msg)}
                                    className="btn-gradient w-full !bg-emerald-500 !border-emerald-400 !py-2 text-[11px] hover:scale-105 shadow-lg shadow-emerald-500/20">
                                    💳 Hemen Öde ve Kirala
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-center w-full py-1.5 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                                ❌ Teklif Reddedildi
                              </div>
                            )}

                            <div
                              className={`text-[9px] mt-2 font-mono flex items-center gap-1.5 opacity-70 ${isMe ? "justify-end text-blue-200" : "justify-start text-slate-400"}`}>
                              <span>{formatMessageTime(msg.created_at)}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    // NORMAL MESAJ BALONLARI
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm border relative group ${
                            isMe
                              ? "bg-gradient-to-tr from-blue-600 via-blue-600 to-indigo-600 text-white rounded-br-none border-blue-500/20"
                              : "bg-[#334155]/80 text-slate-200 rounded-bl-none border-[#475569]/40 backdrop-blur-sm"
                          }`}>
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

              {/* MESAJ YAZMA ALANI */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-[#475569]/40 bg-[#0f172a]/30 flex gap-2.5 items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="cyber-input flex-1 !rounded-full !px-5 !py-3 border-[#475569]/50 shadow-inner focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`btn-gradient !rounded-full !px-6 !py-3 h-full flex items-center justify-center font-bold tracking-wider uppercase transition-all shrink-0 ${
                    !newMessage.trim() ? "opacity-30 cursor-not-allowed shadow-none" : "cursor-pointer hover:scale-105 active:scale-95"
                  }`}>
                  Gönder 🚀
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col text-slate-500 p-6">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="text-5xl mb-4">
                💬
              </motion.div>
              <h3 className="text-slate-300 font-bold mb-1">Mesajlarınız</h3>
              <p className="font-mono text-xs tracking-widest text-slate-400 uppercase text-center max-w-sm">
                Sohbet detaylarını görmek ve mesajlaşmak için sol panelden bir ilan seçin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
