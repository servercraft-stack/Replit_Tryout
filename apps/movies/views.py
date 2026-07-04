from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from apps.movies.models import Movie, Genre
from apps.movies.serializers import MovieListSerializer, MovieDetailSerializer
from apps.movies.services import TMDBService

class MovieListAPIView(generics.ListAPIView):
    serializer_class = MovieListSerializer

    def get_queryset(self):
        queryset = Movie.objects.filter(is_active=True)
        genre_slug = self.request.query_params.get('genre', None)
        if genre_slug is not None:
            queryset = queryset.filter(genres__slug=genre_slug)
        return queryset

class MovieDetailAPIView(APIView):
    def get(self, request, tmdb_id, *args, **kwargs):
        movie = Movie.objects.filter(tmdb_id=tmdb_id, is_active=True).first()
        
        if not movie:
            tmdb_service = TMDBService()
            movie = tmdb_service.fetch_and_sync_movie(tmdb_id)
            
            if not movie:
                return Response(
                    {"error": "Movie not found on provider networks."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        serializer = MovieDetailSerializer(movie)
        return Response(serializer.data, status=status.HTTP_200_OK)
