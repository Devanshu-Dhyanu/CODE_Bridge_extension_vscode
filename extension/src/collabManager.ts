import * as path from "path";
import * as vscode from "vscode";
import * as Y from "yjs";
import { CursorManager } from "./cursorManager";
import {
  ChatMessage,
  CollabViewState,
  ConnectionState,
  CursorBroadcastPayload,
  JoinRoomPayload,
  RoomDocument,
  RoomMode,
  RoomStatePayload,
  RoomUser,
  SessionSnapshot,
  UserRole,
} from "./types";
import { WebSocketClient } from "./websocketClient";

const MAX_CHAT_HISTORY = 100;
const READ_ONLY_WARNING_COOLDOWN_MS = 1500;

interface SessionState {
  roomId: string;
  selfId: string;
  mode: RoomMode;
  users: Map<string, RoomUser>;
  document: RoomDocument;
  messages: ChatMessage[];
}

export class CollabManager {
  private readonly stateChangedEmitter = new vscode.EventEmitter<CollabViewState>();
  private readonly disposables: vscode.Disposable[] = [];

  private session: SessionState | null = null;
  private connectionState: ConnectionState = "disconnected";
  private pendingJoinRequest: JoinRoomPayload | null = null;
  private collaborativeDocumentUri: string | null = null;
  private ydoc: Y.Doc | null = null;
  private ytext: Y.Text | null = null;
  private suppressDocumentChange = false;
  private intentionalDisconnect = false;
  private lastReadOnlyWarningAt = 0;

  readonly onDidChangeState = this.stateChangedEmitter.event;

  constructor(
    private readonly client: WebSocketClient,
    private readonly cursorManager: CursorManager,
  ) {
    this.registerClientHandlers();
    this.registerEditorHandlers();
    this.emitState();
  }

  get isInSession(): boolean {
    return this.session !== null;
  }

  get viewState(): CollabViewState {
    return this.buildViewState();
  }

  async joinRoom(roomId: string, userName: string, role: UserRole): Promise<void> {
    if (this.session) {
      void vscode.window.showInformationMessage(
        "CollabCode: Leave the current room before joining another one.",
      );
      return;
    }

    const payload = await this.buildJoinPayload(roomId, userName, role);
    const serverUrl =
      vscode.workspace.getConfiguration("collabCode").get<string>("serverUrl") ??
      "http://localhost:3001";

    this.intentionalDisconnect = false;
    this.pendingJoinRequest = payload;
    this.connectionState = "connecting";
    this.emitState();

    try {
      await this.client.connect(serverUrl);
      this.client.joinRoom(payload);
    } catch (error) {
      this.pendingJoinRequest = null;
      this.connectionState = "disconnected";
      this.emitState();
      void vscode.window.showErrorMessage(
        `CollabCode: Unable to connect to ${serverUrl}. ${getErrorMessage(error)}`,
      );
    }
  }

  leaveRoom(silent = false): void {
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

  changeMode(mode: RoomMode): void {
    if (!this.session) {
      return;
    }

    const selfUser = this.session.users.get(this.session.selfId);
    if (!selfUser || selfUser.role !== "teacher") {
      void vscode.window.showWarningMessage(
        "CollabCode: Only the teacher can change the room mode.",
      );
      return;
    }

    this.client.changeMode({ roomId: this.session.roomId, mode });
  }

  copyRoomId(): void {
    if (!this.session) {
      return;
    }

    void vscode.env.clipboard.writeText(this.session.roomId);
    void vscode.window.showInformationMessage(
      `CollabCode: Copied room ID ${this.session.roomId}.`,
    );
  }

  sendChatMessage(text: string): void {
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

  dispose(): void {
    this.leaveRoom(true);
    this.stateChangedEmitter.dispose();
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private registerClientHandlers(): void {
    this.client.on("connect", () => {
      if (this.connectionState === "reconnecting" && this.pendingJoinRequest) {
        this.client.joinRoom(this.pendingJoinRequest);
      }
    });

    this.client.on("room-state", async (payload: RoomStatePayload) => {
      await this.handleRoomState(payload);
    });

    this.client.on("yjs-update", ({ roomId, update }) => {
      if (!this.session || this.session.roomId !== roomId || !this.ydoc) {
        return;
      }

      Y.applyUpdate(this.ydoc, update, "remote-sync");
    });

    this.client.on("cursor-update", (payload: CursorBroadcastPayload) => {
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

    this.client.on("chat-message", (message: ChatMessage) => {
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

    this.client.on("disconnect", (reason: string) => {
      if (this.intentionalDisconnect) {
        return;
      }

      if (this.pendingJoinRequest || this.session) {
        this.connectionState = "reconnecting";
        this.emitState();
        void vscode.window.showWarningMessage(
          `CollabCode: Connection lost (${reason}). Trying to reconnect...`,
        );
      } else {
        this.connectionState = "disconnected";
        this.emitState();
      }
    });
  }

  private registerEditorHandlers(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        void this.handleDocumentChange(event);
      }),
    );

    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((event) => {
        this.handleSelectionChange(event);
      }),
    );

    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((document) => {
        void this.handleClosedDocument(document);
      }),
    );
  }

  private async handleRoomState(payload: RoomStatePayload): Promise<void> {
    const wasReconnecting = this.connectionState === "reconnecting";
    const users = new Map(payload.room.users.map((user) => [user.id, user]));
    const selfUser = users.get(payload.selfId);
    if (!selfUser) {
      void vscode.window.showWarningMessage(
        "CollabCode: The server response did not include your user record.",
      );
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
      void vscode.window.showInformationMessage(
        `CollabCode: Reconnected to room ${payload.room.id}.`,
      );
    } else if (requestedRole === "teacher" && selfUser.role !== "teacher") {
      void vscode.window.showWarningMessage(
        "CollabCode: This room already has a teacher. You joined as a student.",
      );
    } else {
      void vscode.window.showInformationMessage(
        `CollabCode: Joined room ${payload.room.id} as ${selfUser.role}.`,
      );
    }
  }

  private async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
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

    const changes = [...event.contentChanges].sort(
      (left, right) => right.rangeOffset - left.rangeOffset,
    );

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

  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    if (!this.session || this.connectionState !== "connected") {
      return;
    }

    if (!this.isCollaborativeDocument(event.textEditor.document.uri)) {
      return;
    }

    const shareCursor =
      vscode.workspace.getConfiguration("collabCode").get<boolean>("shareCursor") ?? true;
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

  private async handleClosedDocument(document: vscode.TextDocument): Promise<void> {
    if (!this.session || !this.isCollaborativeDocument(document.uri)) {
      return;
    }

    await this.ensureCollaborativeDocument(
      {
        ...this.session.document,
        code: this.ytext?.toString() ?? this.session.document.code,
      },
      true,
      true,
    );
    await this.applySharedCodeToDocument(this.ytext?.toString() ?? this.session.document.code);
    void vscode.window.showWarningMessage(
      "CollabCode: The collaborative document was closed, so it has been reopened.",
    );
  }

  private initializeYjs(encodedState: Uint8Array): void {
    this.destroyYjs();

    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText("code");

    this.ydoc.on("update", (update: Uint8Array, origin: unknown) => {
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

  private destroyYjs(): void {
    this.ydoc?.destroy();
    this.ydoc = null;
    this.ytext = null;
  }

  private async buildJoinPayload(
    roomId: string,
    userName: string,
    role: UserRole,
  ): Promise<JoinRoomPayload> {
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

  private async ensureCollaborativeDocument(
    documentState: RoomDocument,
    reveal: boolean,
    forceNew = false,
  ): Promise<vscode.TextDocument> {
    let document =
      !forceNew && this.collaborativeDocumentUri
        ? vscode.workspace.textDocuments.find(
            (item) => item.uri.toString() === this.collaborativeDocumentUri,
          )
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

  private async applySharedCodeToDocument(code: string): Promise<void> {
    if (!this.session) {
      return;
    }

    const document = await this.ensureCollaborativeDocument(
      { ...this.session.document, code },
      false,
    );

    if (document.getText() === code) {
      return;
    }

    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, code);

    this.suppressDocumentChange = true;
    try {
      await vscode.workspace.applyEdit(edit);
    } finally {
      this.suppressDocumentChange = false;
    }
  }

  private isCollaborativeDocument(uri: vscode.Uri): boolean {
    return this.collaborativeDocumentUri !== null && uri.toString() === this.collaborativeDocumentUri;
  }

  private isReadOnly(): boolean {
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

  private warnIfReadOnly(): void {
    const now = Date.now();
    if (now - this.lastReadOnlyWarningAt < READ_ONLY_WARNING_COOLDOWN_MS) {
      return;
    }

    this.lastReadOnlyWarningAt = now;
    const message =
      this.connectionState !== "connected"
        ? "CollabCode: Waiting for the room to reconnect. Local edits are paused."
        : "CollabCode: This room is read-only for you right now.";
    void vscode.window.showWarningMessage(message);
  }

  private trimMessages(): void {
    if (!this.session || this.session.messages.length <= MAX_CHAT_HISTORY) {
      return;
    }

    this.session.messages.splice(0, this.session.messages.length - MAX_CHAT_HISTORY);
  }

  private emitState(): void {
    this.stateChangedEmitter.fire(this.buildViewState());
  }

  private buildViewState(): CollabViewState {
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

  private buildSessionSnapshot(): SessionSnapshot {
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
}
