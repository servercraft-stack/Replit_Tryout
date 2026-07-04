from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.user.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "first_name",
        "last_name",
        "user_type",
        "status",
        "is_active",
        "is_staff",
        "created",
    )
    list_filter = ("user_type", "status", "is_active", "is_staff", "otp_verified")
    search_fields = ("email", "first_name", "last_name")
    readonly_fields = ("id", "created", "updated", "last_login", "otp_created_at")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "user_type")}),
        ("Account state", {"fields": ("status", "is_active", "otp_verified")}),
        ("OTP", {"fields": ("otp", "otp_created_at")}),
        ("Permissions", {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "created", "updated")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "password1",
                    "password2",
                    "user_type",
                    "status",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )
