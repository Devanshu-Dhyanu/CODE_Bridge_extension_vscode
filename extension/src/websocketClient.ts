import { EventEmitter } from "events";
import { io, Socket } from "socket.io-client";
import {
  ChatMessage,
  ChatMessagePayload,
  CreateRoomPayload,
  CreateRoomResponse,
  CursorBroadcastPayload,
  CursorUpdatePayload,
  JoinRoomPayload,
  ModeChangePayload,
  ProtocolErrorPayload,
  RoomStatePayload,
  RoomUser,
  YjsUpdatePayload,
} from "./types";

type ClientEventMap = {
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  "room-state": (payload: RoomStatePayload) => void;
  "yjs-update": (payload: YjsUpdatePayload) => void;
  "cursor-update": (payload: CursorBroadcastPayload) => void;
  "cursor-remove": (payload: { userId: string }) => void;
  "user-joined": (payload: { user: RoomUser }) => void;
  "user-left": (payload: { userId: string }) => void;
  "chat-message": (payload: ChatMessage) => void;
  "mode-changed": (payload: { mode: ModeChangePayload["mode"] }) => void;
  error: (payload: ProtocolErrorPayload) => void;
};

export class WebSocketClient extends EventEmitter {
  private socket: Socket | null = null;
  private serverUrl: string | null = null;
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  async connect(serverUrl: string): Promise<void> {
    if (this.socket && this.serverUrl !== serverUrl) {
      this.disconnect();
    }

    if (!this.socket) {
      this.serverUrl = serverUrl;
      this.socket = this.createSocket(serverUrl);
    }

    if (this.socket.connected) {
      this._connected = true;
      return;
    }

    const socket = this.socket;
    socket.connect();

    await new Promise<void>((resolve, reject) => {
      const handleConnect = () => {
        cleanup();
        resolve();
      };

      const handleError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        socket.off("connect", handleConnect);
        socket.off("connect_error", handleError);
      };

      socket.on("connect", handleConnect);
      socket.on("connect_error", handleError);
    });
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;
    this.serverUrl = null;
    this._connected = false;
    socket.removeAllListeners();
    socket.disconnect();
  }

  joinRoom(payload: JoinRoomPayload): void {
    this.socket?.emit("join-room", payload);
  }

  async createRoom(payload: CreateRoomPayload): Promise<CreateRoomResponse> {
    if (!this.socket) {
      throw new Error("WebSocket connection is not available.");
    }

    return await new Promise<CreateRoomResponse>((resolve, reject) => {
      this.socket
        ?.timeout(10_000)
        .emit(
          "create-room",
          payload,
          (
            error: Error | null,
            response: CreateRoomResponse | undefined,
          ) => {
            if (error) {
              reject(error);
              return;
            }

            if (!response) {
              reject(new Error("The server did not return a room creation response."));
              return;
            }

            resolve(response);
          },
        );
    });
  }

  sendYjsUpdate(payload: YjsUpdatePayload): void {
    this.socket?.emit("yjs-update", payload);
  }

  sendCursorUpdate(payload: CursorUpdatePayload): void {
    this.socket?.emit("cursor-update", payload);
  }

  sendChatMessage(payload: ChatMessagePayload): void {
    this.socket?.emit("chat-message", payload);
  }

  changeMode(payload: ModeChangePayload): void {
    this.socket?.emit("mode-change", payload);
  }

  dispose(): void {
    this.disconnect();
  }

  private createSocket(serverUrl: string): Socket {
    const socket = io(serverUrl, {
      autoConnect: false,
      parser: require("socket.io-msgpack-parser"),
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10_000,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      this._connected = true;
      this.emit("connect");
    });

    socket.on("disconnect", (reason) => {
      this._connected = false;
      this.emit("disconnect", reason);
    });

    socket.on("connect_error", (error) => {
      this._connected = false;
      this.emit("connect_error", error as Error);
    });

    const forwardedEvents: (keyof ClientEventMap)[] = [
      "room-state",
      "yjs-update",
      "cursor-update",
      "cursor-remove",
      "user-joined",
      "user-left",
      "chat-message",
      "mode-changed",
      "error",
    ];

    for (const eventName of forwardedEvents) {
      socket.on(eventName, (payload: unknown) => {
        this.emit(eventName, payload);
      });
    }

    return socket;
  }
}
