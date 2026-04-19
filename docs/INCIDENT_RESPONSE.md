# Incident and Debug Playbook

## Backend unavailable

1. Check `/health`
2. Check Render service logs
3. Verify the persistent disk is mounted and `COLLABCODE_DB_PATH` points to it
4. Confirm `COLLABCODE_INVITE_SECRET` is present

## Users cannot join

1. Confirm the invite token has not expired
2. Confirm the room has not exceeded the user cap
3. Check rate-limit logs for repeated retries
4. Ask the host to recreate the room if the room TTL has elapsed

## Protocol mismatch

1. Compare extension version and server version
2. Redeploy the backend
3. Repackage and republish the extension if the protocol version changed
