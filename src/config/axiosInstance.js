import axios from 'axios';
import { toast } from '../utils/alerts';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:8000/api/',
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
                    // 1. Arka planda sessizce yeni token iste
                    const response = await axios.post('http://localhost:8000/api/auth/refresh/', {
                        refresh: refreshToken
                    });

                    // 2. Yeni gelen Access Token'ı kaydet
                    const newAccessToken = response.data.access;
                    
                    if (localStorage.getItem('access_token')) {
                        localStorage.setItem('access_token', newAccessToken);
                    } else {
                        sessionStorage.setItem('access_token', newAccessToken);
                    }

                    // 3. Başarısız olan orijinal isteğin başlığını yeni token ile değiştir ve tekrar gönder!
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