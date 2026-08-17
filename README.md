# 🔄 RentCircle

📌 **Proje Hakkında**

RentCircle, kullanıcıların sahip oldukları eşyaları kiraya verebildiği veya ihtiyaç duydukları eşyaları diğer kullanıcılardan kiralayabildiği, güvenlik odaklı bir **Peer-to-Peer (P2P) eşya kiralama ve paylaşım platformudur.**

Platform; kullanıcı yönetimi, ilan oluşturma, rezervasyon, güvenli ödeme, dijital cüzdan, gerçek zamanlı mesajlaşma, fiyat pazarlığı, konum paylaşımı ve çok katmanlı moderasyon mekanizmalarını tek bir ekosistem altında birleştirir.

---

## 🚀 Öne Çıkan Özellikler

### 🔐 Zero-Trust Güvenli Ödeme Sistemi

RentCircle'da ödeme süreci doğrudan satıcıya para gönderme mantığıyla çalışmaz. Ödeme akışı, marketplace yapısına uygun şekilde **iyzico altyapısı** üzerinden gerçekleştirilir.

Platform ayrıca kullanıcıların kazançlarını yönetebildiği bir **dijital cüzdan sistemi** sunar.

### ⚡ Gerçek Zamanlı Sohbet ve Pazarlık

RentCircle, gerçek zamanlı iletişim için `Django Channels`, `WebSocket`, `ASGI` ve `Redis` teknolojilerini kullanır.

Kullanıcılar:

- Anlık mesajlaşabilir.
- Kiralama fiyatı için teklif verebilir.
- Gelen teklifleri kabul veya reddedebilir.
- Buluşma noktası paylaşabilir.

### 🔑 İki Faktörlü Kimlik Doğrulama (2FA)

Hassas finansal işlemler ek güvenlik katmanı ile korunmaktadır.

Özellikle cüzdandan para çekme işlemlerinde kullanıcıdan **TOTP tabanlı 2FA** kodu istenir. Google Authenticator gibi uygulamalar kullanılarak oluşturulan doğrulama kodu girilmeden finansal işlem yapılamaz.

### 🛡️ Çok Katmanlı Moderasyon ve Ceza Sistemi

Yöneticiler kullanıcılar üzerinde **İlan Yasağı**, **Mesajlaşma Yasağı**, **Geçici/Süresiz Hesap Banı** gibi kısıtlamalar uygulayabilir.

Ayrıca **Silent Polling** mekanizması sayesinde uygulamada aktif olan kullanıcıların yeni kısıtlamaları sayfayı tamamen yenilemeden algılaması sağlanır.

### 📅 Rezervasyon ve Kiralama Yönetimi

Kullanıcılar ilan detay sayfasındaki interaktif takvim üzerinden kiralama tarihlerini seçebilir.

Sistem seçilen tarihlere göre kiralama ücretini ve **%15 depozito tutarını** otomatik hesaplar.

---

## 🏗️ Sistem Mimarisi

```text
                         ┌──────────────────────┐
                         │      React UI        │
                         │    Vite + Tailwind   │
                         └──────────┬───────────┘
                                    │
                         REST API / WebSocket
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │        Django        │
                         │         DRF          │
                         └──────────┬───────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               ▼                    ▼                    ▼
       ┌──────────────┐     ┌──────────────┐    ┌──────────────┐
       │ PostgreSQL   │     │    Redis     │    │    iyzico    │
       │   / SQLite   │     │  Channels    │    │   Payments   │
       └──────────────┘     └──────────────┘    └──────────────┘
```

---

## 🖥️ Ekran Görüntüleri

### 1. Ana Vitrin ve Gelişmiş Arama

### 2. İlan Detayları ve Rezervasyon

### 3. Gerçek Zamanlı Sohbet ve Pazarlık

### 4. Cüzdan ve 2FA

### 5. Admin ve Moderasyon Paneli

> **Not:** Proje kapak görseli için `docs/images/0_banner.png` dosyasına göz atabilirsiniz.

---

## 🛠️ Teknoloji Yığını

### Backend

