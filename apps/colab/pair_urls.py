from django.urls import path

from . import pair_views

app_name = "pair"

urlpatterns = [
    path("", pair_views.create_session, name="create"),
    path("<uuid:token>/", pair_views.session_page, name="session"),
]
