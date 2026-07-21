import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { itemApi } from "../services/itemApi";

const Chat = () => {
  const navigate = useNavigate();
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
    const fetchConversations = () => {
      itemApi
        .getConversations()
        .then((data) => {
          setConversations(data.results ? data.results : data);
        })
        .catch((err) => console.error("Sohbetler yüklenemedi:", err));
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // 🎯 ÇÖZÜM: Sadece YENİ mesaj geldiğinde aşağı kaydırma mantığı
  useEffect(() => {
    let interval;
    if (activeChat) {
      let currentMsgCount = 0; // Kaydırmayı engellemek için yerel takip değişkeni

      const fetchMessages = () => {
        itemApi
          .getMessages(activeChat.id)
          .then((data) => {
            const fetchedMessages = data.results ? data.results : data;
            setMessages(fetchedMessages);

            // Gelen mesaj sayısı öncekiden büyükse yeni mesaj var demektir -> SADECE O ZAMAN KAYDIR
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
    }

    // Geçmişteki "her mesaj state'i değiştiğinde kaydır" olan bozuk useEffect'i tamamen kaldırdık!
    return () => clearInterval(interval);
  }, [activeChat]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const messageContent = newMessage;
    setNewMessage("");

    try {
      const sentMessage = await itemApi.sendMessage(activeChat.id, messageContent);
      setMessages((prev) => [...prev, sentMessage]);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      const updatedChats = await itemApi.getConversations();
      setConversations(updatedChats.results ? updatedChats.results : updatedChats);
    } catch (error) {
      console.error("Mesaj iletilemedi:", error.response || error);
      alert("Mesajınız iletilemedi. Lütfen bağlantınızı kontrol edin.");
      setNewMessage(messageContent);
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
    const isOwner = String(chat.owner).toLowerCase() === currentUserId;
    return {
      id: isOwner ? chat.renter : chat.owner,
      name: isOwner ? chat.renter_name : chat.owner_name,
      role: isOwner ? "Kiracı Adayı" : "İlan Sahibi",
    };
  };

  return (
    <div className="w-full relative h-screen flex flex-col overflow-hidden bg-[#1e293b]">
      <div className="absolute top-20 left-1/3 w-96 h-96 bg-blue-500/5 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full flex-1 flex gap-5 p-4 sm:p-6 lg:p-8 min-h-0 relative z-10">
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
                const partner = getPartnerInfo(chat);
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
                      <div className="text-[10px] text-blue-400 font-medium truncate mb-1">{partner.name}</div>
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

        <div className="cyber-card flex-1 flex flex-col h-full overflow-hidden">
          {activeChat ? (
            <>
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
                      <span
                        onClick={() => navigate(`/stores/${getPartnerInfo(activeChat).id}`)}
                        className="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer transition-all">
                        {getPartnerInfo(activeChat).name}
                      </span>
                      <span className="text-[9px] bg-slate-700/50 px-1.5 py-0.5 rounded font-mono">{getPartnerInfo(activeChat).role}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate(`/listings/${activeChat.item}`)} className="btn-slate text-[10px] !py-1.5 !px-3">
                  İlana Git ↗
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin flex flex-col bg-[#0f172a]/15">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center flex-col text-slate-500">
                    <span className="text-3xl mb-2">👋</span>
                    <p className="text-xs font-mono">Henüz mesaj yok. İlk adımı sen at!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.sender).toLowerCase() === currentUserId;

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

              <form onSubmit={handleSendMessage} className="p-4 border-t border-[#475569]/40 bg-[#0f172a]/30 flex gap-2.5 items-center">
                <motion.input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="cyber-input flex-1 !rounded-full !px-5 !py-3 border-[#475569]/50 shadow-inner"
                  whileFocus={{ border_color: "#3b82f6" }}
                />
                <motion.button
                  type="submit"
                  disabled={!newMessage.trim()}
                  whileHover={newMessage.trim() ? { scale: 1.03 } : {}}
                  whileTap={newMessage.trim() ? { scale: 0.97 } : {}}
                  className={`btn-gradient !rounded-full !px-6 !py-3 h-full flex items-center justify-center font-bold tracking-wider uppercase transition-all shrink-0 ${
                    !newMessage.trim() ? "opacity-30 cursor-not-allowed shadow-none" : "cursor-pointer"
                  }`}>
                  Gönder 🚀
                </motion.button>
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
