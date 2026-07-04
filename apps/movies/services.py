import requests
from django.conf import settings
from django.utils.text import slugify
from apps.movies.models import Movie, Genre

class TMDBService:
    def __init__(self):
        self.headers = {
            "accept": "application/json",
            "Authorization": f"Bearer {settings.TMDB_ACCESS_TOKEN}"
        }
        self.base_url = "https://api.themoviedb.org/3"

    def fetch_and_sync_movie(self, tmdb_id):
        url = f"{self.base_url}/movie/{tmdb_id}"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code != 200:
            return None
            
        data = response.json()
        
        movie, created = Movie.objects.update_or_create(
            tmdb_id=data.get('id'),
            defaults={
                'title': data.get('title'),
                'imdb_id': data.get('imdb_id'),
                'overview': data.get('overview', ''),
                'poster_path': data.get('poster_path', ''),
                'backdrop_path': data.get('backdrop_path', ''),
                'release_date': data.get('release_date') or None,
                'runtime': data.get('runtime'),
                'vote_average': data.get('vote_average', 0.0),
            }
        )
        
        for genre_data in data.get('genres', []):
            genre, _ = Genre.objects.get_or_create(
                name=genre_data.get('name'),
                defaults={'slug': slugify(genre_data.get('name'))}
            )
            movie.genres.add(genre)
            
        return movie
