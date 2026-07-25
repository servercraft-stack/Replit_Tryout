# Real-Time Collaboration Roadmap

This is the build guide for turning `Streams_A_Lot` into a Trello/Notion-style collaboration backend using Django, DRF, Django Channels, Redis, and WebSockets.

The goal is not just "add WebSockets." The goal is to understand async Django deeply enough to build a reliable collaborative workspace where multiple users can edit, move, create, delete, and see each other live.

## Product Shape

We will build a workspace-based collaboration system with:

- Workspaces that contain boards or documents.
- Members with roles and permissions.
- Cards/pages/blocks that can be created, reordered, edited, and deleted.
- Live presence: online users, cursor position, current selection, and editing status.
- Live updates over WebSockets.
- Durable state through DRF APIs.
- Conflict handling using last-write-wins first, then operational-transform-style patches for richer text later.
- Redis as the Channels layer and ephemeral presence store.

## Working Principles

- DRF owns durable CRUD and initial page loads.
- WebSockets own live events, presence, typing/editing state, and low-latency updates.
- Database writes must remain explicit and testable.
- WebSocket events must be versioned and small.
- Every realtime event should be safe to replay or ignore.
- Start with last-write-wins, then evolve toward structured patches.
- Do not trust the socket. Every socket connection and event must be authenticated and authorized.

## Current Repo Baseline

Already present:

- Django 6 project in `core`.
- DRF installed and configured.
- JWT authentication via SimpleJWT.
- Redis Python client and `django-redis` installed.
- Existing apps: `apps.user`, `apps.movies`, `apps.base`.
- ASGI entrypoint exists at `core/asgi.py`.

Needed early:

- Add `channels`.
- Add `channels-redis`.
- Replace plain ASGI app with Channels routing.
- Add a collaboration app, likely `apps.collaboration`.
- Add tests for both REST and WebSocket behavior.

## Target Architecture

```text
Client
  |
  | REST: initial load, durable CRUD, history, auth
  v
DRF API
  |
  | DB writes
  v
Database

Client
  |
  | WebSocket: presence, cursors, live mutations, acknowledgements
  v
Django Channels Consumer
  |
  | group_send / receive
  v
Redis Channel Layer
  |
  | fan-out to connected users
  v
Other Clients
```

## App Structure

Proposed app:

```text
apps/collaboration/
  admin.py
  apps.py
  consumers.py
  models.py
  permissions.py
  routing.py
  serializers.py
  services.py
  urls.py
  tests/
    test_api.py
    test_consumers.py
    test_conflicts.py
```

Keep persistence rules in `services.py`, not inside consumers. Consumers should authenticate, validate events, call services, and broadcast results.

## Data Model Plan

Start with these models:

- `Workspace`
  - `name`
  - `owner`
  - timestamps

- `WorkspaceMember`
  - `workspace`
  - `user`
  - `role`: owner, admin, editor, viewer
  - timestamps

- `Board`
  - `workspace`
  - `title`
  - timestamps

- `Column`
  - `board`
  - `title`
  - `position`
  - timestamps

- `Card`
  - `column`
  - `title`
  - `body`
  - `position`
  - `version`
  - `updated_by`
  - timestamps

- `CollaborationEvent`
  - `workspace`
  - `board`
  - `actor`
  - `event_type`
  - `payload`
  - `entity_type`
  - `entity_id`
  - `entity_version`
  - timestamps

`CollaborationEvent` gives us an audit trail, makes debugging easier, and prepares us for replay/history.

## REST API Plan

Initial endpoints:

```text
GET    /api/workspaces/
POST   /api/workspaces/
GET    /api/workspaces/{id}/
GET    /api/workspaces/{id}/members/
POST   /api/workspaces/{id}/members/

GET    /api/boards/
POST   /api/boards/
GET    /api/boards/{id}/

POST   /api/cards/
PATCH  /api/cards/{id}/
DELETE /api/cards/{id}/

GET    /api/boards/{id}/events/
```

REST returns the durable current state. WebSockets notify connected clients that the state changed.

## WebSocket Routes

