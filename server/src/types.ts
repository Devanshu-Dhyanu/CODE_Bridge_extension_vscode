export type UserRole = "teacher" | "student";
export type RoomMode = "teacher" | "collaboration";
export type ChatMessageType = "user" | "system";

export interface CursorPosition {
  line: number;
  character: number;
}

export interface CursorSelection {
  start: CursorPosition;
  end: CursorPosition;
}

export interface RoomUser {
  id: string;
  name: string;
  role: UserRole;
  color: string;
  joinedAt: number;
}

export interface User extends RoomUser {
  roomId: string;
}

export interface CursorBroadcastPayload {
  roomId: string;
  userId: string;
  userName: string;
  color: string;
  cursor: CursorPosition;
  selection?: CursorSelection;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  type: ChatMessageType;
}

export interface RoomDocument {
  name: string;
  languageId: string;
  code: string;
}

export interface Room {
  id: string;
  mode: RoomMode;
  document: RoomDocument;
  users: Map<string, User>;
  cursors: Map<string, CursorBroadcastPayload>;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface JoinRoomPayload {
  roomId: string;
  userName: string;
  role: UserRole;
  documentName: string;
  languageId: string;
  initialCode: string;
}

export interface YjsUpdatePayload {
  roomId: string;
  update: Uint8Array;
}

export interface CursorUpdatePayload {
  roomId: string;
  cursor: CursorPosition;
  selection?: CursorSelection;
}

export interface ChatMessagePayload {
  roomId: string;
  text: string;
}

export interface ModeChangePayload {
  roomId: string;
  mode: RoomMode;
}

export interface RoomStatePayload {
  room: {
    id: string;
    mode: RoomMode;
    document: RoomDocument;
    users: RoomUser[];
    cursors: CursorBroadcastPayload[];
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
  };
  selfId: string;
  yjsState: Uint8Array;
}

export interface RoomListItem {
  id: string;
  mode: RoomMode;
  userCount: number;
  documentName: string;
  updatedAt: number;
}

export interface RoomJoinResult {
  room: Room;
  user: User;
  createdRoom: boolean;
}

export interface RemovedUserResult {
  roomId: string;
  roomIsEmpty: boolean;
  user: User;
}
