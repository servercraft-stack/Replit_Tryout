from django.http import Http404
from django.shortcuts import redirect, render
from django.views.decorators.http import require_GET

from .models import PairSession


@require_GET
def create_session(request):
    session = PairSession.objects.create()
    return redirect("pair:session", token=session.token)


@require_GET
def session_page(request, token):
    if not PairSession.objects.filter(token=token).exists():
        raise Http404
    return render(request, "pair/session.html", {"token": str(token)})
