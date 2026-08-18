"""Reconcile FileNode metadata with the pre-existing Neon schema.

The Neon table was partially migrated before this migration was committed:
``content``, UUID ``id``/``parent_id``, and ``storage_key`` already exist in
production.  PostgreSQL's IF EXISTS/IF NOT EXISTS clauses make this migration
safe for both that database and a clean database at the 0002 state.
"""

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("colab", "0002_terminalsession_shell_type_invitation")]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE colab_filenode ADD COLUMN IF NOT EXISTS is_directory boolean NOT NULL DEFAULT false",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "UPDATE colab_filenode SET is_directory = (node_type = 'dir') WHERE node_type IS NOT NULL",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="filenode",
                    name="is_directory",
                    field=models.BooleanField(default=False),
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE colab_filenode DROP COLUMN IF EXISTS content",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[migrations.RemoveField(model_name="filenode", name="content")],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE colab_filenode DROP COLUMN IF EXISTS node_type",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[migrations.RemoveField(model_name="filenode", name="node_type")],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE colab_filenode ADD COLUMN IF NOT EXISTS storage_key varchar(1024) NOT NULL DEFAULT ''",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="filenode",
                    name="storage_key",
                    field=models.CharField(blank=True, default="", max_length=1024),
                ),
            ],
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name="filenode",
                    name="id",
                    field=models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False),
                ),
            ],
        ),
    ]
