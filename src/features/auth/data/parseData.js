// citiesAndDistricts.js dosyasındaki ham veriyi içeri alıyoruz
import rawTurkeyData from './citiesAndDistricts';

const formattedTurkeyData = {};

rawTurkeyData.forEach(item => {
    // Veritabanı tutarlılığı için şehir ve ilçe isimlerini standartlaştırıyoruz
    const cityName = item.il.trim();
    const districtName = item.ilce.trim();
    const regionName = item.bolge.trim();
    
    // Eğer bu şehir nesnemizde henüz oluşturulmadıysa, şablonunu açıyoruz
    if (!formattedTurkeyData[cityName]) {
        formattedTurkeyData[cityName] = {
            region: regionName, // İleride filtrelemede kullanacağın BÖLGE bilgisi
            districts: []       // O ile ait ilçelerin dizisi
        };
    }
    
    // İlçeyi, o şehrin ilçeler dizisine (eğer yoksa) ekliyoruz
    if (!formattedTurkeyData[cityName].districts.includes(districtName)) {
        formattedTurkeyData[cityName].districts.push(districtName);
    }
});

// Artık jilet gibi temizlenmiş veriyi dışarı aktarıyoruz
export default formattedTurkeyData;