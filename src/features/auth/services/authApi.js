import axiosInstance from '../../../config/axiosInstance';

export const authApi = {
    // --- KİMLİK DOĞRULAMA (AUTH) ---
    register: async (userData) => {
        const response = await axiosInstance.post('auth/register/', userData);
        return response.data;
    },
    login: async (credentials) => {
        const response = await axiosInstance.post('auth/login/', credentials);
        return response.data;
    },
    logout: async (refreshToken) => {
        const accessToken = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.post('auth/logout/', 
            { refresh_token: refreshToken },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return response.data;
    },

    // --- PROFİL VE ŞİFRE İŞLEMLERİ ---
    getProfile: async (customToken = null) => {
        const token = customToken || localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.get('auth/me/', { headers: { Authorization: `Bearer ${token}` } });
        return response.data;
    },
    updateProfile: async (profileData) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
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

    // --- 2FA İŞLEMLERİ ---
    setup2FA: async () => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.get('auth/2fa/setup/', { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        return response.data;
    },
    verify2FA: async (code) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.post('auth/2fa/verify/', { code }, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        return response.data;
    },
    disable2FA: async (code) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        const response = await axiosInstance.post('auth/2fa/disable/', { code }, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        return response.data;
    }
};

export const walletApi = {
    // --- CÜZDAN İŞLEMLERİ ---
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
        return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    },
    
    // 🎯 DÜZELTME BURADA: 403 Hatasını çözen 2FA Kod gönderim mantığı asıl yeri olan buraya eklendi!
    requestWithdrawal: async (amount, iban, otpCode = null) => {
        const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
        
        const payload = { amount, iban };
        if (otpCode) {
            payload.otp_code = otpCode;
        }

        const response = await axiosInstance.post('auth/wallet/withdraw/', payload, { 
            headers: { Authorization: `Bearer ${token}` } 
        });
        return response.data;
    },
};