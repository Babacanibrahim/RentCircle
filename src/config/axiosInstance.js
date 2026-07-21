import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:8000/api/', // Backend'in kök API adresi
    headers: {
        'Content-Type': 'application/json',
    }
});

// GİDEN İSTEK (REQUEST) INTERCEPTOR'I
axiosInstance.interceptors.request.use(
    (config) => {
        // 🎯 ÇÖZÜM: Hem LocalStorage hem de SessionStorage'ı kontrol et
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        
        // Eğer token varsa (ister kalıcı ister geçici hafızada), paketin üzerine yapıştır
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default axiosInstance;