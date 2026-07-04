from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from apps.base.account_utils import (
    clear_user_otp,
    email_validator,
    get_tokens_for_user,
    send_otp_email,
    set_user_otp,
    verfiy_user_otp,
)
from apps.base.choices import StatusChoices, UserTypeChoices

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "user_type",
            "status",
            "is_active",
            "otp_verified",
            "created",
            "updated",
        )
        read_only_fields = (
            "id",
            "email",
            "user_type",
            "status",
            "is_active",
            "otp_verified",
            "created",
            "updated",
        )


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})
    user_type = serializers.ChoiceField(
        choices=UserTypeChoices.choices,
        default=UserTypeChoices.USER,
        required=False,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
            "user_type",
        )

    def validate_email(self, value):
        email = value.lower().strip()
        if not email_validator(email):
            raise serializers.ValidationError("Enter a valid email address.")
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            status=StatusChoices.PENDING,
            is_active=False,
            otp_verified=False,
            **validated_data,
        )
        otp = set_user_otp(user)
        try:
            send_otp_email(user.id, otp, "account verification")
        except RuntimeError as exc:
            raise serializers.ValidationError(
                {"email": "Account could not be created because the verification email was not sent."}
            ) from exc
        return user


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6, trim_whitespace=True)

    def validate(self, attrs):
        email = attrs["email"].lower().strip()
        try:
            user = User.objects.exclude(status=StatusChoices.DELETED).get(email__iexact=email)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError({"email": "No account was found for this email."}) from exc

        if not verfiy_user_otp(user, attrs["otp"]):
            raise serializers.ValidationError({"otp": "Invalid or expired OTP."})

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.is_active = True
        user.status = StatusChoices.ACTIVE
        user.save(update_fields=["is_active", "status"])
        clear_user_otp(user)
        return user


class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    purpose = serializers.CharField(default="account verification", required=False)

    def validate_email(self, value):
        email = value.lower().strip()
        try:
            self.user = User.objects.exclude(status=StatusChoices.DELETED).get(email__iexact=email)
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("No account was found for this email.") from exc
        return email

    def save(self, **kwargs):
        otp = set_user_otp(self.user)
        try:
            send_otp_email(self.user.id, otp, self.validated_data["purpose"])
        except RuntimeError as exc:
            raise serializers.ValidationError(
                {"email": "A new OTP could not be sent right now."}
            ) from exc
        return self.user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        email = attrs["email"].lower().strip()
        password = attrs["password"]
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if user is None:
            inactive_user = User.objects.filter(email__iexact=email, is_active=False).first()
            if inactive_user and inactive_user.check_password(password):
                raise serializers.ValidationError("Please verify your email before signing in.")
            raise serializers.ValidationError("Invalid email or password.")

        if user.status in {StatusChoices.BLOCKED, StatusChoices.SUSPENDED, StatusChoices.DELETED}:
            raise serializers.ValidationError("This account cannot sign in right now.")

        attrs["user"] = user
        attrs["tokens"] = get_tokens_for_user(user)
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()

    def save(self, **kwargs):
        user = User.objects.filter(
            email__iexact=self.validated_data["email"],
            is_active=True,
        ).exclude(status=StatusChoices.DELETED).first()

        if user:
            otp = set_user_otp(user)
            try:
                send_otp_email(user.id, otp, "password reset")
            except RuntimeError:
                pass
        return None


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6, trim_whitespace=True)
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        attrs["email"] = attrs["email"].lower().strip()
        if attrs["new_password"] != attrs.pop("new_password_confirm"):
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        validate_password(attrs["new_password"])

        try:
            user = User.objects.exclude(status=StatusChoices.DELETED).get(
                email__iexact=attrs["email"],
                is_active=True,
            )
        except User.DoesNotExist as exc:
            raise serializers.ValidationError({"email": "No active account was found for this email."}) from exc

        if not verfiy_user_otp(user, attrs["otp"]):
            raise serializers.ValidationError({"otp": "Invalid or expired OTP."})

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        clear_user_otp(user)
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs.pop("new_password_confirm"):
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        validate_password(attrs["new_password"], self.context["request"].user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
