import * as path from "path";
import { SERVER_VERSION } from "./protocol";
import { createCollabServer } from "./serverApp";

const server = createCollabServer({
  adminSecret: process.env.COLLABCODE_ADMIN_SECRET?.trim() ?? "",
  chatMessageLimit: Math.max(
    1,
    Number(process.env.COLLABCODE_CHAT_MESSAGE_LIMIT ?? 8),
  ),
  chatMessageWindowMs: Math.max(
    250,
    Number(process.env.COLLABCODE_CHAT_MESSAGE_WINDOW_MS ?? 10_000),
  ),
  cleanupIntervalMs: Math.max(
    60_000,
    Number(process.env.COLLABCODE_CLEANUP_INTERVAL_MS ?? 300_000),
  ),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  createRoomLimit: Math.max(
    1,
    Number(process.env.COLLABCODE_CREATE_ROOM_LIMIT ?? 12),
  ),
  createRoomWindowMs: Math.max(
    1_000,
    Number(process.env.COLLABCODE_CREATE_ROOM_WINDOW_MS ?? 10 * 60 * 1000),
  ),
  cursorUpdateLimit: Math.max(
    1,
    Number(process.env.COLLABCODE_CURSOR_UPDATE_LIMIT ?? 120),
  ),
  cursorUpdateWindowMs: Math.max(
    250,
    Number(process.env.COLLABCODE_CURSOR_UPDATE_WINDOW_MS ?? 10_000),
  ),
  dbPath:
    process.env.COLLABCODE_DB_PATH?.trim() ||
    path.join(process.cwd(), "data", "collabcode.sqlite"),
  inviteSecret: resolveInviteSecret(),
  inviteTokenTtlHours: Math.max(
    1,
    Number(process.env.COLLABCODE_INVITE_TTL_HOURS ?? 168),
  ),
  joinRoomLimit: Math.max(
    1,
    Number(process.env.COLLABCODE_JOIN_ROOM_LIMIT ?? 40),
  ),
  joinRoomWindowMs: Math.max(
    1_000,
    Number(process.env.COLLABCODE_JOIN_ROOM_WINDOW_MS ?? 10 * 60 * 1000),
  ),
  maxUsersPerRoom: Math.max(
    2,
    Number(process.env.COLLABCODE_MAX_USERS_PER_ROOM ?? 20),
  ),
  port: Number(process.env.PORT ?? 3001),
  roomTtlHours: Math.max(
    1,
    Number(process.env.COLLABCODE_ROOM_TTL_HOURS ?? 168),
  ),
});

void server.listen();

const shutdown = async () => {
  await server.close();
};

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});

function resolveInviteSecret(): string {
  const configuredSecret = process.env.COLLABCODE_INVITE_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `COLLABCODE_INVITE_SECRET is required when NODE_ENV is production for CollabCode ${SERVER_VERSION}.`,
    );
  }

  console.warn(
    "[Auth] Using the local development invite secret. Set COLLABCODE_INVITE_SECRET before production deploys.",
  );

  return "collabcode-local-dev-secret-change-me";
}
