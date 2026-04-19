import { ChatMessage, Room, RoomMode } from "./types";
export interface PersistedRoomRecord {
    id: string;
    mode: RoomMode;
    document: {
        name: string;
        languageId: string;
        code: string;
    };
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    yjsState: Uint8Array;
}
export declare class PersistentRoomStore {
    private readonly database;
    private readonly deleteExpiredStatement;
    private readonly deleteStatement;
    private readonly loadStatement;
    private readonly saveStatement;
    constructor(dbPath: string);
    loadRooms(now?: number): PersistedRoomRecord[];
    saveRoom(room: Room, yjsState: Uint8Array): void;
    deleteRoom(roomId: string): void;
    deleteExpiredRooms(now?: number): number;
    close(): void;
}
//# sourceMappingURL=persistentRoomStore.d.ts.map