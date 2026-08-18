import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("colab", "0003_remove_filenode_content_remove_filenode_node_type_and_more")]

    operations = [
        migrations.CreateModel(
            name="PairSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("code", models.TextField(blank=True, default="")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
