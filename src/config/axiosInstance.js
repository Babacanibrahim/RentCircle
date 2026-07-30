import axios from 'axios';
import { toast } from '../utils/alerts'; // Yolu kendi projene göre düzenle

const axiosInstance = axios.create({
    baseURL: 'http://localhost:8000/api/', // Backend'in kök API adresi
    headers: {
        'Content-Type': 'application/json',
    }
});

// GİDEN İSTEK (REQUEST) INTERCEPTOR'I
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 🎯 YENİ: GELEN YANIT (RESPONSE) INTERCEPTOR'I (401 KORUMASI)
axiosInstance.interceptors.response.use(
    (response) => {
        return response; // Hata yoksa aynen devam
    },
    (error) => {
        // Eğer sunucu "Yetkisiz (401)" dediyse ve şu an Login/Register sayfasında değilsek
        if (error.response && error.response.status === 401) {
            const currentPath = window.location.pathname;
            
            if (currentPath !== '/login' && currentPath !== '/register') {
                // Tokenları temizle
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                sessionStorage.removeItem('access_token');
                sessionStorage.removeItem('refresh_token');

                toast.fire({ icon: "warning", title: "Oturum süreniz doldu veya yetkiniz yok. Lütfen tekrar giriş yapın." });
                
                // Kullanıcıyı login'e şutla (Sayfayı tam yenileyerek)
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;