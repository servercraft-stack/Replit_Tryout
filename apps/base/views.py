from django.http import JsonResponse


def ratelimited(request, exception):
    return JsonResponse(
        {
            "detail": "Too many requests. Please wait a moment and try again.",
        },
        status=429,
    )
