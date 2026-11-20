from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import SolveRequestSerializer
from .solver import solve_seating


class SolveSeatingView(APIView):
    # Stateless JSON API for the SPA: no session auth, so no CSRF requirement.
    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        serializer = SolveRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        result = solve_seating(
            layout=data["layout"],
            guests=data["guests"],
            constraints=data["constraints"],
            options=data["options"],
        )
        return Response(result, status=status.HTTP_200_OK)