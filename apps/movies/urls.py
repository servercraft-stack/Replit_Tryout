from django.urls import path
from apps.movies.views import MovieListAPIView, MovieDetailAPIView

app_name = 'movies'

urlpatterns = [
    path('', MovieListAPIView.as_view(), name='movie-list'),
    path('<int:tmdb_id>/', MovieDetailAPIView.as_view(), name='movie-detail'),
]
