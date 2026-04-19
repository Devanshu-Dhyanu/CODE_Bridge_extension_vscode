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
exports.RoomManager = void 0;
const crypto_1 = require("crypto");
const Y = __importStar(require("yjs"));
const CURSOR_COLORS = [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#ffeaa7",
    "#dda0dd",
    "#98d8c8",
    "#f7dc6f",
    "#bb8fce",
    "#85c1e9",
    "#82e0aa",
    "#f0b27a",
];
const MAX_CHAT_HISTORY = 100;
class RoomManager {
    constructor(options) {
        this.options = options;
        this.rooms = new Map();
        this.yjsDocs = new Map();
        this.userRoomMap = new Map();
    }
    rehydrateRooms(now = Date.now()) {
        const persistedRooms = this.options.store.loadRooms(now);
        for (const record of persistedRooms) {
            const room = this.hydrateRoom(record);
            this.rooms.set(room.id, room);
        }
        return persistedRooms.length;
    }
    createRoom(payload) {
        if (this.rooms.has(payload.roomId)) {
            return null;
        }
        const now = Date.now();
        const room = {
            id: payload.roomId,
            mode: "collaboration",
            document: {
                name: payload.documentName,
                languageId: payload.languageId,
                code: payload.initialCode,
            },
            users: new Map(),
            cursors: new Map(),
            messages: [],
            createdAt: now,
            updatedAt: now,
            expiresAt: now + this.options.roomTtlMs,
        };
        this.rooms.set(room.id, room);
        const ydoc = new Y.Doc();
        const ytext = ydoc.getText("code");
        if (payload.initialCode) {
            ytext.insert(0, payload.initialCode);
        }
        this.yjsDocs.set(room.id, ydoc);
        this.appendSystemMessage(room.id, `Room created for ${payload.documentName || "untitled document"}.`);
        return room;
    }
    addUser(socketId, roomId, userName, role) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { ok: false, reason: "room-not-found" };
        }
        if (room.users.size >= this.options.maxUsersPerRoom) {
            return { ok: false, reason: "room-full" };
        }
        if (role === "teacher" && this.hasTeacher(room)) {
            return { ok: false, reason: "teacher-already-present" };
        }
        const user = {
            id: socketId,
            name: userName,
            role,
            roomId: room.id,
            color: this.assignColor(room),
            joinedAt: Date.now(),
        };
        room.users.set(socketId, user);
        this.userRoomMap.set(socketId, room.id);
        this.touchRoom(room);
        this.appendSystemMessage(room.id, `${user.name} joined the room as ${user.role}.`);
        return { ok: true, room, user };
    }
    removeUser(socketId) {
        const roomId = this.userRoomMap.get(socketId);
        if (!roomId) {
            return null;
        }
        const room = this.rooms.get(roomId);
        if (!room) {
            this.userRoomMap.delete(socketId);
            return null;
        }
        const user = room.users.get(socketId);
        if (!user) {
            this.userRoomMap.delete(socketId);
            return null;
        }
        room.users.delete(socketId);
        room.cursors.delete(socketId);
        this.userRoomMap.delete(socketId);
        this.touchRoom(room);
        this.appendSystemMessage(roomId, `${user.name} left the room.`);
        return {
            roomId,
            roomIsEmpty: room.users.size === 0,
            user,
        };
    }
    deleteRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        for (const userId of room.users.keys()) {
            this.userRoomMap.delete(userId);
        }
        this.rooms.delete(roomId);
        this.yjsDocs.get(roomId)?.destroy();
        this.yjsDocs.delete(roomId);
        this.options.store.deleteRoom(roomId);
    }
    deleteExpiredRooms(now = Date.now()) {
        let deletedCount = 0;
        for (const room of [...this.rooms.values()]) {
            if (room.expiresAt <= now) {
                this.deleteRoom(room.id);
                deletedCount += 1;
            }
        }
        deletedCount += this.options.store.deleteExpiredRooms(now);
        return deletedCount;
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    getUser(socketId) {
        const roomId = this.userRoomMap.get(socketId);
        if (!roomId) {
            return undefined;
        }
        return this.rooms.get(roomId)?.users.get(socketId);
    }
    getPublicUser(user) {
        return {
            id: user.id,
            name: user.name,
            role: user.role,
            color: user.color,
            joinedAt: user.joinedAt,
        };
    }
    isRoomMember(socketId, roomId) {
        return this.userRoomMap.get(socketId) === roomId;
    }
    canEdit(socketId) {
        const user = this.getUser(socketId);
        if (!user) {
            return false;
        }
        const room = this.rooms.get(user.roomId);
        if (!room) {
            return false;
        }
        if (room.mode === "collaboration") {
            return true;
        }
        return user.role === "teacher";
    }
    applyYjsUpdate(roomId, update) {
        const ydoc = this.yjsDocs.get(roomId);
        const room = this.rooms.get(roomId);
        if (!ydoc || !room) {
            return false;
        }
        Y.applyUpdate(ydoc, update);
        this.syncDocumentFromYjs(roomId);
        this.touchRoom(room);
        this.persistRoom(room.id);
        return true;
    }
    getEncodedYjsState(roomId) {
        const ydoc = this.yjsDocs.get(roomId);
        if (!ydoc) {
            return null;
        }
        return Y.encodeStateAsUpdate(ydoc);
    }
    getRoomState(roomId, selfId) {
        const room = this.rooms.get(roomId);
        const yjsState = this.getEncodedYjsState(roomId);
        if (!room || !yjsState) {
            return null;
        }
        return {
            room: {
                id: room.id,
                mode: room.mode,
                document: { ...room.document },
                users: [...room.users.values()].map((user) => this.getPublicUser(user)),
                cursors: [...room.cursors.values()],
                messages: [...room.messages],
                createdAt: room.createdAt,
                updatedAt: room.updatedAt,
            },
            selfId,
            yjsState,
        };
    }
    updateCursor(socketId, payload) {
        const user = this.getUser(socketId);
        if (!user) {
            return null;
        }
        const room = this.rooms.get(user.roomId);
        if (!room || room.id !== payload.roomId) {
            return null;
        }
        const cursorState = {
            roomId: room.id,
            userId: user.id,
            userName: user.name,
            color: user.color,
            cursor: payload.cursor,
            selection: payload.selection,
            updatedAt: Date.now(),
        };
        room.cursors.set(user.id, cursorState);
        return cursorState;
    }
    removeCursor(socketId) {
        const user = this.getUser(socketId);
        if (!user) {
            return;
        }
        const room = this.rooms.get(user.roomId);
        if (!room) {
            return;
        }
        room.cursors.delete(socketId);
    }
    addChatMessage(socketId, text) {
        const user = this.getUser(socketId);
        if (!user) {
            return null;
        }
        const room = this.rooms.get(user.roomId);
        if (!room) {
            return null;
        }
        const message = {
            id: (0, crypto_1.randomUUID)(),
            roomId: room.id,
            userId: user.id,
            userName: user.name,
            text,
            timestamp: Date.now(),
            type: "user",
        };
        room.messages.push(message);
        this.pruneMessages(room);
        this.touchRoom(room);
        this.persistRoom(room.id);
        return message;
    }
    addSystemMessage(roomId, text) {
        return this.appendSystemMessage(roomId, text);
    }
    setMode(roomId, mode) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return false;
        }
        room.mode = mode;
        this.touchRoom(room);
        this.persistRoom(room.id);
        return true;
    }
    listRooms() {
        return [...this.rooms.values()].map((room) => ({
            id: room.id,
            mode: room.mode,
            userCount: room.users.size,
            documentName: room.document.name,
            updatedAt: room.updatedAt,
            expiresAt: room.expiresAt,
        }));
    }
    close() {
        for (const ydoc of this.yjsDocs.values()) {
            ydoc.destroy();
        }
        this.yjsDocs.clear();
        this.options.store.close();
    }
    hydrateRoom(record) {
        const room = {
            id: record.id,
            mode: record.mode,
            document: { ...record.document },
            users: new Map(),
            cursors: new Map(),
            messages: [...record.messages],
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            expiresAt: record.expiresAt,
        };
        const ydoc = new Y.Doc();
        try {
            if (record.yjsState.length > 0) {
                Y.applyUpdate(ydoc, record.yjsState);
            }
            else if (record.document.code) {
                ydoc.getText("code").insert(0, record.document.code);
            }
        }
        catch {
            if (record.document.code) {
                ydoc.getText("code").insert(0, record.document.code);
            }
        }
        room.document.code = ydoc.getText("code").toString();
        this.yjsDocs.set(room.id, ydoc);
        return room;
    }
    syncDocumentFromYjs(roomId) {
        const room = this.rooms.get(roomId);
        const ydoc = this.yjsDocs.get(roomId);
        if (!room || !ydoc) {
            return;
        }
        room.document.code = ydoc.getText("code").toString();
    }
    assignColor(room) {
        const usedColors = new Set([...room.users.values()].map((user) => user.color));
        return (CURSOR_COLORS.find((color) => !usedColors.has(color)) ??
            CURSOR_COLORS[room.users.size % CURSOR_COLORS.length]);
    }
    hasTeacher(room) {
        return [...room.users.values()].some((user) => user.role === "teacher");
    }
    pruneMessages(room) {
        if (room.messages.length <= MAX_CHAT_HISTORY) {
            return;
        }
        room.messages.splice(0, room.messages.length - MAX_CHAT_HISTORY);
    }
    touchRoom(room) {
        const now = Date.now();
        room.updatedAt = now;
        room.expiresAt = now + this.options.roomTtlMs;
    }
    appendSystemMessage(roomId, text) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return null;
        }
        const message = {
            id: (0, crypto_1.randomUUID)(),
            roomId,
            userId: "system",
            userName: "CollabCode",
            text,
            timestamp: Date.now(),
            type: "system",
        };
        room.messages.push(message);
        this.pruneMessages(room);
        this.touchRoom(room);
        this.persistRoom(roomId);
        return message;
    }
    persistRoom(roomId) {
        const room = this.rooms.get(roomId);
        const yjsState = this.getEncodedYjsState(roomId);
        if (!room || !yjsState) {
            return;
        }
        this.options.store.saveRoom(room, yjsState);
    }
}
exports.RoomManager = RoomManager;
//# sourceMappingURL=roomManager.js.map