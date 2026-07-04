from rest_framework import serializers
from apps.movies.models import Movie, Genre

class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ['id', 'name', 'slug']

class MovieListSerializer(serializers.ModelSerializer):
    genres = GenreSerializer(many=True, read_only=True)

    class Meta:
        model = Movie
        fields = [
            'id', 
            'title', 
            'tmdb_id', 
            'poster_path', 
            'release_date', 
            'vote_average', 
            'genres'
        ]

class MovieDetailSerializer(serializers.ModelSerializer):
    genres = GenreSerializer(many=True, read_only=True)
    stream_url = serializers.SerializerMethodField()

    class Meta:
        model = Movie
        fields = [
            'id', 
            'title', 
            'tmdb_id', 
            'imdb_id', 
            'overview', 
            'poster_path', 
            'backdrop_path', 
            'release_date', 
            'runtime', 
            'vote_average', 
            'genres',
            'stream_url',
            'created_at'
        ]

    def get_stream_url(self, obj):
        return obj.embed_url
