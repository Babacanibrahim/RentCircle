import axiosInstance from '../../../config/axiosInstance'; 

const getAuthHeader = () => {
  const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const multipartHeader = {
  "Content-Type": "multipart/form-data",
  Authorization: `Bearer ${localStorage.getItem("access_token") || sessionStorage.getItem("access_token")}`
};

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
  createCategory: async (data) => (await axiosInstance.post("items/categories/", data, getAuthHeader())).data,
  updateCategory: async (id, data) => (await axiosInstance.patch(`items/categories/${id}/`, data, getAuthHeader())).data,
  deleteCategory: async (id) => (await axiosInstance.delete(`items/categories/${id}/`, getAuthHeader())).data,
  getListingDetail: async (id) => (await axiosInstance.get(`items/listings/${id}/`)).data,
  getStoreDetail: async (ownerId) => (await axiosInstance.get(`items/stores/${ownerId}/`)).data,
  getMyListings: async () => (await axiosInstance.get('items/listings/my_listings/', getAuthHeader())).data,
  createListing: async (formData) => (await axiosInstance.post("items/listings/", formData, { headers: multipartHeader })).data,
  updateListing: async (id, data) => (await axiosInstance.patch(`items/listings/${id}/`, data, { 
    headers: data instanceof FormData ? multipartHeader : getAuthHeader().headers 
  })).data,
  toggleFavorite: async (itemId) => (await axiosInstance.post(`items/listings/${itemId}/favorite/`, {}, getAuthHeader())).data,
  getFavorites: async () => (await axiosInstance.get("items/listings/my_favorites/", getAuthHeader())).data,

  // --- KİRALAMA & ÖDEME ---
  createBooking: async (data) => (await axiosInstance.post("items/bookings/", data, getAuthHeader())).data,
  getBookings: async () => (await axiosInstance.get("items/bookings/", getAuthHeader())).data,
  payWithWallet: async (itemId, data) => (await axiosInstance.post(`items/listings/${itemId}/pay-with-wallet/`, data, getAuthHeader())).data,
  approveBooking: async (id) => (await axiosInstance.post(`items/bookings/${id}/approve/`, {}, getAuthHeader())).data,
  handoverBooking: async (id, formData) => (await axiosInstance.post(`items/bookings/${id}/handover/`, formData, { headers: multipartHeader })).data,
  completeBooking: async (id, formData) => (await axiosInstance.post(`items/bookings/${id}/complete_booking/`, formData, { headers: multipartHeader })).data,
  cancelBooking: async (id) => (await axiosInstance.post(`items/bookings/${id}/cancel/`, {}, getAuthHeader())).data,

  // --- UYUŞMAZLIK & ONAY SÜREÇLERİ ---
  approveHandover: async (id) => (await axiosInstance.post(`items/bookings/${id}/approve_handover/`, {}, getAuthHeader())).data,
  approveReturn: async (id) => (await axiosInstance.post(`items/bookings/${id}/approve_return/`, {}, getAuthHeader())).data,
  raiseDispute: async (id, data) => (await axiosInstance.post(`items/bookings/${id}/raise_dispute/`, data, getAuthHeader())).data,
  resolveDispute: async (id, data) => (await axiosInstance.post(`items/bookings/${id}/resolve_dispute/`, data, getAuthHeader())).data,

  // --- MESAJ & YORUM ---
  getConversations: async () => (await axiosInstance.get("items/conversations/", getAuthHeader())).data,
  getMessages: async (id) => (await axiosInstance.get(`items/conversations/${id}/messages/`, getAuthHeader())).data,
  sendMessage: async (id, payload) => (await axiosInstance.post(`items/conversations/${id}/send_message/`, payload, getAuthHeader())).data,
  startConversation: async (itemId, renter, owner) => (await axiosInstance.post("items/conversations/", { item: itemId, renter, owner }, getAuthHeader())).data,
  checkConversationExists: async (itemId) => (await axiosInstance.get(`items/conversations/check_existing/?item_id=${itemId}`, getAuthHeader())).data,
  sendDirectMessage: async (payload) => (await axiosInstance.post(`items/conversations/send_direct_message/`, payload, getAuthHeader())).data,
  respondToOffer: async (id, action) => (await axiosInstance.post(`items/conversations/respond_offer/`, { message_id: id, action }, getAuthHeader())).data,
  createReview: async (data) => (await axiosInstance.post("items/reviews/", data, getAuthHeader())).data,

  // --- BİLDİRİMLER ---
  getNotifications: async () => (await axiosInstance.get("items/notifications/", getAuthHeader())).data,
  markNotificationsRead: async () => (await axiosInstance.patch("items/notifications/", {}, getAuthHeader())).data,
  deleteNotification: async (id) => (await axiosInstance.delete(`items/notifications/${id}/`, getAuthHeader())).data,
  clearAllNotifications: async () => (await axiosInstance.delete('items/notifications/clear_all/', getAuthHeader())).data,

  // ==========================================
  // 🛡️ GOD MODE (ADMIN) ENDPOINTLERİ
  // ==========================================
  getAdminStats: async () => (await axiosInstance.get(`items/admin-dashboard/stats/`, getAuthHeader())).data,
  getDisputedBookings: async () => (await axiosInstance.get(`items/admin-dashboard/disputed_bookings/`, getAuthHeader())).data,
  getAdminUsers: async (search = "") => (await axiosInstance.get(`items/admin-dashboard/users_list/?search=${search}`, getAuthHeader())).data,
  updateAdminUser: async (data) => (await axiosInstance.post(`items/admin-dashboard/update_user/`, data, getAuthHeader())).data,
  adminDeleteUser: async (id) => (await axiosInstance.delete(`items/admin-dashboard/delete_user/?user_id=${id}`, getAuthHeader())).data,
  getAdminItems: async (search = "") => (await axiosInstance.get(`items/admin-dashboard/items_list/?search=${search}`, getAuthHeader())).data,
  adminUpdateItem: async (data) => (await axiosInstance.post(`items/admin-dashboard/admin_update_item/`, data, getAuthHeader())).data,
  toggleItemBan: async (id) => (await axiosInstance.post(`items/admin-dashboard/toggle_item_ban/`, { item_id: id }, getAuthHeader())).data,
  adminDeleteItem: async (id) => (await axiosInstance.delete(`items/admin-dashboard/delete_item/?item_id=${id}`, getAuthHeader())).data,
  getSystemLogs: async () => (await axiosInstance.get(`items/admin-dashboard/system_logs/`, getAuthHeader())).data,
  getAdminUserLogs: async (id) => (await axiosInstance.get(`items/admin-dashboard/user_logs/?user_id=${id}`, getAuthHeader())).data,
  requestWithdrawal: async (amount, iban, otpCode = null) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        
        // 🎯 YENİ: Eğer kullanıcı 6 haneli kod girdiyse, paketin (payload) içine ekle
        const payload = { amount, iban };
        if (otpCode) {
            payload.otp_code = otpCode;
        }

        const response = await axiosInstance.post('auth/wallet/withdraw/', payload, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        return response.data;
    },
  getAdminWithdrawals: async () => (await axiosInstance.get(`items/admin-dashboard/withdrawals_list/`, getAuthHeader())).data,
  handleAdminWithdrawal: async (data) => (await axiosInstance.post(`items/admin-dashboard/handle_withdrawal/`, data, getAuthHeader())).data,
  submitReport: async (data) => (await axiosInstance.post("items/reports/submit/", data, getAuthHeader())).data,
  getAdminReports: async () => (await axiosInstance.get(`items/admin-dashboard/reports_list/`, getAuthHeader())).data,
  handleAdminReport: async (data) => (await axiosInstance.post(`items/admin-dashboard/handle_report/`, data, getAuthHeader())).data,
  createTicket: async (formData) => {
      const response = await axiosInstance.post(`items/tickets/`, formData, {
          headers: { "Content-Type": "multipart/form-data", ...getAuthHeader().headers }
      });
      return response.data;
  },
  submitReport: async (formData) => {
      const response = await axiosInstance.post(`items/reports/submit/`, formData, {
          headers: { "Content-Type": "multipart/form-data", ...getAuthHeader().headers }
      });
      return response.data;
  },
  getAdminTickets: async () => (await axiosInstance.get(`items/tickets/`, getAuthHeader())).data,
  adminCloseTicket: async (id) => (await axiosInstance.patch(`items/tickets/${id}/`, { status: 'closed' }, getAuthHeader())).data,
  manageWallet: async (data) => (await axiosInstance.post(`items/admin-dashboard/manage_wallet/`, data, getAuthHeader())).data,
  banEntity: async (data) => (await axiosInstance.post(`items/admin-dashboard/ban_entity/`, data, getAuthHeader())).data,
  replyToSupport: async (data) => (await axiosInstance.post(`items/admin-dashboard/reply_to_support/`, data, getAuthHeader())).data,
};