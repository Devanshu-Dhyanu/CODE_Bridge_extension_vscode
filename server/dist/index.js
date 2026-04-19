"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const protocol_1 = require("./protocol");
const serverApp_1 = require("./serverApp");
const server = (0, serverApp_1.createCollabServer)({
    adminSecret: process.env.COLLABCODE_ADMIN_SECRET?.trim() ?? "",
    chatMessageLimit: Math.max(1, Number(process.env.COLLABCODE_CHAT_MESSAGE_LIMIT ?? 8)),
    chatMessageWindowMs: Math.max(250, Number(process.env.COLLABCODE_CHAT_MESSAGE_WINDOW_MS ?? 10000)),
    cleanupIntervalMs: Math.max(60000, Number(process.env.COLLABCODE_CLEANUP_INTERVAL_MS ?? 300000)),
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    createRoomLimit: Math.max(1, Number(process.env.COLLABCODE_CREATE_ROOM_LIMIT ?? 12)),
    createRoomWindowMs: Math.max(1000, Number(process.env.COLLABCODE_CREATE_ROOM_WINDOW_MS ?? 10 * 60 * 1000)),
    cursorUpdateLimit: Math.max(1, Number(process.env.COLLABCODE_CURSOR_UPDATE_LIMIT ?? 120)),
    cursorUpdateWindowMs: Math.max(250, Number(process.env.COLLABCODE_CURSOR_UPDATE_WINDOW_MS ?? 10000)),
    dbPath: process.env.COLLABCODE_DB_PATH?.trim() ||
        path.join(process.cwd(), "data", "collabcode.sqlite"),
    inviteSecret: resolveInviteSecret(),
    inviteTokenTtlHours: Math.max(1, Number(process.env.COLLABCODE_INVITE_TTL_HOURS ?? 168)),
    joinRoomLimit: Math.max(1, Number(process.env.COLLABCODE_JOIN_ROOM_LIMIT ?? 40)),
    joinRoomWindowMs: Math.max(1000, Number(process.env.COLLABCODE_JOIN_ROOM_WINDOW_MS ?? 10 * 60 * 1000)),
    maxUsersPerRoom: Math.max(2, Number(process.env.COLLABCODE_MAX_USERS_PER_ROOM ?? 20)),
    port: Number(process.env.PORT ?? 3001),
    roomTtlHours: Math.max(1, Number(process.env.COLLABCODE_ROOM_TTL_HOURS ?? 168)),
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
function resolveInviteSecret() {
    const configuredSecret = process.env.COLLABCODE_INVITE_SECRET?.trim();
    if (configuredSecret) {
        return configuredSecret;
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error(`COLLABCODE_INVITE_SECRET is required when NODE_ENV is production for CollabCode ${protocol_1.SERVER_VERSION}.`);
    }
    console.warn("[Auth] Using the local development invite secret. Set COLLABCODE_INVITE_SECRET before production deploys.");
    return "collabcode-local-dev-secret-change-me";
}
//# sourceMappingURL=index.js.map