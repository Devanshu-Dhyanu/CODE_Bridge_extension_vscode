import { randomUUID } from "crypto";
import * as Y from "yjs";
import {
  ChatMessage,
  CursorBroadcastPayload,
  CursorUpdatePayload,
  JoinRoomPayload,
  RemovedUserResult,
  Room,
  RoomJoinResult,
  RoomListItem,
  RoomMode,
  RoomStatePayload,
  RoomUser,
  User,
  UserRole,
} from "./types";

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

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly yjsDocs = new Map<string, Y.Doc>();
  private readonly userRoomMap = new Map<string, string>();

  addUser(socketId: string, payload: JoinRoomPayload): RoomJoinResult {
    const { room, createdRoom } = this.getOrCreateRoom(payload);

    let role: UserRole = payload.role;
    if (role === "teacher") {
      const teacherAlreadyPresent = [...room.users.values()].some(
        (user) => user.role === "teacher",
      );
      if (teacherAlreadyPresent) {
        role = "student";
      }
    }

    const user: User = {
      id: socketId,
      name: payload.userName,
      role,
      roomId: room.id,
      color: this.assignColor(room),
      joinedAt: Date.now(),
    };

    room.users.set(socketId, user);
    this.userRoomMap.set(socketId, room.id);
    this.touchRoom(room);

    this.appendSystemMessage(
      room.id,
      `${user.name} joined the room as ${user.role}.`,
    );

    return { room, user, createdRoom };
  }

  removeUser(socketId: string): RemovedUserResult | null {
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

  deleteRoom(roomId: string): void {
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
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getUser(socketId: string): User | undefined {
    const roomId = this.userRoomMap.get(socketId);
    if (!roomId) {
      return undefined;
    }

    return this.rooms.get(roomId)?.users.get(socketId);
  }

  getPublicUser(user: User): RoomUser {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      color: user.color,
      joinedAt: user.joinedAt,
    };
  }

  isRoomMember(socketId: string, roomId: string): boolean {
    return this.userRoomMap.get(socketId) === roomId;
  }

  canEdit(socketId: string): boolean {
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

  applyYjsUpdate(roomId: string, update: Uint8Array): boolean {
    const ydoc = this.yjsDocs.get(roomId);
    const room = this.rooms.get(roomId);
    if (!ydoc || !room) {
      return false;
    }

    Y.applyUpdate(ydoc, update);
    this.syncDocumentFromYjs(roomId);
    this.touchRoom(room);
    return true;
  }

  getEncodedYjsState(roomId: string): Uint8Array | null {
    const ydoc = this.yjsDocs.get(roomId);
    if (!ydoc) {
      return null;
    }

    return Y.encodeStateAsUpdate(ydoc);
  }

  getRoomState(roomId: string, selfId: string): RoomStatePayload | null {
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

  updateCursor(socketId: string, payload: CursorUpdatePayload): CursorBroadcastPayload | null {
    const user = this.getUser(socketId);
    if (!user) {
      return null;
    }

    const room = this.rooms.get(user.roomId);
    if (!room || room.id !== payload.roomId) {
      return null;
    }

    const cursorState: CursorBroadcastPayload = {
      roomId: room.id,
      userId: user.id,
      userName: user.name,
      color: user.color,
      cursor: payload.cursor,
      selection: payload.selection,
      updatedAt: Date.now(),
    };

    room.cursors.set(user.id, cursorState);
    this.touchRoom(room);
    return cursorState;
  }

  removeCursor(socketId: string): void {
    const user = this.getUser(socketId);
    if (!user) {
      return;
    }

    const room = this.rooms.get(user.roomId);
    if (!room) {
      return;
    }

    room.cursors.delete(socketId);
    this.touchRoom(room);
  }

  addChatMessage(socketId: string, text: string): ChatMessage | null {
    const user = this.getUser(socketId);
    if (!user) {
      return null;
    }

    const room = this.rooms.get(user.roomId);
    if (!room) {
      return null;
    }

    const message: ChatMessage = {
      id: randomUUID(),
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
    return message;
  }

  addSystemMessage(roomId: string, text: string): ChatMessage | null {
    return this.appendSystemMessage(roomId, text);
  }

  setMode(roomId: string, mode: RoomMode): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    room.mode = mode;
    this.touchRoom(room);
    return true;
  }

  listRooms(): RoomListItem[] {
    return [...this.rooms.values()].map((room) => ({
      id: room.id,
      mode: room.mode,
      userCount: room.users.size,
      documentName: room.document.name,
      updatedAt: room.updatedAt,
    }));
  }

  private getOrCreateRoom(payload: JoinRoomPayload): { room: Room; createdRoom: boolean } {
    const existingRoom = this.rooms.get(payload.roomId);
    if (existingRoom) {
      return { room: existingRoom, createdRoom: false };
    }

    const room: Room = {
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.rooms.set(room.id, room);

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("code");
    if (payload.initialCode) {
      ytext.insert(0, payload.initialCode);
    }
    this.yjsDocs.set(room.id, ydoc);
    this.appendSystemMessage(
      room.id,
      `Room created for ${payload.documentName || "untitled document"}.`,
    );

    return { room, createdRoom: true };
  }

  private syncDocumentFromYjs(roomId: string): void {
    const room = this.rooms.get(roomId);
    const ydoc = this.yjsDocs.get(roomId);
    if (!room || !ydoc) {
      return;
    }

    room.document.code = ydoc.getText("code").toString();
  }

  private assignColor(room: Room): string {
    const usedColors = new Set([...room.users.values()].map((user) => user.color));
    return (
      CURSOR_COLORS.find((color) => !usedColors.has(color)) ??
      CURSOR_COLORS[room.users.size % CURSOR_COLORS.length]
    );
  }

  private pruneMessages(room: Room): void {
    if (room.messages.length <= MAX_CHAT_HISTORY) {
      return;
    }

    room.messages.splice(0, room.messages.length - MAX_CHAT_HISTORY);
  }

  private touchRoom(room: Room): void {
    room.updatedAt = Date.now();
  }

  private appendSystemMessage(roomId: string, text: string): ChatMessage | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const message: ChatMessage = {
      id: randomUUID(),
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
    return message;
  }
}