Initial route:

```text
ws/collaboration/boards/<board_id>/
```

A client connects to one board room at a time. Later we can add workspace-wide rooms.

## WebSocket Event Contract

All client messages should follow this shape:

```json
{
  "type": "card.update",
  "request_id": "client-generated-id",
  "payload": {}
}
```

All server messages should follow this shape:

```json
{
  "type": "card.updated",
  "request_id": "matching-id-when-applicable",
  "actor_id": 123,
  "payload": {},
  "server_version": 8,
  "created_at": "2026-07-08T12:00:00Z"
}
```

Core event types:

- `presence.join`
- `presence.leave`
- `cursor.move`
- `selection.change`
- `card.create`
- `card.created`
- `card.update`
- `card.updated`
- `card.move`
- `card.moved`
- `card.delete`
- `card.deleted`
- `error`
- `ack`

## Conflict Resolution Plan

### Phase 1: Last-Write-Wins

Each mutable entity starts with a `version` integer.

Client update payload:

```json
{
  "card_id": 55,
  "base_version": 7,
  "changes": {
    "title": "New title"
  }
}
```

Server behavior:

- If `base_version` matches the database version, apply the change.
- If `base_version` is stale, still allow simple last-write-wins for non-destructive fields.
- Increment `version`.
- Broadcast the updated entity with the new version.
- Return an acknowledgement to the sender.

Conflict response for risky updates:

```json
{
  "type": "error",
  "request_id": "client-generated-id",
  "code": "version_conflict",
  "payload": {
    "server_version": 9,
    "server_entity": {}
  }
}
```

### Phase 2: Field-Level Merge

Safe automatic merge when users edit different fields:

- User A edits `title`.
- User B edits `body`.
- Server merges both if their changed fields do not overlap.

### Phase 3: Patch-Based Text Collaboration

For document/block editing, move from full-field replacement to patches:

- Store document/block version.
- Send operations instead of full body.
- Validate operations against base version.
- Transform or reject operations when needed.

Example operation:

```json
{
  "block_id": 10,
  "base_version": 12,
  "ops": [
    {"op": "retain", "count": 5},
    {"op": "insert", "text": "hello"},
    {"op": "delete", "count": 2}
  ]
}
```

We will not start here. We earn this layer after the WebSocket fundamentals are solid.

## Presence Plan

Presence is ephemeral and should live in Redis, not the database.

Track:

- User ID.
- Board ID.
- Connection channel name.
- Display name.
- Cursor position.
- Selected entity.
- Last seen timestamp.

Presence events are broadcast to the board group but do not create database rows.

## Authentication Plan

Use JWT auth for WebSockets.

Likely first implementation:

```text
ws/collaboration/boards/<board_id>/?token=<access-token>
```

Then improve toward a custom Channels auth middleware that extracts and validates JWTs cleanly.

Connection checks:

- Token is valid.
- User exists and is active.
- User belongs to the board workspace.
- User has at least viewer access.

Mutation checks:

- Viewer can connect and receive events.
- Editor can create/update/move cards.
- Admin can manage members and board settings.
- Owner can delete workspace-level resources.

## Build Phases

### Phase 0: Environment and Dependencies

- Add `channels` and `channels-redis`.
- Configure `ASGI_APPLICATION`.
- Configure `CHANNEL_LAYERS` with `REDIS_URL`.
- Confirm Redis runs locally.
- Keep existing DRF behavior working.

Done when:

- `python manage.py check` passes.
- ASGI app boots with HTTP support.
- A basic Channels test can instantiate the application.

### Phase 1: Collaboration App and Models

- Create `apps.collaboration`.
- Add models for workspace, membership, board, column, card, and event.
- Add migrations.
- Register admin models.
- Add basic model tests.

Done when:

- Migrations apply.
- Users can own workspaces.
- Boards and cards can be created in tests.

### Phase 2: DRF API

- Add serializers.
- Add viewsets.
- Add permission classes.
- Add routes under `/api/collaboration/`.
- Add filtering by workspace/board membership.

Done when:

