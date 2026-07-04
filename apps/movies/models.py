from django.db import models
from django.conf import settings

class Genre(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Movie(models.Model):
    title = models.CharField(max_length=255)
    tmdb_id = models.PositiveIntegerField(unique=True)
    imdb_id = models.CharField(max_length=20, blank=True, null=True)
    overview = models.TextField(blank=True)
    poster_path = models.CharField(max_length=255, blank=True)
    backdrop_path = models.CharField(max_length=255, blank=True)
    release_date = models.DateField(null=True, blank=True)
    runtime = models.PositiveIntegerField(null=True, blank=True)
    vote_average = models.FloatField(default=0.0)
    genres = models.ManyToManyField(Genre, related_name='movies')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-release_date']

    def __str__(self):
        return self.title

    @property
    def embed_url(self):
        base_url = "https://api.codespecters.com/embed/movie/"
        return f"{base_url}{self.tmdb_id}?apikey={settings.NEXTSTREAM_API_KEY}"