export type UserRole = "teacher" | "student";
export type RoomMode = "teacher" | "collaboration";
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";
export type ProtocolErrorCode =
  | "admin-required"
  | "invalid-payload"
  | "invite-invalid-or-expired"
  | "protocol-mismatch"
  | "rate-limited"
  | "read-only"
  | "room-full"
  | "room-unavailable"
  | "teacher-already-connected"
  | "unauthorized";

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

export interface CreateRoomPayload {
  roomId: string;
  userName: string;
  documentName: string;
  languageId: string;
  initialCode: string;
  clientVersion: string;
}

export interface JoinRoomPayload {
  inviteToken: string;
  userName: string;
  clientVersion: string;
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
  protocolVersion: string;
  serverVersion: string;
}

export interface CreateRoomResponse {
  ok: boolean;
  code?: ProtocolErrorCode;
  message?: string;
  roomState?: RoomStatePayload;
  teacherInviteToken?: string;
  studentInviteToken?: string;
  protocolVersion?: string;
  serverVersion?: string;
  retryAfterMs?: number;
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

export interface ProtocolErrorPayload {
  code: ProtocolErrorCode;
  message: string;
  retryAfterMs?: number;
}

export interface StoredInviteTokenSet {
  roomId: string;
  teacherInviteToken: string;
  studentInviteToken: string;
  createdAt: number;
}
