import express from "express";
import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { RoomManager } from "./roomManager";
export interface CollabServerOptions {
    adminSecret: string;
    chatMessageLimit: number;
    chatMessageWindowMs: number;
    cleanupIntervalMs: number;
    corsOrigin: string;
    createRoomLimit: number;
    createRoomWindowMs: number;
    cursorUpdateLimit: number;
    cursorUpdateWindowMs: number;
    dbPath: string;
    inviteSecret: string;
    inviteTokenTtlHours: number;
    joinRoomLimit: number;
    joinRoomWindowMs: number;
    maxUsersPerRoom: number;
    port: number;
    roomTtlHours: number;
}
export interface CollabServer {
    app: express.Express;
    close(): Promise<void>;
    httpServer: HttpServer;
    io: Server;
    listen(): Promise<void>;
    roomManager: RoomManager;
}
export declare function createCollabServer(options: CollabServerOptions): CollabServer;
//# sourceMappingURL=serverApp.d.ts.map