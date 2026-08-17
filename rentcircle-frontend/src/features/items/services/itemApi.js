import axiosInstance from '../../../config/axiosInstance'; 

// 🎯 DİKKAT: getAuthHeader ve multipartHeader TAMAMEN SİLİNDİ!
// Çünkü axiosInstance içindeki Interceptor zaten her isteğe Token ekliyor.
// Axios, formData gönderdiğimizi gördüğünde Content-Type ayarını da otomatik (Boundary ile) kendi yapar!

export const itemApi = {
  // --- İLAN & MAĞAZA İŞLEMLERİ ---
  getListings: async (filters = {}) => { 
    const queryParams = new URLSearchParams();
    if (filters.city) queryParams.append('city', filters.city);
    if (filters.district) queryParams.append('district', filters.district);
    if (filters.search) queryParams.append('search', filters.search); 
    const url = queryParams.toString() ? `items/listings/?${queryParams.toString()}` : "items/listings/";
    const res = await axiosInstance.get(url); 
    return res.data; 
  },
  getCategories: async () => (await axiosInstance.get("items/categories/")).data,
  createCategory: async (data) => (await axiosInstance.post("items/categories/", data)).data,
  updateCategory: async (id, data) => (await axiosInstance.patch(`items/categories/${id}/`, data)).data,
  deleteCategory: async (id) => (await axiosInstance.delete(`items/categories/${id}/`)).data,
  getListingDetail: async (id) => (await axiosInstance.get(`items/listings/${id}/`)).data,
  getStoreDetail: async (ownerId) => (await axiosInstance.get(`items/stores/${ownerId}/`)).data,
  getMyListings: async () => (await axiosInstance.get('items/listings/my_listings/')).data,
  
  // 📸 FOTOĞRAFLI İŞLEM: Sadece formData veriyoruz, hiçbir header ayarı yapmıyoruz!
  createListing: async (formData) => (await axiosInstance.post("items/listings/", formData)).data,
  updateListing: async (id, data) => (await axiosInstance.patch(`items/listings/${id}/`, data)).data,
  
  toggleFavorite: async (itemId) => (await axiosInstance.post(`items/listings/${itemId}/favorite/`, {})).data,
  getFavorites: async () => (await axiosInstance.get("items/listings/my_favorites/")).data,

  // --- KİRALAMA & ÖDEME ---
  createBooking: async (data) => (await axiosInstance.post("items/bookings/", data)).data,
  getBookings: async () => (await axiosInstance.get("items/bookings/")).data,
  payWithWallet: async (itemId, data) => (await axiosInstance.post(`items/listings/${itemId}/pay-with-wallet/`, data)).data,
  approveBooking: async (id) => (await axiosInstance.post(`items/bookings/${id}/approve/`, {})).data,
  
  // 📸 FOTOĞRAFLI İŞLEMLER
  handoverBooking: async (id, formData) => (await axiosInstance.post(`items/bookings/${id}/handover/`, formData)).data,
  completeBooking: async (id, formData) => (await axiosInstance.post(`items/bookings/${id}/complete_booking/`, formData)).data,
  
  cancelBooking: async (id) => (await axiosInstance.post(`items/bookings/${id}/cancel/`, {})).data,

  // --- UYUŞMAZLIK & ONAY SÜREÇLERİ ---
  approveHandover: async (id) => (await axiosInstance.post(`items/bookings/${id}/approve_handover/`, {})).data,
  approveReturn: async (id) => (await axiosInstance.post(`items/bookings/${id}/approve_return/`, {})).data,
  raiseDispute: async (id, data) => (await axiosInstance.post(`items/bookings/${id}/raise_dispute/`, data)).data,
  resolveDispute: async (id, data) => (await axiosInstance.post(`items/bookings/${id}/resolve_dispute/`, data)).data,

  // --- MESAJ & YORUM ---
  getConversations: async () => (await axiosInstance.get("items/conversations/")).data,
  getMessages: async (id) => (await axiosInstance.get(`items/conversations/${id}/messages/`)).data,
  sendMessage: async (id, payload) => (await axiosInstance.post(`items/conversations/${id}/send_message/`, payload)).data,
  startConversation: async (itemId, renter, owner) => (await axiosInstance.post("items/conversations/", { item: itemId, renter, owner })).data,
  checkConversationExists: async (itemId) => (await axiosInstance.get(`items/conversations/check_existing/?item_id=${itemId}`)).data,
  sendDirectMessage: async (payload) => (await axiosInstance.post(`items/conversations/send_direct_message/`, payload)).data,
  respondToOffer: async (id, action) => (await axiosInstance.post(`items/conversations/respond_offer/`, { message_id: id, action })).data,
  createReview: async (data) => (await axiosInstance.post("items/reviews/", data)).data,

  // --- BİLDİRİMLER ---
  getNotifications: async () => (await axiosInstance.get("items/notifications/")).data,
  markNotificationsRead: async () => (await axiosInstance.patch("items/notifications/", {})).data,
  deleteNotification: async (id) => (await axiosInstance.delete(`items/notifications/${id}/`)).data,
  clearAllNotifications: async () => (await axiosInstance.delete('items/notifications/clear_all/')).data,

  // ==========================================
  // 🛡️ GOD MODE (ADMIN) ENDPOINTLERİ
  // ==========================================
  getAdminStats: async () => (await axiosInstance.get(`items/admin-dashboard/stats/`)).data,
  getDisputedBookings: async () => (await axiosInstance.get(`items/admin-dashboard/disputed_bookings/`)).data,
  getAdminUsers: async (search = "") => (await axiosInstance.get(`items/admin-dashboard/users_list/?search=${search}`)).data,
  updateAdminUser: async (data) => (await axiosInstance.post(`items/admin-dashboard/update_user/`, data)).data,
  adminDeleteUser: async (id) => (await axiosInstance.delete(`items/admin-dashboard/delete_user/?user_id=${id}`)).data,
  getAdminItems: async (search = "") => (await axiosInstance.get(`items/admin-dashboard/items_list/?search=${search}`)).data,
  adminUpdateItem: async (data) => (await axiosInstance.post(`items/admin-dashboard/admin_update_item/`, data)).data,
  toggleItemBan: async (id) => (await axiosInstance.post(`items/admin-dashboard/toggle_item_ban/`, { item_id: id })).data,
  adminDeleteItem: async (id) => (await axiosInstance.delete(`items/admin-dashboard/delete_item/?item_id=${id}`)).data,
  getSystemLogs: async () => (await axiosInstance.get(`items/admin-dashboard/system_logs/`)).data,
  getAdminUserLogs: async (id) => (await axiosInstance.get(`items/admin-dashboard/user_logs/?user_id=${id}`)).data,
  getAdminWithdrawals: async () => (await axiosInstance.get(`items/admin-dashboard/withdrawals_list/`)).data,
  handleAdminWithdrawal: async (data) => (await axiosInstance.post(`items/admin-dashboard/handle_withdrawal/`, data)).data,
  getAdminReports: async () => (await axiosInstance.get(`items/admin-dashboard/reports_list/`)).data,
  handleAdminReport: async (data) => (await axiosInstance.post(`items/admin-dashboard/handle_report/`, data)).data,
  getAdminTickets: async () => (await axiosInstance.get(`items/tickets/`)).data,
  adminCloseTicket: async (id) => (await axiosInstance.patch(`items/tickets/${id}/`, { status: 'closed' })).data,
  manageWallet: async (data) => (await axiosInstance.post(`items/admin-dashboard/manage_wallet/`, data)).data,
  banEntity: async (data) => (await axiosInstance.post(`items/admin-dashboard/ban_entity/`, data)).data,
  replyToSupport: async (data) => (await axiosInstance.post(`items/admin-dashboard/reply_to_support/`, data)).data,
  
  // 📸 FOTOĞRAFLI/DOSYALI DESTEK İŞLEMLERİ
  createTicket: async (formData) => (await axiosInstance.post(`items/tickets/`, formData)).data,
  submitReport: async (formData) => (await axiosInstance.post(`items/reports/submit/`, formData)).data,
};