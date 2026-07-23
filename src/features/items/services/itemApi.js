import axiosInstance from '../../../config/axiosInstance'; 

const getAuthHeader = () => {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const itemApi = {
  // 🎯 DÜZELTME: Şehir ve İlçe filtrelerini artık Backend'e query parametresi olarak gönderiyoruz!
  getListings: async (filters = {}) => { 
    const queryParams = new URLSearchParams();
    if (filters.city) queryParams.append('city', filters.city);
    if (filters.district) queryParams.append('district', filters.district);
    
    const queryString = queryParams.toString();
    const url = queryString ? `items/listings/?${queryString}` : "items/listings/";
    
    const res = await axiosInstance.get(url); 
    return res.data; 
  },
  
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

  payWithWallet: async (itemId, bookingData) => {
    const res = await axiosInstance.post(`items/listings/${itemId}/pay-with-wallet/`, bookingData, getAuthHeader());
    return res.data;
  },

  createBooking: async (bookingData) => { const res = await axiosInstance.post("items/bookings/", bookingData, getAuthHeader()); return res.data; },
  getBookings: async () => { const res = await axiosInstance.get("items/bookings/", getAuthHeader()); return res.data; },
  approveBooking: async (bookingId) => { const res = await axiosInstance.post(`items/bookings/${bookingId}/approve/`, {}, getAuthHeader()); return res.data; },
  
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
  
  getConversations: async () => { const res = await axiosInstance.get("items/conversations/", getAuthHeader()); return res.data; },
  getMessages: async (conversationId) => { const res = await axiosInstance.get(`items/conversations/${conversationId}/messages/`, getAuthHeader()); return res.data; },
  sendMessage: async (conversationId, payload) => { 
    const res = await axiosInstance.post(`items/conversations/${conversationId}/send_message/`, payload, getAuthHeader()); 
    return res.data; 
  },
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

  checkConversationExists: async (itemId) => {
    // 🎯 Baştaki / kaldırıldı ve getAuthHeader eklendi
    const response = await axiosInstance.get(`items/conversations/check_existing/?item_id=${itemId}`, getAuthHeader());
    return response.data;
  },

  sendDirectMessage: async (payload) => {
    // 🎯 Baştaki / kaldırıldı ve getAuthHeader eklendi
    const response = await axiosInstance.post(`items/conversations/send_direct_message/`, payload, getAuthHeader());
    return response.data;
  },

  respondToOffer: async (messageId, action) => {
    // 🎯 Baştaki / kaldırıldı ve getAuthHeader eklendi
    const response = await axiosInstance.post(`items/conversations/respond_offer/`, { message_id: messageId, action }, getAuthHeader());
    return response.data;
  },

  clearAllNotifications: async () => {
    const response = await axiosInstance.delete('/items/notifications/clear_all/');
    return response.data;
  },
};