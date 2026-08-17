from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Kullanıcının hem email hem de username ile giriş yapabilmesini sağlayan
    endüstri standardı özel kimlik doğrulama sınıfı.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
            
        try:
            user = User.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
        except User.DoesNotExist:
            return None
        except User.MultipleObjectsReturned:
            # Güvenlik önlemi: Eğer beklenmedik şekilde birden fazla dönerse ilki alınır
            user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username)).first()
            
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None