import axios from 'axios';
import { toast } from '../utils/alerts';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL + '/', // 🎯 YENİ
    headers: {
        'Content-Type': 'application/json',
    }
});

// GİDEN İSTEK: Her isteğin kafasına Access Token'ı yapıştır
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        
        return config;
    },
    (error) => Promise.reject(error)
);

// 🎯 YENİ: SESSİZ YENİLEME (SILENT REFRESH) MEKANİZMASI
axiosInstance.interceptors.response.use(
    (response) => {
        return response; 
    },
    async (error) => {
        const originalRequest = error.config;

        // Eğer hata 401 ise ve bu istek daha önce tekrar denenmemişse (_retry bayrağı yoksa)
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // Sonsuz döngüyü engellemek için işaretle

            try {
    const refreshToken = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
    
    if (refreshToken) {
        // 1. Arka planda yeni token'ları iste
        const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh/`, { // 🎯 YENİ
            refresh: refreshToken
        });

        const newAccessToken = response.data.access;
        // 🎯 EKSİK Olan Parça Burası: Sunucunun döndüğü yeni Refresh Token'ı da alıyoruz!
        const newRefreshToken = response.data.refresh; 
        
        // 2. Token'ları depolara güncel olarak kaydet
        if (localStorage.getItem('access_token')) {
            localStorage.setItem('access_token', newAccessToken);
            if (newRefreshToken) {
                localStorage.setItem('refresh_token', newRefreshToken); // 👈 YENİ REFRESH TOKEN KAYDEDİLİYOR
            }
        } else {
            sessionStorage.setItem('access_token', newAccessToken);
            if (newRefreshToken) {
                sessionStorage.setItem('refresh_token', newRefreshToken); // 👈 YENİ REFRESH TOKEN KAYDEDİLİYOR
            }
        }

        // 3. Başarısız olan orijinal isteği yeni access token ile tekrar gönder
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
    }
} catch (refreshError) {
                // EĞER REFRESH TOKEN DA ÖLMÜŞSE (Veya Kara Listeye Alınmışsa) İŞTE ŞİMDİ SİSTEMDEN AT!
                const currentPath = window.location.pathname;
                if (currentPath !== '/login' && currentPath !== '/register') {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    sessionStorage.removeItem('access_token');
                    sessionStorage.removeItem('refresh_token');

                    toast.fire({ icon: "warning", title: "Oturum süreniz doldu. Lütfen tekrar giriş yapın." });
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;