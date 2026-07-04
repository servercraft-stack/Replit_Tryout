from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from django.contrib.auth import get_user_model
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.user.serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)

User = get_user_model()


@extend_schema_view(
    post=extend_schema(
        tags=["Authentication"],
        summary="Register a new user",
        description=(
            "Creates a pending user account and sends a one-time password to the supplied email address. "
            "The frontend should redirect the user to an OTP verification screen after a successful response. "
            "The account cannot log in until `POST /api/auth/verify-otp/` activates it."
        ),
        request=RegisterSerializer,
        responses={
            201: OpenApiResponse(
                response=UserSerializer,
                description="Registration succeeded. The response includes a message and the pending user object.",
            ),
            400: OpenApiResponse(description="Validation failed, email already exists, or the OTP email could not be sent."),
            429: OpenApiResponse(description="Too many registration attempts from this IP address."),
        },
        examples=[
            OpenApiExample(
                "Register request",
                value={
                    "email": "smth@gmail.com",
                    "first_name": "Ada",
                    "last_name": "Nwachukwu",
                    "password": "STrongPass##",
                    "password_confirm": "STrongPass##",
                    "user_type": "user",
                },
                request_only=True,
            )
        ],
    )
)
@method_decorator(ratelimit(key="ip", rate="5/h", method="POST", block=True), name="dispatch")
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)
    throttle_scope = "register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": "Registration successful. Check your email for the verification OTP.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True), name="dispatch")
