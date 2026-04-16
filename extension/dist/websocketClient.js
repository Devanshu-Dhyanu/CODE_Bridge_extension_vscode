"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const events_1 = require("events");
const socket_io_client_1 = require("socket.io-client");
class WebSocketClient extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.socket = null;
        this.serverUrl = null;
        this._connected = false;
    }
    get connected() {
        return this._connected;
    }
    async connect(serverUrl) {
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
        await new Promise((resolve, reject) => {
            const handleConnect = () => {
                cleanup();
                resolve();
            };
            const handleError = (error) => {
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
    disconnect() {
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
    joinRoom(payload) {
        this.socket?.emit("join-room", payload);
    }
    sendYjsUpdate(payload) {
        this.socket?.emit("yjs-update", payload);
    }
    sendCursorUpdate(payload) {
        this.socket?.emit("cursor-update", payload);
    }
    sendChatMessage(payload) {
        this.socket?.emit("chat-message", payload);
    }
    changeMode(payload) {
        this.socket?.emit("mode-change", payload);
    }
    dispose() {
        this.disconnect();
    }
    createSocket(serverUrl) {
        const socket = (0, socket_io_client_1.io)(serverUrl, {
            autoConnect: false,
            parser: require("socket.io-msgpack-parser"),
            reconnection: true,
            reconnectionAttempts: Number.POSITIVE_INFINITY,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
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
            this.emit("connect_error", error);
        });
        const forwardedEvents = [
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
            socket.on(eventName, (payload) => {
                this.emit(eventName, payload);
            });
        }
        return socket;
    }
}
exports.WebSocketClient = WebSocketClient;
//# sourceMappingURL=websocketClient.js.map