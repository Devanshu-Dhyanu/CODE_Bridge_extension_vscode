import { ChatMessage, CursorBroadcastPayload, CursorUpdatePayload, JoinRoomPayload, RemovedUserResult, Room, RoomJoinResult, RoomListItem, RoomMode, RoomStatePayload, RoomUser, User } from "./types";
export declare class RoomManager {
    private readonly rooms;
    private readonly yjsDocs;
    private readonly userRoomMap;
    addUser(socketId: string, payload: JoinRoomPayload): RoomJoinResult;
    removeUser(socketId: string): RemovedUserResult | null;
    deleteRoom(roomId: string): void;
    getRoom(roomId: string): Room | undefined;
    getUser(socketId: string): User | undefined;
    getPublicUser(user: User): RoomUser;
    isRoomMember(socketId: string, roomId: string): boolean;
    canEdit(socketId: string): boolean;
    applyYjsUpdate(roomId: string, update: Uint8Array): boolean;
    getEncodedYjsState(roomId: string): Uint8Array | null;
    getRoomState(roomId: string, selfId: string): RoomStatePayload | null;
    updateCursor(socketId: string, payload: CursorUpdatePayload): CursorBroadcastPayload | null;
    removeCursor(socketId: string): void;
    addChatMessage(socketId: string, text: string): ChatMessage | null;
    addSystemMessage(roomId: string, text: string): ChatMessage | null;
    setMode(roomId: string, mode: RoomMode): boolean;
    listRooms(): RoomListItem[];
    private getOrCreateRoom;
    private syncDocumentFromYjs;
    private assignColor;
    private pruneMessages;
    private touchRoom;
    private appendSystemMessage;
}
//# sourceMappingURL=roomManager.d.ts.map