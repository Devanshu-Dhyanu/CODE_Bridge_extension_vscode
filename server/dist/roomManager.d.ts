import { PersistentRoomStore } from "./persistentRoomStore";
import { ChatMessage, CreateRoomPayload, CursorBroadcastPayload, CursorUpdatePayload, RemovedUserResult, Room, RoomJoinResult, RoomListItem, RoomMode, RoomStatePayload, RoomUser, User, UserRole } from "./types";
interface RoomManagerOptions {
    maxUsersPerRoom: number;
    roomTtlMs: number;
    store: PersistentRoomStore;
}
export declare class RoomManager {
    private readonly options;
    private readonly rooms;
    private readonly yjsDocs;
    private readonly userRoomMap;
    constructor(options: RoomManagerOptions);
    rehydrateRooms(now?: number): number;
    createRoom(payload: CreateRoomPayload): Room | null;
    addUser(socketId: string, roomId: string, userName: string, role: UserRole): RoomJoinResult;
    removeUser(socketId: string): RemovedUserResult | null;
    deleteRoom(roomId: string): void;
    deleteExpiredRooms(now?: number): number;
    getRoom(roomId: string): Room | undefined;
    getUser(socketId: string): User | undefined;
    getPublicUser(user: User): RoomUser;
    isRoomMember(socketId: string, roomId: string): boolean;
    canEdit(socketId: string): boolean;
    applyYjsUpdate(roomId: string, update: Uint8Array): boolean;
    getEncodedYjsState(roomId: string): Uint8Array | null;
    getRoomState(roomId: string, selfId: string): Omit<RoomStatePayload, "protocolVersion" | "serverVersion"> | null;
    updateCursor(socketId: string, payload: CursorUpdatePayload): CursorBroadcastPayload | null;
    removeCursor(socketId: string): void;
    addChatMessage(socketId: string, text: string): ChatMessage | null;
    addSystemMessage(roomId: string, text: string): ChatMessage | null;
    setMode(roomId: string, mode: RoomMode): boolean;
    listRooms(): RoomListItem[];
    close(): void;
    private hydrateRoom;
    private syncDocumentFromYjs;
    private assignColor;
    private hasTeacher;
    private pruneMessages;
    private touchRoom;
    private appendSystemMessage;
    private persistRoom;
}
export {};
//# sourceMappingURL=roomManager.d.ts.map