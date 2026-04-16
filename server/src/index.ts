import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager";
import {
  ChatMessagePayload,
  CursorUpdatePayload,
  JoinRoomPayload,
  ModeChangePayload,
  RoomMode,
  YjsUpdatePayload,
} from "./types";

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const MAX_ROOM_ID_LENGTH = 64;
const MAX_USER_NAME_LENGTH = 48;
const MAX_DOCUMENT_NAME_LENGTH = 120;
const MAX_LANGUAGE_ID_LENGTH = 50;
const MAX_CHAT_MESSAGE_LENGTH = 2000;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
  parser: require("socket.io-msgpack-parser"),
});

const roomManager = new RoomManager();

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    rooms: roomManager.listRooms().length,
    timestamp: Date.now(),
  });
});

app.get("/rooms", (_req, res) => {
  res.json({ rooms: roomManager.listRooms() });
});

io.on("connection", (socket: Socket) => {
  socket.on("join-room", (rawPayload: JoinRoomPayload) => {
    const payload = sanitizeJoinPayload(rawPayload);
    if (!payload) {
      emitProtocolError(socket, "Invalid room join payload.");
      return;
    }

    if (roomManager.getUser(socket.id)) {
      emitProtocolError(socket, "This client is already joined to a room.");
      return;
    }

    const { room, user, createdRoom } = roomManager.addUser(socket.id, payload);
    socket.join(room.id);

    const roomState = roomManager.getRoomState(room.id, socket.id);
    if (!roomState) {
      emitProtocolError(socket, "Unable to initialize the room state.");
      return;
    }

    socket.emit("room-state", roomState);
    socket.to(room.id).emit("user-joined", { user: roomManager.getPublicUser(user) });

    const joinMessage = room.messages[room.messages.length - 1];
    if (joinMessage?.type === "system") {
      socket.to(room.id).emit("chat-message", joinMessage);
    }

    if (createdRoom) {
      console.log(`[Room] Created ${room.id} for ${payload.documentName}`);
    }

    console.log(
      `[Room] ${user.name} joined ${room.id} as ${user.role} (${room.users.size} users)`,
    );
  });

  socket.on("yjs-update", (rawPayload: YjsUpdatePayload) => {
    if (!rawPayload || typeof rawPayload.roomId !== "string" || !(rawPayload.update instanceof Uint8Array)) {
      emitProtocolError(socket, "Invalid document update payload.");
      return;
    }

    if (!roomManager.isRoomMember(socket.id, rawPayload.roomId)) {
      emitProtocolError(socket, "You are not a member of that room.");
      return;
    }

    if (!roomManager.canEdit(socket.id)) {
      emitProtocolError(socket, "You are in read-only mode.");
      return;
    }

    const applied = roomManager.applyYjsUpdate(rawPayload.roomId, rawPayload.update);
    if (!applied) {
      emitProtocolError(socket, "Unable to apply the document update.");
      return;
    }

    socket.to(rawPayload.roomId).emit("yjs-update", {
      roomId: rawPayload.roomId,
      update: rawPayload.update,
    });
  });

  socket.on("cursor-update", (rawPayload: CursorUpdatePayload) => {
    const payload = sanitizeCursorPayload(rawPayload);
    if (!payload) {
      emitProtocolError(socket, "Invalid cursor payload.");
      return;
    }

    if (!roomManager.isRoomMember(socket.id, payload.roomId)) {
      emitProtocolError(socket, "You are not a member of that room.");
      return;
    }

    const cursorState = roomManager.updateCursor(socket.id, payload);
    if (!cursorState) {
      emitProtocolError(socket, "Unable to update the cursor.");
      return;
    }

    socket.to(payload.roomId).emit("cursor-update", cursorState);
  });

  socket.on("chat-message", (rawPayload: ChatMessagePayload) => {
    const payload = sanitizeChatPayload(rawPayload);
    if (!payload) {
      emitProtocolError(socket, "Invalid chat message payload.");
      return;
    }

    if (!roomManager.isRoomMember(socket.id, payload.roomId)) {
      emitProtocolError(socket, "You are not a member of that room.");
      return;
    }

    const message = roomManager.addChatMessage(socket.id, payload.text);
    if (!message) {
      emitProtocolError(socket, "Unable to send the chat message.");
      return;
    }

    io.to(payload.roomId).emit("chat-message", message);
  });

  socket.on("mode-change", (rawPayload: ModeChangePayload) => {
    const payload = sanitizeModePayload(rawPayload);
    if (!payload) {
      emitProtocolError(socket, "Invalid mode change payload.");
      return;
    }

    if (!roomManager.isRoomMember(socket.id, payload.roomId)) {
      emitProtocolError(socket, "You are not a member of that room.");
      return;
    }

    const user = roomManager.getUser(socket.id);
    if (!user || user.role !== "teacher") {
      emitProtocolError(socket, "Only the teacher can change the room mode.");
      return;
    }

    const updated = roomManager.setMode(payload.roomId, payload.mode);
    if (!updated) {
      emitProtocolError(socket, "Unable to update the room mode.");
      return;
    }

    io.to(payload.roomId).emit("mode-changed", { mode: payload.mode });

    const systemMessage = roomManager.addSystemMessage(
      payload.roomId,
      `${user.name} switched the room to ${payload.mode === "teacher" ? "Teacher" : "Collaboration"} mode.`,
    );

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

    if (removedUser.roomIsEmpty) {
      roomManager.deleteRoom(removedUser.roomId);
      console.log(`[Room] Deleted empty room ${removedUser.roomId}`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`CollabCode server listening on http://localhost:${PORT}`);
});

function emitProtocolError(socket: Socket, message: string): void {
  socket.emit("error", { message });
}

function sanitizeJoinPayload(payload: JoinRoomPayload | null | undefined): JoinRoomPayload | null {
  if (!payload) {
    return null;
  }

  const roomId = normalizeText(payload.roomId, MAX_ROOM_ID_LENGTH);
  const userName = normalizeText(payload.userName, MAX_USER_NAME_LENGTH);
  const documentName =
    normalizeText(payload.documentName, MAX_DOCUMENT_NAME_LENGTH) || "collab-code.ts";
  const languageId =
    normalizeText(payload.languageId, MAX_LANGUAGE_ID_LENGTH) || "plaintext";

  if (!roomId || !userName) {
    return null;
  }

  const role = payload.role === "teacher" ? "teacher" : "student";

  return {
    roomId,
    userName,
    role,
    documentName,
    languageId,
    initialCode: typeof payload.initialCode === "string" ? payload.initialCode : "",
  };
}

function sanitizeCursorPayload(
  payload: CursorUpdatePayload | null | undefined,
): CursorUpdatePayload | null {
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

function sanitizeChatPayload(
  payload: ChatMessagePayload | null | undefined,
): ChatMessagePayload | null {
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

function sanitizeModePayload(
  payload: ModeChangePayload | null | undefined,
): ModeChangePayload | null {
  if (!payload) {
    return null;
  }

  const roomId = normalizeText(payload.roomId, MAX_ROOM_ID_LENGTH);
  if (!roomId) {
    return null;
  }

  const mode: RoomMode =
    payload.mode === "teacher" ? "teacher" : "collaboration";

  return { roomId, mode };
}

function normalizeText(value: string | null | undefined, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isValidPosition(position: { line: number; character: number }): boolean {
  return (
    Number.isInteger(position.line) &&
    Number.isInteger(position.character) &&
    position.line >= 0 &&
    position.character >= 0
  );
}