| **Teknoloji**               | **Kullanım Alanı**                         |
| --------------------------- | ------------------------------------------ |
| **Python 3.12**             | Backend programlama dili                   |
| **Django 5.x**              | Web framework                              |
| **Django REST Framework**   | REST API Mimarisi                          |
| **Django Channels & Redis** | WebSocket & Gerçek zamanlı iletişim        |
| **SimpleJWT & PyOTP**       | Token Rotation & TOTP 2FA kimlik doğrulama |
| **iyzico API**              | Ödeme altyapısı                            |

### Frontend

| **Teknoloji**                    | **Kullanım Alanı**                    |
| -------------------------------- | ------------------------------------- |
| **React (Vite)**                 | Kullanıcı arayüzü ve build altyapısı  |
| **Tailwind CSS & Framer Motion** | Arayüz tasarımı ve animasyonlar       |
| **Axios**                        | HTTP istemcisi (Interceptor destekli) |
| **React Leaflet & OSM**          | Harita ve konum entegrasyonu          |

---

## 🔒 Güvenlik Mimarisi

Güvenlik, RentCircle'ın temel tasarım prensiplerinden biridir.

**Güvenlik Bileşenleri:**

- JWT Authentication ve Token Rotation (Sessiz Yenileme)
- Permission tabanlı API erişimi
- TOTP tabanlı 2FA (Para çekme koruması)
- Dosya güvenlik kontrolleri (Magic Bytes analizi)
- Kullanıcı kısıtlama (Ban/Mute) sistemi
- Çok katmanlı URL ve erişim (Route Guarding) koruması

---

## 📁 Proje Yapısı

RentCircle, backend ve frontend uygulamalarını tek bir repository altında barındıran bir **monorepo** olarak yapılandırılmıştır.

Önceden bağımsız olan projeler, geçmiş commit kayıtları korunarak **Git Subtree** ile birleştirilmiştir.

```text
RentCircle/
├── rentcircle-backend/     # Django API & WebSockets
├── rentcircle-frontend/    # React SPA
├── docs/images/            # Ekran Görüntüleri
├── LICENSE
└── README.md
```

---

## ⚙️ Kurulum Rehberi

### Gereksinimler

- Python 3.12+
- Node.js 20+
- Redis Server (WebSocket için aktif olmalıdır)

### 1. Repository'yi Klonlayın

```bash
git clone https://github.com/Babacanibrahim/RentCircle.git
cd RentCircle
```

### 2. Backend Kurulumu

```bash
cd rentcircle-backend
python -m venv venv

# Windows için:
venv\Scripts\activate

# Linux / macOS için:
source venv/bin/activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# .env dosyasını oluşturun
copy .env.example .env

# Veritabanını oluşturun ve sunucuyu başlatın
python manage.py migrate
python manage.py runserver
```

### 3. Frontend Kurulumu

Yeni bir terminal açın:

```bash
cd rentcircle-frontend

npm install

# .env dosyasını oluşturun
copy .env.example .env

npm run dev
```

> **🔑 Önemli Not:** Projenin çalışabilmesi için `.env` dosyalarındaki gizli anahtarları (Redis URL, iyzico Key, SMTP bilgileri vb.) kendi servislerinizden alarak doldurmanız gerekmektedir. Bu dosyaları asla GitHub'a göndermeyin.

---

## 🗺️ Yol Haritası (Gelecek Hedefleri)

- [ ] Kullanıcılar arası puanlama ve yorum (Rating/Review) sistemi
- [ ] Google ve GitHub hesapları ile tek tıkla giriş (OAuth)
- [ ] Kategori ve lokasyon bazlı gelişmiş öneri algoritması
- [ ] "Şifremi Unuttum" ve "E-Posta Doğrulama" akışlarının eklenmesi
- [ ] Admin panelinde gelişmiş grafiksel analiz (Analytics) raporları

---

## 📄 Lisans

Bu proje **MIT License** altında lisanslanmıştır. Detaylar için `LICENSE` dosyasını inceleyebilirsiniz.

---

## 👨‍💻 Geliştirici

**İbrahim Babacan**

_Bilgisayar Mühendisi | Backend Development & Cybersecurity_

- **GitHub:** [@Babacanibrahim](https://github.com/Babacanibrahim)
- **LinkedIn:** [20ibrahimbabacan20](https://linkedin.com/in/20ibrahimbabacan20)
- **E-posta:** babacan-1907@outlook.com.tr
