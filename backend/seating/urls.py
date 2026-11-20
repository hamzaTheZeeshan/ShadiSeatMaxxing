from django.urls import path

from .views import SolveSeatingView

urlpatterns = [
    path("solve-seating/", SolveSeatingView.as_view(), name="solve-seating"),
]