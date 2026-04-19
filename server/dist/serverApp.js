"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCollabServer = createCollabServer;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const binary_1 = require("./binary");
const inviteTokens_1 = require("./inviteTokens");
const persistentRoomStore_1 = require("./persistentRoomStore");
const protocol_1 = require("./protocol");
const rateLimiter_1 = require("./rateLimiter");
const roomManager_1 = require("./roomManager");
const MAX_ROOM_ID_LENGTH = 64;
const MAX_USER_NAME_LENGTH = 48;
const MAX_DOCUMENT_NAME_LENGTH = 120;
const MAX_LANGUAGE_ID_LENGTH = 50;
const MAX_CHAT_MESSAGE_LENGTH = 2000;
const MAX_INVITE_TOKEN_LENGTH = 4096;
const MAX_CLIENT_VERSION_LENGTH = 32;
function createCollabServer(options) {
    const app = (0, express_1.default)();
    app.set("trust proxy", true);
    app.use((0, cors_1.default)({
        origin: options.corsOrigin,
    }));
    app.use(express_1.default.json());
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: options.corsOrigin,
            methods: ["GET", "POST"],
        },
        parser: require("socket.io-msgpack-parser"),
    });
    const store = new persistentRoomStore_1.PersistentRoomStore(options.dbPath);
    const roomManager = new roomManager_1.RoomManager({
        store,
        maxUsersPerRoom: options.maxUsersPerRoom,
        roomTtlMs: options.roomTtlHours * 60 * 60 * 1000,
    });
    const rateLimiter = new rateLimiter_1.RateLimiter();
    const cleanedRoomCount = roomManager.deleteExpiredRooms();
    const rehydratedRoomCount = roomManager.rehydrateRooms();
    if (cleanedRoomCount > 0) {
        console.log(`[Room] Deleted ${cleanedRoomCount} expired rooms during startup cleanup.`);
    }
    if (rehydratedRoomCount > 0) {
        console.log(`[Room] Rehydrated ${rehydratedRoomCount} room(s) from ${options.dbPath}.`);
    }
    const cleanupInterval = setInterval(() => {
        const deletedRoomCount = roomManager.deleteExpiredRooms();
        if (deletedRoomCount > 0) {
            console.log(`[Room] Deleted ${deletedRoomCount} expired room(s).`);
        }
    }, options.cleanupIntervalMs);
    cleanupInterval.unref();
    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            protocolVersion: protocol_1.PROTOCOL_VERSION,
            serverVersion: protocol_1.SERVER_VERSION,
            timestamp: Date.now(),
        });
    });
    app.get("/rooms", (req, res) => {
        if (!options.adminSecret || req.get("x-collabcode-admin-secret") !== options.adminSecret) {
            res.status(404).json({ status: "not_found" });
            return;
        }
        res.json({ rooms: roomManager.listRooms() });
    });
    io.on("connection", (socket) => {
        socket.on("create-room", (rawPayload, acknowledge) => {
            const payload = sanitizeCreateRoomPayload(rawPayload);
            if (!payload) {
                acknowledgeCreateRoom(acknowledge, createErrorResponse("invalid-payload", "Invalid room creation payload."));
                return;
            }
            const versionError = validateClientVersion(payload.clientVersion);
            if (versionError) {
                acknowledgeCreateRoom(acknowledge, createErrorResponse(versionError.code, versionError.message));
                return;
            }
            const rateLimit = rateLimiter.consume({
                key: `create-room:${getClientAddress(socket)}`,
                limit: options.createRoomLimit,
                windowMs: options.createRoomWindowMs,
            });
            if (!rateLimit.allowed) {
                acknowledgeCreateRoom(acknowledge, createErrorResponse("rate-limited", "Too many room creation requests. Please wait a little and try again.", rateLimit.retryAfterMs));
                return;
            }
            if (roomManager.getUser(socket.id)) {
                acknowledgeCreateRoom(acknowledge, createErrorResponse("invalid-payload", "This client is already joined to a room."));
                return;
            }
            const room = roomManager.createRoom(payload);
            if (!room) {
                acknowledgeCreateRoom(acknowledge, createErrorResponse("room-unavailable", "That room ID is already in use."));
                return;
            }
            const joinResult = roomManager.addUser(socket.id, room.id, payload.userName, "teacher");
            if (!joinResult.ok) {
                roomManager.deleteRoom(room.id);
                acknowledgeCreateRoom(acknowledge, createErrorResponse("room-unavailable", "Unable to add the teacher to the room."));
                return;
            }
            socket.join(room.id);
            const roomState = roomManager.getRoomState(room.id, socket.id);
            if (!roomState) {
                roomManager.deleteRoom(room.id);
                acknowledgeCreateRoom(acknowledge, createErrorResponse("room-unavailable", "Unable to initialize the room state."));
                return;
            }
            const teacherInviteToken = (0, inviteTokens_1.createInviteToken)(room.id, "teacher", options.inviteSecret, options.inviteTokenTtlHours);
            const studentInviteToken = (0, inviteTokens_1.createInviteToken)(room.id, "student", options.inviteSecret, options.inviteTokenTtlHours);
            acknowledgeCreateRoom(acknowledge, {
                ok: true,
                roomState: enrichRoomState(roomState),
                teacherInviteToken,
                studentInviteToken,
                protocolVersion: protocol_1.PROTOCOL_VERSION,
                serverVersion: protocol_1.SERVER_VERSION,
            });
            console.log(`[Room] Created ${room.id} for ${payload.documentName}`);
            console.log(`[Room] ${joinResult.user.name} joined ${room.id} as ${joinResult.user.role} (${joinResult.room.users.size} active user(s))`);
        });
        socket.on("join-room", (rawPayload) => {
            const payload = sanitizeJoinPayload(rawPayload);
            if (!payload) {
                emitProtocolError(socket, "invalid-payload", "Invalid room join payload.");
                return;
            }
            const versionError = validateClientVersion(payload.clientVersion);
            if (versionError) {
                emitProtocolError(socket, versionError.code, versionError.message);
                return;
            }
            const rateLimit = rateLimiter.consume({
                key: `join-room:${getClientAddress(socket)}`,
                limit: options.joinRoomLimit,
                windowMs: options.joinRoomWindowMs,
            });
            if (!rateLimit.allowed) {
                emitProtocolError(socket, "rate-limited", "Too many join requests. Please wait a little and try again.", rateLimit.retryAfterMs);
                return;
            }
            if (roomManager.getUser(socket.id)) {
                emitProtocolError(socket, "invalid-payload", "This client is already joined to a room.");
                return;
            }
            const inviteClaims = (0, inviteTokens_1.verifyInviteToken)(payload.inviteToken, options.inviteSecret);
            if (!inviteClaims) {
                emitProtocolError(socket, "invite-invalid-or-expired", "That invite token is invalid or expired.");
                return;
            }
            const joinResult = roomManager.addUser(socket.id, inviteClaims.roomId, payload.userName, inviteClaims.role);
            if (!joinResult.ok) {
                if (joinResult.reason === "room-not-found") {
                    emitProtocolError(socket, "room-unavailable", "That room is not available right now.");
                    return;
                }
                if (joinResult.reason === "teacher-already-present") {
                    emitProtocolError(socket, "teacher-already-connected", "A teacher is already connected to this room.");
                    return;
                }
                emitProtocolError(socket, "room-full", `That room is full. A maximum of ${options.maxUsersPerRoom} users can join at once.`);
                return;
            }
            const { room, user } = joinResult;
            socket.join(room.id);
            const roomState = roomManager.getRoomState(room.id, socket.id);
            if (!roomState) {
                roomManager.removeUser(socket.id);
                emitProtocolError(socket, "room-unavailable", "Unable to initialize the room state.");
                return;
            }
            socket.emit("room-state", enrichRoomState(roomState));
            socket.to(room.id).emit("user-joined", { user: roomManager.getPublicUser(user) });
            const joinMessage = room.messages[room.messages.length - 1];
            if (joinMessage?.type === "system") {
                socket.to(room.id).emit("chat-message", joinMessage);
            }
            console.log(`[Room] ${user.name} joined ${room.id} as ${user.role} (${room.users.size} active user(s))`);
        });
        socket.on("yjs-update", (rawPayload) => {
            if (!rawPayload || typeof rawPayload.roomId !== "string") {
                emitProtocolError(socket, "invalid-payload", "Invalid document update payload.");
                return;
            }
            let update;
            try {
                update = (0, binary_1.toUint8Array)(rawPayload.update);
            }
            catch {
                emitProtocolError(socket, "invalid-payload", "Invalid document update payload.");
                return;
            }
            if (!roomManager.isRoomMember(socket.id, rawPayload.roomId)) {
                emitProtocolError(socket, "unauthorized", "You are not a member of that room.");
                return;
            }
            if (!roomManager.canEdit(socket.id)) {
                emitProtocolError(socket, "read-only", "You are in read-only mode.");
                return;
            }
            const applied = roomManager.applyYjsUpdate(rawPayload.roomId, update);
            if (!applied) {
                emitProtocolError(socket, "room-unavailable", "Unable to apply the document update.");
                return;
            }
            socket.to(rawPayload.roomId).emit("yjs-update", {
                roomId: rawPayload.roomId,
                update,
            });
        });
        socket.on("cursor-update", (rawPayload) => {
            const payload = sanitizeCursorPayload(rawPayload);
            if (!payload) {
                emitProtocolError(socket, "invalid-payload", "Invalid cursor payload.");
                return;
            }
            if (!roomManager.isRoomMember(socket.id, payload.roomId)) {
                emitProtocolError(socket, "unauthorized", "You are not a member of that room.");
                return;
            }
            const rateLimit = rateLimiter.consume({
                key: `cursor-update:${socket.id}`,
                limit: options.cursorUpdateLimit,
                windowMs: options.cursorUpdateWindowMs,
            });
            if (!rateLimit.allowed) {
                emitProtocolError(socket, "rate-limited", "Cursor updates are arriving too quickly. Please slow down for a moment.", rateLimit.retryAfterMs);
                return;
            }
            const cursorState = roomManager.updateCursor(socket.id, payload);
            if (!cursorState) {
                emitProtocolError(socket, "room-unavailable", "Unable to update the cursor.");
                return;
            }
            socket.to(payload.roomId).emit("cursor-update", cursorState);
        });
        socket.on("chat-message", (rawPayload) => {
            const payload = sanitizeChatPayload(rawPayload);
            if (!payload) {
                emitProtocolError(socket, "invalid-payload", "Invalid chat message payload.");
                return;
            }
            if (!roomManager.isRoomMember(socket.id, payload.roomId)) {
                emitProtocolError(socket, "unauthorized", "You are not a member of that room.");
                return;
            }
            const rateLimit = rateLimiter.consume({
                key: `chat-message:${socket.id}`,
                limit: options.chatMessageLimit,
                windowMs: options.chatMessageWindowMs,
            });
            if (!rateLimit.allowed) {
                emitProtocolError(socket, "rate-limited", "You are sending messages too quickly. Please wait a moment.", rateLimit.retryAfterMs);
                return;
            }
            const message = roomManager.addChatMessage(socket.id, payload.text);
            if (!message) {
                emitProtocolError(socket, "room-unavailable", "Unable to send the chat message.");
                return;
            }
            io.to(payload.roomId).emit("chat-message", message);
        });
        socket.on("mode-change", (rawPayload) => {
            const payload = sanitizeModePayload(rawPayload);
            if (!payload) {
                emitProtocolError(socket, "invalid-payload", "Invalid mode change payload.");
                return;
            }
            if (!roomManager.isRoomMember(socket.id, payload.roomId)) {
                emitProtocolError(socket, "unauthorized", "You are not a member of that room.");
                return;
            }
            const user = roomManager.getUser(socket.id);
            if (!user || user.role !== "teacher") {
                emitProtocolError(socket, "unauthorized", "Only the teacher can change the room mode.");
                return;
            }
            const updated = roomManager.setMode(payload.roomId, payload.mode);
            if (!updated) {
                emitProtocolError(socket, "room-unavailable", "Unable to update the room mode.");
                return;
            }
            io.to(payload.roomId).emit("mode-changed", { mode: payload.mode });
            const systemMessage = roomManager.addSystemMessage(payload.roomId, `${user.name} switched the room to ${payload.mode === "teacher" ? "Teacher" : "Collaboration"} mode.`);
            if (systemMessage) {
                io.to(payload.roomId).emit("chat-message", systemMessage);
            }
        });
        socket.on("disconnect", () => {
            const removedUser = roomManager.removeUser(socket.id);
            if (!removedUser) {
                return;
            }
            socket.to(removedUser.roomId).emit("user-left", { userId: removedUser.user.id });
            socket.to(removedUser.roomId).emit("cursor-remove", { userId: removedUser.user.id });
            const roomState = roomManager.getRoom(removedUser.roomId);
            const latestMessage = roomState?.messages[roomState.messages.length - 1];
            if (latestMessage?.type === "system") {
                socket.to(removedUser.roomId).emit("chat-message", latestMessage);
            }
        });
    });
    let closed = false;
    return {
        app,
        httpServer,
        io,
        roomManager,
        async listen() {
            await new Promise((resolve, reject) => {
                httpServer.once("error", reject);
                httpServer.listen(options.port, () => {
                    httpServer.off("error", reject);
                    console.log(`CollabCode server listening on port ${options.port}`);
                    resolve();
                });
            });
        },
        async close() {
            if (closed) {
                return;
            }
            closed = true;
            clearInterval(cleanupInterval);
            await new Promise((resolve) => {
                io.close(() => {
                    httpServer.close(() => {
                        roomManager.close();
                        resolve();
                    });
                });
            });
        },
    };
}
function emitProtocolError(socket, code, message, retryAfterMs) {
    const payload = {
        code,
        message,
        retryAfterMs,
    };
    socket.emit("error", payload);
}
function acknowledgeCreateRoom(acknowledge, response) {
    acknowledge?.(response);
}
function createErrorResponse(code, message, retryAfterMs) {
    return {
        ok: false,
        code,
        message,
        protocolVersion: protocol_1.PROTOCOL_VERSION,
        serverVersion: protocol_1.SERVER_VERSION,
        retryAfterMs,
    };
}
function enrichRoomState(payload) {
    return {
        ...payload,
        protocolVersion: protocol_1.PROTOCOL_VERSION,
        serverVersion: protocol_1.SERVER_VERSION,
    };
}
function sanitizeCreateRoomPayload(payload) {
    if (!payload) {
        return null;
    }
    const roomId = normalizeText(payload.roomId, MAX_ROOM_ID_LENGTH);
    const userName = normalizeText(payload.userName, MAX_USER_NAME_LENGTH);
    const documentName = normalizeText(payload.documentName, MAX_DOCUMENT_NAME_LENGTH) || "collab-code.ts";
    const languageId = normalizeText(payload.languageId, MAX_LANGUAGE_ID_LENGTH) || "plaintext";
    const clientVersion = normalizeVersion(payload.clientVersion);
    if (!roomId || !userName || !clientVersion) {
        return null;
    }
    return {
        roomId,
        userName,
        documentName,
        languageId,
        initialCode: typeof payload.initialCode === "string" ? payload.initialCode : "",
        clientVersion,
    };
}
function sanitizeJoinPayload(payload) {
    if (!payload) {
        return null;
    }
    const inviteToken = normalizeText(payload.inviteToken, MAX_INVITE_TOKEN_LENGTH);
    const userName = normalizeText(payload.userName, MAX_USER_NAME_LENGTH);
    const clientVersion = normalizeVersion(payload.clientVersion);
    if (!inviteToken || !userName || !clientVersion) {
        return null;
    }
    return {
        inviteToken,
        userName,
        clientVersion,
    };
}
function sanitizeCursorPayload(payload) {
    if (!payload || !payload.cursor) {
        return null;
    }
    const roomId = normalizeText(payload.roomId, MAX_ROOM_ID_LENGTH);
    if (!roomId) {
        return null;
    }
    if (!isValidPosition(payload.cursor)) {
        return null;
    }
    if (payload.selection) {
        if (!isValidPosition(payload.selection.start) || !isValidPosition(payload.selection.end)) {
            return null;
        }
    }
    return {
        roomId,
        cursor: payload.cursor,
        selection: payload.selection,
    };
}
function sanitizeChatPayload(payload) {
    if (!payload) {
        return null;
    }
    const roomId = normalizeText(payload.roomId, MAX_ROOM_ID_LENGTH);
    const text = normalizeText(payload.text, MAX_CHAT_MESSAGE_LENGTH);
    if (!roomId || !text) {
        return null;
    }
    return { roomId, text };
}
function sanitizeModePayload(payload) {
    if (!payload) {
        return null;
    }
    const roomId = normalizeText(payload.roomId, MAX_ROOM_ID_LENGTH);
    if (!roomId) {
        return null;
    }
    const mode = payload.mode === "teacher" ? "teacher" : "collaboration";
    return { roomId, mode };
}
function normalizeText(value, maxLength) {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim().slice(0, maxLength);
}
function normalizeVersion(value) {
    return normalizeText(value, MAX_CLIENT_VERSION_LENGTH);
}
function isValidPosition(position) {
    return (Number.isInteger(position.line) &&
        Number.isInteger(position.character) &&
        position.line >= 0 &&
        position.character >= 0);
}
function validateClientVersion(clientVersion) {
    const clientMajor = Number.parseInt(clientVersion.split(".")[0] ?? "", 10);
    const serverMajor = Number.parseInt(protocol_1.SERVER_VERSION.split(".")[0] ?? "", 10);
    if (!Number.isInteger(clientMajor) || clientMajor !== serverMajor) {
        return {
            code: "protocol-mismatch",
            message: `This CollabCode build is not compatible with the server. Install CollabCode ${protocol_1.SERVER_VERSION} (protocol ${protocol_1.PROTOCOL_VERSION}).`,
        };
    }
    return null;
}
function getClientAddress(socket) {
    const forwardedFor = socket.handshake.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
        return forwardedFor.split(",")[0]?.trim() || socket.handshake.address;
    }
    return socket.handshake.address;
}
//# sourceMappingURL=serverApp.js.map