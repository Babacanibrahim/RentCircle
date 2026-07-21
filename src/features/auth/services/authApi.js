import axiosInstance from '../../../config/axiosInstance';

export const authApi = {
    register: async (userData) => {
        const response = await axiosInstance.post('auth/register/', userData);
        return response.data;
    },
    login: async (credentials) => {
        const response = await axiosInstance.post('auth/login/', credentials);
        return response.data;
    },
    // YENİ EKLENEN GERÇEK LOGOUT UCUMUZ:
    logout: async (refreshToken) => {
        // Backend'deki header koruması (Bearer) için token gönderimini ayarla
        const accessToken = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.post('auth/logout/', 
            { refresh_token: refreshToken },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return response.data;
    },

    getProfile: async () => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.get('auth/me/', { headers: { Authorization: `Bearer ${token}` } });
        return response.data;
    },
    updateProfile: async (profileData) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        // Güncelleme için aynı 'auth/me/' adresine PATCH isteği atıyoruz
        const response = await axiosInstance.patch('auth/me/', profileData, { headers: { Authorization: `Bearer ${token}` } });
        return response.data;
    },
    changePassword: async (passwordData) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.post('auth/change-password/', passwordData, { headers: { Authorization: `Bearer ${token}` } });
        return response.data;
    },

    forgotPasswordRequest: async (data) => {
        const response = await axiosInstance.post('auth/forgot-password/', data);
        return response.data;
    },
    verifyOtp: async (data) => {
        const response = await axiosInstance.post('auth/verify-otp/', data);
        return response.data;
    },
    resetPasswordConfirm: async (data) => {
        const response = await axiosInstance.post('auth/reset-password/', data);
        return response.data;
    },
   
};

export const walletApi = {
    getWalletDetails: async () => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.get('auth/wallet/', { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        return response.data;
    },
    
    initiateDeposit: async (amount) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.post('auth/wallet/deposit/initiate/', { amount }, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        // İyzico'dan dönen veri string formatındaysa JSON'a çeviriyoruz
        const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
        return data;
    },
    
    requestWithdrawal: async (amount, iban) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.post('auth/wallet/withdraw/', { amount, iban }, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        return response.data;
    }
};