- Authenticated users can only access their own collaboration resources.
- CRUD tests pass.
- API schema includes the new endpoints.

### Phase 3: WebSocket Foundation

- Add `consumers.py`.
- Add `routing.py`.
- Update `core/asgi.py` to include WebSocket routing.
- Implement connect/disconnect.
- Join board groups.
- Broadcast `presence.join` and `presence.leave`.
- Add WebSocket tests with Channels communicators.

Done when:

- Authorized users can connect.
- Unauthorized users are rejected.
- Two connected clients see join/leave events.

### Phase 4: Live Card Updates

- Implement `card.create`, `card.update`, `card.move`, and `card.delete`.
- Persist changes through service functions.
- Broadcast normalized server events.
- Send `ack` to the sender.
- Record `CollaborationEvent` rows.

Done when:

- Two clients connected to the same board receive updates.
- Sender gets acknowledgements.
- Database state matches broadcast state.
- Events are stored for debugging/history.

### Phase 5: Conflict Handling

- Add `version` checks.
- Implement last-write-wins rules.
- Reject risky stale writes with `version_conflict`.
- Add tests for simultaneous updates.

Done when:

- Stale updates behave predictably.
- Client can recover using server-returned entity state.
- Conflict tests document the rules.

### Phase 6: Cursor and Selection Presence

- Add `cursor.move`.
- Add `selection.change`.
- Throttle or debounce noisy presence events on the client later.
- Keep presence payloads small.

Done when:

- Cursor/selection messages broadcast to other users.
- Presence data does not persist in the database.

### Phase 7: Production Hardening

- Add rate limits for noisy socket messages.
- Add max payload size validation.
- Add structured error codes.
- Add logging around connect, disconnect, auth failure, and event failure.
- Add Redis connection settings for production.
- Document deployment with ASGI server.

Done when:

- Bad events fail gracefully.
- WebSocket auth failures are clear.
- The service can run behind an ASGI server like Daphne or Uvicorn.

### Phase 8: Frontend Client

Build or attach a frontend once the backend contract is stable.

Client responsibilities:

- Load initial board state through REST.
- Open board WebSocket.
- Apply server events to local state.
- Keep optimistic updates tied to `request_id`.
- Roll back or refresh on conflict.
- Render online collaborators, cursors, selections, and editing states.

## Testing Strategy

Minimum test layers:

- Model tests for ownership and versions.
- DRF API tests for permissions and CRUD.
- Consumer tests for connect, disconnect, and broadcasts.
- Conflict tests for stale versions.
- Service tests for mutation logic.

High-value scenarios:

- User cannot connect to a board outside their workspace.
- Viewer can connect but cannot mutate cards.
- Editor updates a card and all clients receive `card.updated`.
- Stale update increments or rejects according to the conflict policy.
- Disconnect removes presence.
- Invalid payload returns an `error` event without crashing the consumer.

## Local Development Commands

Likely commands after dependencies are installed:

```bash
poetry add channels channels-redis
python manage.py makemigrations collaboration
python manage.py migrate
python manage.py test apps.collaboration
python manage.py runserver
```

Redis should be available at:

```text
redis://127.0.0.1:6379/1
```

Use `REDIS_URL` to override it.

## Definition of Done for MVP

The MVP is done when:

- A user can create a workspace, board, columns, and cards through REST.
- Two authenticated users in the same workspace can connect to the same board socket.
- Card create/update/move/delete events are persisted and broadcast live.
- Presence join/leave and cursor events work.
- Unauthorized users cannot read or write collaboration state.
- Last-write-wins versioning is implemented and tested.
- The WebSocket event contract is documented and stable enough for a frontend.

## First Implementation Slice

Start here:

1. Add Channels dependencies and settings.
2. Create `apps.collaboration`.
3. Add workspace, board, column, card, and membership models.
4. Add DRF serializers and read/write endpoints.
5. Add a minimal board WebSocket consumer with authenticated connect/disconnect.
6. Add tests proving two users can join the same board room.

This slice gives us the foundation. After that, live mutations become much easier to add one event at a time.
