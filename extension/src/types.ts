export type UserRole = "teacher" | "student";
export type RoomMode = "teacher" | "collaboration";
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

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
  type: "user" | "system";
}

export interface RoomDocument {
  name: string;
  languageId: string;
  code: string;
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

export interface SessionSnapshot {
  roomId: string;
  mode: RoomMode;
  selfId: string;
  selfUser: RoomUser;
  users: RoomUser[];
  document: RoomDocument;
  messages: ChatMessage[];
  canEdit: boolean;
}

export interface CollabViewState {
  connectionState: ConnectionState;
  session: SessionSnapshot | null;
}