class VerifyOTPView(APIView):
    permission_classes = (AllowAny,)
    throttle_scope = "otp"
    serializer_class = VerifyOTPSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Verify account OTP",
        description=(
            "Checks a 6-digit OTP for the supplied email address. A valid OTP activates the account, "
            "marks the user as verified, clears the stored OTP, and returns the verified user object."
        ),
        request=VerifyOTPSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description="OTP verified and account activated."),
            400: OpenApiResponse(description="Invalid email, invalid OTP, or expired OTP."),
            429: OpenApiResponse(description="Too many OTP attempts."),
        },
        examples=[
            OpenApiExample(
                "Verify OTP request",
                value={"email": "user@example.com", "otp": "123456"},
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": "Account verified successfully.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(ratelimit(key="ip", rate="6/m", method="POST", block=True), name="dispatch")
class ResendOTPView(APIView):
    permission_classes = (AllowAny,)
    throttle_scope = "otp"
    serializer_class = ResendOTPSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Resend OTP",
        description=(
            "Generates a new OTP for an existing non-deleted user and sends it by email. "
            "Use the optional `purpose` field only when the UI needs a custom email purpose label."
        ),
        request=ResendOTPSerializer,
        responses={
            200: OpenApiResponse(description="A new OTP was sent."),
            400: OpenApiResponse(description="Email does not belong to an existing account or email delivery failed."),
            429: OpenApiResponse(description="Too many OTP resend attempts."),
        },
        examples=[
            OpenApiExample(
                "Resend OTP request",
                value={"email": "viewer@example.com", "purpose": "account verification"},
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "A new OTP has been sent."},
            status=status.HTTP_200_OK,
        )


@method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True), name="dispatch")
class LoginView(APIView):
    permission_classes = (AllowAny,)
    throttle_scope = "login"
    serializer_class = LoginSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Log in",
        description=(
            "Authenticates by email and password. The user must be active, verified, and not blocked, "
            "suspended, or deleted. A successful response includes `tokens.refresh`, `tokens.access`, and `user`."
        ),
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description="Login succeeded. Response contains JWT tokens and user profile data."),
            400: OpenApiResponse(description="Invalid credentials, unverified email, or blocked account."),
            429: OpenApiResponse(description="Too many login attempts."),
        },
        examples=[
            OpenApiExample(
                "Login request",
                value={"email": "viewer@example.com", "password": "StrongPassword123!"},
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response(
            {
                "message": "Login successful.",
                "tokens": serializer.validated_data["tokens"],
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = LogoutSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Log out",
        description=(
            "Blacklists the supplied refresh token so it cannot be used again. "
            "The request must also include a valid access token in the Authorization header."
        ),
        request=LogoutSerializer,
        responses={
            205: OpenApiResponse(description="Logout succeeded. Clear frontend auth state."),
            400: OpenApiResponse(description="Refresh token is missing, expired, invalid, or already unusable."),
            401: OpenApiResponse(description="Access token is missing or invalid."),
        },
        examples=[
            OpenApiExample(
                "Logout request",
                value={"refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."},
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh_token = serializer.validated_data["refresh"]

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {"refresh": ["Invalid or expired refresh token."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"message": "Logout successful."},
            status=status.HTTP_205_RESET_CONTENT,
        )


@extend_schema_view(
    get=extend_schema(
        tags=["Users"],
        summary="Get current user profile",
        description="Returns the authenticated user's profile. Use this after app boot to hydrate frontend auth state.",
        responses={200: UserSerializer, 401: OpenApiResponse(description="Access token is missing or invalid.")},
    ),
    put=extend_schema(
        tags=["Users"],
        summary="Replace current user profile",
        description=(
            "Updates the authenticated user's editable profile fields. "
            "Read-only fields such as email, status, role, and activation flags are ignored by the serializer."
        ),
        request=UserSerializer,
        responses={200: UserSerializer, 400: OpenApiResponse(description="Validation failed.")},
    ),
    patch=extend_schema(
        tags=["Users"],
        summary="Partially update current user profile",
        description="Partially updates editable fields on the authenticated user's own profile.",
        request=UserSerializer,
        responses={200: UserSerializer, 400: OpenApiResponse(description="Validation failed.")},
    ),
)
class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return self.request.user


@extend_schema_view(
    get=extend_schema(
        tags=["Users"],
        summary="Get user by ID",
        description=(
            "Returns a non-deleted user by UUID. The caller must be authenticated. "
            "Use this for user profile detail pages or admin/staff user management screens."
        ),
        responses={
            200: UserSerializer,
            401: OpenApiResponse(description="Access token is missing or invalid."),
            404: OpenApiResponse(description="User was not found or has deleted status."),
        },
    ),
    put=extend_schema(
        tags=["Users"],
        summary="Replace user by ID",
        description=(
            "Replaces editable profile fields for the user identified by UUID. "
            "Only the target user or a staff user can update this resource."
        ),
        request=UserSerializer,
        responses={
            200: UserSerializer,
            400: OpenApiResponse(description="Validation failed."),
            403: OpenApiResponse(description="Caller is not the target user and is not staff."),
            404: OpenApiResponse(description="User was not found or has deleted status."),
        },
    ),
    patch=extend_schema(
        tags=["Users"],
        summary="Partially update user by ID",
        description=(
            "Partially updates editable profile fields for the user identified by UUID. "
            "Only the target user or a staff user can update this resource."
        ),
        request=UserSerializer,
        responses={
            200: UserSerializer,
            400: OpenApiResponse(description="Validation failed."),
            403: OpenApiResponse(description="Caller is not the target user and is not staff."),
            404: OpenApiResponse(description="User was not found or has deleted status."),
        },
    ),
)
class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.exclude(status="deleted")
    serializer_class = UserSerializer
    permission_classes = (IsAuthenticated,)
    lookup_field = "id"
    lookup_url_kwarg = "user_id"

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method in ("PUT", "PATCH") and obj != request.user and not request.user.is_staff:
            self.permission_denied(
                request,
                message="You do not have permission to update this user.",
            )


@method_decorator(ratelimit(key="ip", rate="5/h", method="POST", block=True), name="dispatch")
class PasswordResetRequestView(APIView):
    permission_classes = (AllowAny,)
    throttle_scope = "password_reset"
    serializer_class = PasswordResetRequestSerializer

    @extend_schema(
        tags=["Password"],
        summary="Request password reset OTP",
        description=(
            "Sends a password reset OTP when the email belongs to an active non-deleted user. "
            "The response is intentionally neutral whether or not the email exists."
        ),
        request=PasswordResetRequestSerializer,
        responses={
            200: OpenApiResponse(description="Neutral success response. Frontend should show the next step."),
            400: OpenApiResponse(description="Email field validation failed."),
            429: OpenApiResponse(description="Too many password reset attempts."),
        },
        examples=[
            OpenApiExample(
                "Password reset request",
                value={"email": "viewer@example.com"},
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "If that email exists, a password reset OTP has been sent."},
            status=status.HTTP_200_OK,
        )


@method_decorator(ratelimit(key="ip", rate="10/m", method="POST", block=True), name="dispatch")
class PasswordResetConfirmView(APIView):
    permission_classes = (AllowAny,)
    throttle_scope = "password_reset"
    serializer_class = PasswordResetConfirmSerializer

    @extend_schema(
        tags=["Password"],
        summary="Confirm password reset",
        description=(
            "Verifies the password reset OTP, validates the new password against Django password rules, "
            "updates the password, and clears the OTP."
        ),
        request=PasswordResetConfirmSerializer,
        responses={
            200: OpenApiResponse(description="Password reset succeeded. Frontend should route to login."),
            400: OpenApiResponse(description="Invalid email, invalid/expired OTP, or password validation error."),
            429: OpenApiResponse(description="Too many password reset confirmation attempts."),
        },
        examples=[
            OpenApiExample(
                "Password reset confirm request",
                value={
                    "email": "viewer@example.com",
                    "otp": "123456",
                    "new_password": "NewStrongPassword123!",
                    "new_password_confirm": "NewStrongPassword123!",
                },
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Password reset successful."},
            status=status.HTTP_200_OK,
        )


@method_decorator(ratelimit(key="user_or_ip", rate="5/h", method="POST", block=True), name="dispatch")
class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)
    throttle_scope = "password_change"
    serializer_class = ChangePasswordSerializer

    @extend_schema(
        tags=["Password"],
        summary="Change current password",
        description=(
            "Changes the authenticated user's password after checking the current password and validating "
            "the new password against Django password rules."
        ),
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password changed successfully."),
            400: OpenApiResponse(description="Current password is wrong or new password validation failed."),
            401: OpenApiResponse(description="Access token is missing or invalid."),
            429: OpenApiResponse(description="Too many password change attempts."),
        },
        examples=[
            OpenApiExample(
                "Change password request",
                value={
                    "current_password": "OldStrongPassword123!",
                    "new_password": "NewStrongPassword123!",
                    "new_password_confirm": "NewStrongPassword123!",
                },
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )
