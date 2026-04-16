"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollabManager = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const Y = __importStar(require("yjs"));
const MAX_CHAT_HISTORY = 100;
const READ_ONLY_WARNING_COOLDOWN_MS = 1500;
class CollabManager {
    constructor(client, cursorManager) {
        this.client = client;
        this.cursorManager = cursorManager;
        this.stateChangedEmitter = new vscode.EventEmitter();
        this.disposables = [];
        this.session = null;
        this.connectionState = "disconnected";
        this.pendingJoinRequest = null;
        this.collaborativeDocumentUri = null;
        this.ydoc = null;
        this.ytext = null;
        this.suppressDocumentChange = false;
        this.intentionalDisconnect = false;
        this.lastReadOnlyWarningAt = 0;
        this.onDidChangeState = this.stateChangedEmitter.event;
        this.registerClientHandlers();
        this.registerEditorHandlers();
        this.emitState();
    }
    get isInSession() {
        return this.session !== null;
    }
    get viewState() {
        return this.buildViewState();
    }
    async joinRoom(roomId, userName, role) {
        if (this.session) {
            void vscode.window.showInformationMessage("CollabCode: Leave the current room before joining another one.");
            return;
        }
        const payload = await this.buildJoinPayload(roomId, userName, role);
        const serverUrl = vscode.workspace.getConfiguration("collabCode").get("serverUrl") ??
            "http://localhost:3001";
        this.intentionalDisconnect = false;
        this.pendingJoinRequest = payload;
        this.connectionState = "connecting";
        this.emitState();
        try {
            await this.client.connect(serverUrl);
            this.client.joinRoom(payload);
        }
        catch (error) {
            this.pendingJoinRequest = null;
            this.connectionState = "disconnected";
            this.emitState();
            void vscode.window.showErrorMessage(`CollabCode: Unable to connect to ${serverUrl}. ${getErrorMessage(error)}`);
        }
    }
    leaveRoom(silent = false) {
        const roomId = this.session?.roomId;
        this.intentionalDisconnect = true;
        this.pendingJoinRequest = null;
        this.connectionState = "disconnected";
        this.destroyYjs();
        this.cursorManager.clearAll();
        this.session = null;
        this.collaborativeDocumentUri = null;
        this.client.disconnect();
        this.emitState();
        if (!silent && roomId) {
            void vscode.window.showInformationMessage(`CollabCode: Left room ${roomId}.`);
        }
    }
    changeMode(mode) {
        if (!this.session) {
            return;
        }
        const selfUser = this.session.users.get(this.session.selfId);
        if (!selfUser || selfUser.role !== "teacher") {
            void vscode.window.showWarningMessage("CollabCode: Only the teacher can change the room mode.");
            return;
        }
        this.client.changeMode({ roomId: this.session.roomId, mode });
    }
    copyRoomId() {
        if (!this.session) {
            return;
        }
        void vscode.env.clipboard.writeText(this.session.roomId);
        void vscode.window.showInformationMessage(`CollabCode: Copied room ID ${this.session.roomId}.`);
    }
    sendChatMessage(text) {
        if (!this.session || this.connectionState !== "connected") {
            return;
        }
        const trimmedText = text.trim();
        if (!trimmedText) {
            return;
        }
        this.client.sendChatMessage({
            roomId: this.session.roomId,
            text: trimmedText,
        });
    }
    dispose() {
        this.leaveRoom(true);
        this.stateChangedEmitter.dispose();
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }
    registerClientHandlers() {
        this.client.on("connect", () => {
            if (this.connectionState === "reconnecting" && this.pendingJoinRequest) {
                this.client.joinRoom(this.pendingJoinRequest);
            }
        });
        this.client.on("room-state", async (payload) => {
            await this.handleRoomState(payload);
        });
        this.client.on("yjs-update", ({ roomId, update }) => {
            if (!this.session || this.session.roomId !== roomId || !this.ydoc) {
                return;
            }
            Y.applyUpdate(this.ydoc, update, "remote-sync");
        });
        this.client.on("cursor-update", (payload) => {
            if (!this.session || payload.userId === this.session.selfId) {
                return;
            }
            if (payload.roomId !== this.session.roomId) {
                return;
            }
            this.cursorManager.updateCursor(payload);
        });
        this.client.on("cursor-remove", ({ userId }) => {
            this.cursorManager.removeCursor(userId);
        });
        this.client.on("user-joined", ({ user }) => {
            if (!this.session) {
                return;
            }
            this.session.users.set(user.id, user);
            this.emitState();
        });
        this.client.on("user-left", ({ userId }) => {
            if (!this.session) {
                return;
            }
            this.session.users.delete(userId);
            this.cursorManager.removeCursor(userId);
            this.emitState();
        });
        this.client.on("chat-message", (message) => {
            if (!this.session || message.roomId !== this.session.roomId) {
                return;
            }
            this.session.messages.push(message);
            this.trimMessages();
            this.emitState();
        });
        this.client.on("mode-changed", ({ mode }) => {
            if (!this.session) {
                return;
            }
            this.session.mode = mode;
            this.emitState();
        });
        this.client.on("error", ({ message }) => {
            void vscode.window.showWarningMessage(`CollabCode: ${message}`);
        });
        this.client.on("disconnect", (reason) => {
            if (this.intentionalDisconnect) {
                return;
            }
            if (this.pendingJoinRequest || this.session) {
                this.connectionState = "reconnecting";
                this.emitState();
                void vscode.window.showWarningMessage(`CollabCode: Connection lost (${reason}). Trying to reconnect...`);
            }
            else {
                this.connectionState = "disconnected";
                this.emitState();
            }
        });
    }
    registerEditorHandlers() {
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            void this.handleDocumentChange(event);
        }));
        this.disposables.push(vscode.window.onDidChangeTextEditorSelection((event) => {
            this.handleSelectionChange(event);
        }));
        this.disposables.push(vscode.workspace.onDidCloseTextDocument((document) => {
            void this.handleClosedDocument(document);
        }));
    }
    async handleRoomState(payload) {
        const wasReconnecting = this.connectionState === "reconnecting";
        const users = new Map(payload.room.users.map((user) => [user.id, user]));
        const selfUser = users.get(payload.selfId);
        if (!selfUser) {
            void vscode.window.showWarningMessage("CollabCode: The server response did not include your user record.");
            return;
        }
        const requestedRole = this.pendingJoinRequest?.role;
        this.session = {
            roomId: payload.room.id,
            selfId: payload.selfId,
            mode: payload.room.mode,
            users,
            document: { ...payload.room.document },
            messages: [...payload.room.messages],
        };
        await this.ensureCollaborativeDocument(payload.room.document, this.connectionState !== "reconnecting");
        this.initializeYjs(payload.yjsState);
        this.cursorManager.clearAll();
        for (const cursor of payload.room.cursors) {
            if (cursor.userId !== payload.selfId) {
                this.cursorManager.updateCursor(cursor);
            }
        }
        this.connectionState = "connected";
        this.emitState();
        if (wasReconnecting) {
            void vscode.window.showInformationMessage(`CollabCode: Reconnected to room ${payload.room.id}.`);
        }
        else if (requestedRole === "teacher" && selfUser.role !== "teacher") {
            void vscode.window.showWarningMessage("CollabCode: This room already has a teacher. You joined as a student.");
        }
        else {
            void vscode.window.showInformationMessage(`CollabCode: Joined room ${payload.room.id} as ${selfUser.role}.`);
        }
    }
    async handleDocumentChange(event) {
        if (!this.session || !this.ytext) {
            return;
        }
        if (!this.isCollaborativeDocument(event.document.uri)) {
            return;
        }
        if (this.suppressDocumentChange) {
            return;
        }
        if (this.connectionState !== "connected" || this.isReadOnly()) {
            this.warnIfReadOnly();
            await this.applySharedCodeToDocument(this.ytext.toString());
            return;
        }
        const changes = [...event.contentChanges].sort((left, right) => right.rangeOffset - left.rangeOffset);
        this.ydoc?.transact(() => {
            for (const change of changes) {
                if (change.rangeLength > 0) {
                    this.ytext?.delete(change.rangeOffset, change.rangeLength);
                }
                if (change.text) {
                    this.ytext?.insert(change.rangeOffset, change.text);
                }
            }
        }, "local-editor");
        this.session.document.code = event.document.getText();
    }
    handleSelectionChange(event) {
        if (!this.session || this.connectionState !== "connected") {
            return;
        }
        if (!this.isCollaborativeDocument(event.textEditor.document.uri)) {
            return;
        }
        const shareCursor = vscode.workspace.getConfiguration("collabCode").get("shareCursor") ?? true;
        if (!shareCursor) {
            return;
        }
        const activeSelection = event.selections[0];
        if (!activeSelection) {
            return;
        }
        const cursorPayload = {
            roomId: this.session.roomId,
            cursor: {
                line: activeSelection.active.line,
                character: activeSelection.active.character,
            },
            selection: activeSelection.isEmpty
                ? undefined
                : {
                    start: {
                        line: activeSelection.start.line,
                        character: activeSelection.start.character,
                    },
                    end: {
                        line: activeSelection.end.line,
                        character: activeSelection.end.character,
                    },
                },
        };
        this.client.sendCursorUpdate(cursorPayload);
    }
    async handleClosedDocument(document) {
        if (!this.session || !this.isCollaborativeDocument(document.uri)) {
            return;
        }
        await this.ensureCollaborativeDocument({
            ...this.session.document,
            code: this.ytext?.toString() ?? this.session.document.code,
        }, true, true);
        await this.applySharedCodeToDocument(this.ytext?.toString() ?? this.session.document.code);
        void vscode.window.showWarningMessage("CollabCode: The collaborative document was closed, so it has been reopened.");
    }
    initializeYjs(encodedState) {
        this.destroyYjs();
        this.ydoc = new Y.Doc();
        this.ytext = this.ydoc.getText("code");
        this.ydoc.on("update", (update, origin) => {
            if (origin !== "local-editor" || !this.session || this.connectionState !== "connected") {
                return;
            }
            this.client.sendYjsUpdate({
                roomId: this.session.roomId,
                update,
            });
        });
        this.ytext.observe((event) => {
            const origin = event.transaction.origin;
            if (origin !== "remote-sync" && origin !== "room-state-sync") {
                return;
            }
            const currentCode = this.ytext?.toString() ?? "";
            if (this.session) {
                this.session.document.code = currentCode;
            }
            void this.applySharedCodeToDocument(currentCode);
        });
        Y.applyUpdate(this.ydoc, encodedState, "room-state-sync");
        if (this.session) {
            this.session.document.code = this.ytext.toString();
        }
    }
    destroyYjs() {
        this.ydoc?.destroy();
        this.ydoc = null;
        this.ytext = null;
    }
    async buildJoinPayload(roomId, userName, role) {
        const activeEditor = vscode.window.activeTextEditor;
        const activeDocument = activeEditor?.document;
        if (!activeDocument) {
            return {
                roomId: roomId.trim(),
                userName: userName.trim(),
                role,
                documentName: `${roomId.trim() || "collab-code"}.txt`,
                languageId: "plaintext",
                initialCode: "",
            };
        }
        const fileName = path.basename(activeDocument.fileName || "") || `${roomId.trim()}.txt`;
        return {
            roomId: roomId.trim(),
            userName: userName.trim(),
            role,
            documentName: fileName,
            languageId: activeDocument.languageId || "plaintext",
            initialCode: activeDocument.getText(),
        };
    }
    async ensureCollaborativeDocument(documentState, reveal, forceNew = false) {
        let document = !forceNew && this.collaborativeDocumentUri
            ? vscode.workspace.textDocuments.find((item) => item.uri.toString() === this.collaborativeDocumentUri)
            : undefined;
        if (!document) {
            document = await vscode.workspace.openTextDocument({
                language: documentState.languageId || "plaintext",
                content: documentState.code,
            });
            this.collaborativeDocumentUri = document.uri.toString();
        }
        this.cursorManager.setDocument(document.uri);
        if (reveal) {
            await vscode.window.showTextDocument(document, {
                preview: false,
                preserveFocus: false,
            });
        }
        return document;
    }
    async applySharedCodeToDocument(code) {
        if (!this.session) {
            return;
        }
        const document = await this.ensureCollaborativeDocument({ ...this.session.document, code }, false);
        if (document.getText() === code) {
            return;
        }
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, code);
        this.suppressDocumentChange = true;
        try {
            await vscode.workspace.applyEdit(edit);
        }
        finally {
            this.suppressDocumentChange = false;
        }
    }
    isCollaborativeDocument(uri) {
        return this.collaborativeDocumentUri !== null && uri.toString() === this.collaborativeDocumentUri;
    }
    isReadOnly() {
        if (!this.session) {
            return true;
        }
        const selfUser = this.session.users.get(this.session.selfId);
        if (!selfUser) {
            return true;
        }
        if (this.session.mode === "collaboration") {
            return false;
        }
        return selfUser.role !== "teacher";
    }
    warnIfReadOnly() {
        const now = Date.now();
        if (now - this.lastReadOnlyWarningAt < READ_ONLY_WARNING_COOLDOWN_MS) {
            return;
        }
        this.lastReadOnlyWarningAt = now;
        const message = this.connectionState !== "connected"
            ? "CollabCode: Waiting for the room to reconnect. Local edits are paused."
            : "CollabCode: This room is read-only for you right now.";
        void vscode.window.showWarningMessage(message);
    }
    trimMessages() {
        if (!this.session || this.session.messages.length <= MAX_CHAT_HISTORY) {
            return;
        }
        this.session.messages.splice(0, this.session.messages.length - MAX_CHAT_HISTORY);
    }
    emitState() {
        this.stateChangedEmitter.fire(this.buildViewState());
    }
    buildViewState() {
        if (!this.session) {
            return {
                connectionState: this.connectionState,
                session: null,
            };
        }
        return {
            connectionState: this.connectionState,
            session: this.buildSessionSnapshot(),
        };
    }
    buildSessionSnapshot() {
        if (!this.session) {
            throw new Error("Cannot build a session snapshot without a session.");
        }
        const users = [...this.session.users.values()].sort((left, right) => {
            if (left.role !== right.role) {
                return left.role === "teacher" ? -1 : 1;
            }
            return left.name.localeCompare(right.name);
        });
        const selfUser = this.session.users.get(this.session.selfId);
        if (!selfUser) {
            throw new Error("The current session is missing the local user.");
        }
        return {
            roomId: this.session.roomId,
            mode: this.session.mode,
            selfId: this.session.selfId,
            selfUser,
            users,
            document: { ...this.session.document },
            messages: [...this.session.messages],
            canEdit: this.connectionState === "connected" && !this.isReadOnly(),
        };
    }
}
exports.CollabManager = CollabManager;
function getErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Unknown error.";
}
//# sourceMappingURL=collabManager.js.map