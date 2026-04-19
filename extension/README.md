# CollabCode

CollabCode is a hosted VS Code collaboration extension for invite-only rooms, shared scratch documents, room chat, and teacher mode.

## Install and Use

1. Install the extension in VS Code.
2. Run `CollabCode: Create Room` to host a session.
3. Share the copied student invite token with collaborators.
4. Collaborators run `CollabCode: Join Room` and paste that token.

The extension points to the hosted backend by default. Advanced users can override `collabCode.serverUrl` for self-hosted deployments.

## What Users Get

- Invite-only room access with teacher and student tokens
- Shared scratch document powered by Yjs
- Room chat and live cursor sharing
- Teacher mode for read-only classroom sessions
- Reconnect support and retained student invite token copying

## Commands

- `CollabCode: Create Room`
- `CollabCode: Join Room`
- `CollabCode: Leave Room`
- `CollabCode: Set Teacher Mode`
- `CollabCode: Set Collaboration Mode`
- `CollabCode: Copy Room ID`
- `CollabCode: Copy Student Invite Token`
- `CollabCode: Send Chat Message`
- `CollabCode: Open Getting Started`

## Settings

- `collabCode.serverUrl`: hosted backend URL override
- `collabCode.userName`: saved display name
- `collabCode.lastRoomId`: last room ID suggestion
- `collabCode.shareCursor`: toggle cursor sharing

## Operational Notes

- Rooms, chat history, and shared document state are retained for seven days of inactivity.
- Invite tokens also expire after the configured retention window.
- The collaborative editor opens in a dedicated scratch document instead of editing workspace files in place.

## Privacy and Support

- Privacy policy: [PRIVACY.md](PRIVACY.md)
- Support: [SUPPORT.md](SUPPORT.md)
- Repository docs: https://github.com/Devanshu-Dhyanu/CODE_Bridge_extension_vscode
