import axiosInstance from '../../../config/axiosInstance'; 

const getAuthHeader = () => {
  // Hem local hem session kontrol edilerek header oluşturuluyor
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const itemApi = {
  getListings: async () => { const res = await axiosInstance.get("items/listings/"); return res.data; },
  getCategories: async () => { const res = await axiosInstance.get("items/categories/"); return res.data; },
  getListingDetail: async (id) => { const res = await axiosInstance.get(`items/listings/${id}/`); return res.data; },
  getStoreDetail: async (ownerId) => { const res = await axiosInstance.get(`items/stores/${ownerId}/`); return res.data; },

  createListing: async (formData) => {
    const res = await axiosInstance.post("items/listings/", formData, {
      headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${localStorage.getItem("access_token") || sessionStorage.getItem("access_token")}` },
    });
    return res.data;
  },
  toggleFavorite: async (itemId) => { const res = await axiosInstance.post(`items/listings/${itemId}/favorite/`, {}, getAuthHeader()); return res.data; },
  getFavorites: async () => { const res = await axiosInstance.get("items/listings/my_favorites/", getAuthHeader()); return res.data; },

  // 🎯 YENİ: CÜZDAN İLE KİRALAMA VE ÖDEME UCU
  payWithWallet: async (itemId, bookingData) => {
    const res = await axiosInstance.post(`items/listings/${itemId}/pay-with-wallet/`, bookingData, getAuthHeader());
    return res.data;
  },

  createBooking: async (bookingData) => { const res = await axiosInstance.post("items/bookings/", bookingData, getAuthHeader()); return res.data; },
  getBookings: async () => { const res = await axiosInstance.get("items/bookings/", getAuthHeader()); return res.data; },
  approveBooking: async (bookingId) => { const res = await axiosInstance.post(`items/bookings/${bookingId}/approve/`, {}, getAuthHeader()); return res.data; },
  
  // FOTOĞRAF DESTEKLİ UÇLAR:
  handoverBooking: async (bookingId, formData) => {
    const response = await axiosInstance.post(`items/bookings/${bookingId}/handover/`, formData, {
      headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${localStorage.getItem("access_token") || sessionStorage.getItem("access_token")}` }
    });
    return response.data;
  },
  completeBooking: async (bookingId, formData) => {
    const response = await axiosInstance.post(`items/bookings/${bookingId}/complete/`, formData, {
      headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${localStorage.getItem("access_token") || sessionStorage.getItem("access_token")}` }
    });
    return response.data;
  },
  cancelBooking: async (bookingId) => { const res = await axiosInstance.post(`items/bookings/${bookingId}/cancel/`, {}, getAuthHeader()); return res.data; },
  
  // CHAT UÇLARI...
  getConversations: async () => { const res = await axiosInstance.get("items/conversations/", getAuthHeader()); return res.data; },
  getMessages: async (conversationId) => { const res = await axiosInstance.get(`items/conversations/${conversationId}/messages/`, getAuthHeader()); return res.data; },
  sendMessage: async (conversationId, content) => { const res = await axiosInstance.post(`items/conversations/${conversationId}/send_message/`, { content }, getAuthHeader()); return res.data; },
  startConversation: async (itemId, renterId, ownerId) => {
    const res = await axiosInstance.post("items/conversations/", { item: itemId, renter: renterId, owner: ownerId }, getAuthHeader());
    return res.data;
  },
  createReview: async (reviewData) => {
    const response = await axiosInstance.post("items/reviews/", reviewData, getAuthHeader());
    return response.data;
  },

  getNotifications: async () => { 
    const res = await axiosInstance.get("items/notifications/", getAuthHeader()); 
    return res.data; 
  },
  markNotificationsRead: async () => { 
    const res = await axiosInstance.patch("items/notifications/", {}, getAuthHeader()); 
    return res.data; 
  },
  deleteNotification: async (id) => { 
    const res = await axiosInstance.delete(`items/notifications/${id}/`, getAuthHeader()); 
    return res.data; 
  },
};