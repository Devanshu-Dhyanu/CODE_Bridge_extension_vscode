# Privacy

CollabCode does not include analytics or product telemetry in this release.

## Data processed by the hosted service

- Room IDs
- Display names
- Invite-token derived room access role
- Shared scratch document contents
- Room chat messages
- Ephemeral cursor and selection positions while users are connected

## Data retention

- Room metadata, chat history, and shared document state are retained for up to seven days of inactivity.
- Presence and cursor state are not persisted after a disconnect.

## Self-hosting

If you set `collabCode.serverUrl` to your own backend, that server becomes responsible for data handling and retention.
