# core/exceptions.py
from rest_framework.views import exception_handler
from rest_framework.exceptions import Throttled

def custom_exception_handler(exc, context):
    # Önce Django'nun standart hata yakalayıcısını çağırıyoruz
    response = exception_handler(exc, context)

    # Eğer hata "Throttled" (Hız Sınırına Takılma) ise mesajı Türkçeleştiriyoruz
    if isinstance(exc, Throttled):
        # exc.wait bize kaç saniye beklemesi gerektiğini verir
        response.data = {
            'error': f'Çok fazla deneme yaptınız. Güvenliğiniz için lütfen {exc.wait} saniye bekleyip tekrar deneyin.'
        }

    return response