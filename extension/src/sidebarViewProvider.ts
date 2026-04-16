import * as vscode from "vscode";
import { CollabManager } from "./collabManager";
import { CollabViewState } from "./types";

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  private state: CollabViewState = {
    connectionState: "disconnected",
    session: null,
  };
  private view: vscode.WebviewView | undefined;

  constructor(private readonly collabManager: CollabManager) {}

  setState(state: CollabViewState): void {
    this.state = state;
    void this.postState();
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
    };
    view.webview.html = this.getHtml(view.webview);

    view.webview.onDidReceiveMessage(async (message: { type: string; text?: string }) => {
      switch (message.type) {
        case "ready":
          await this.postState();
          break;
        case "join":
          await vscode.commands.executeCommand("collabCode.joinRoom");
          break;
        case "leave":
          await vscode.commands.executeCommand("collabCode.leaveRoom");
          break;
        case "copy-room-id":
          await vscode.commands.executeCommand("collabCode.copyRoomId");
          break;
        case "teacher-mode":
          this.collabManager.changeMode("teacher");
          break;
        case "collab-mode":
          this.collabManager.changeMode("collaboration");
          break;
        case "send-chat":
          if (typeof message.text === "string") {
            this.collabManager.sendChatMessage(message.text);
          }
          break;
        default:
          break;
      }
    });
  }

  private async postState(): Promise<void> {
    if (!this.view) {
      return;
    }

    await this.view.webview.postMessage({
      type: "state",
      state: this.state,
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
      }

      .panel {
        display: grid;
        gap: 12px;
      }

      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 10px;
        background: var(--vscode-editor-background);
        padding: 12px;
      }

      .title {
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 6px;
      }

      .muted {
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
      }

      .meta {
        display: grid;
        gap: 6px;
        margin-top: 8px;
      }

      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      button,
      textarea {
        font: inherit;
      }

      button {
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }

      button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      button:disabled {
        cursor: default;
        opacity: 0.6;
      }

      .messages {
        display: grid;
        gap: 8px;
        max-height: 280px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .message {
        border-radius: 10px;
        padding: 10px;
        border: 1px solid var(--vscode-panel-border);
        background: color-mix(in srgb, var(--vscode-editor-background) 92%, transparent);
      }

      .message.system {
        background: color-mix(in srgb, var(--vscode-textLink-foreground) 10%, transparent);
      }

      .message-header {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .message-author {
        font-weight: 600;
      }

      .composer {
        display: grid;
        gap: 8px;
      }

      .composer textarea {
        min-height: 72px;
        resize: vertical;
        border-radius: 10px;
        border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
        padding: 10px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        border-radius: 999px;
        padding: 4px 8px;
        background: color-mix(in srgb, var(--vscode-badge-background) 30%, transparent);
        color: var(--vscode-badge-foreground);
      }

      .empty {
        padding: 10px;
        border-radius: 10px;
        border: 1px dashed var(--vscode-panel-border);
        color: var(--vscode-descriptionForeground);
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <section class="card">
        <div class="status-badge" id="connectionState">Disconnected</div>
        <h2 class="title" id="roomTitle">CollabCode Room</h2>
        <div class="muted" id="roomSubtitle">Join a room to start collaborating.</div>
        <div class="meta" id="roomMeta"></div>
      </section>

      <section class="card">
        <div class="actions">
          <button id="joinButton">Join Room</button>
          <button id="leaveButton" class="secondary">Leave Room</button>
          <button id="copyRoomButton" class="secondary">Copy Room ID</button>
          <button id="teacherModeButton" class="secondary">Teacher Mode</button>
          <button id="collabModeButton" class="secondary">Collab Mode</button>
        </div>
      </section>

      <section class="card">
        <h2 class="title">Room Chat</h2>
        <div class="messages" id="messages"></div>
      </section>

      <section class="card">
        <form class="composer" id="composer">
          <textarea id="chatInput" placeholder="Share a note with the room"></textarea>
          <button id="sendButton" type="submit">Send Message</button>
        </form>
      </section>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const joinButton = document.getElementById("joinButton");
      const leaveButton = document.getElementById("leaveButton");
      const copyRoomButton = document.getElementById("copyRoomButton");
      const teacherModeButton = document.getElementById("teacherModeButton");
      const collabModeButton = document.getElementById("collabModeButton");
      const roomTitle = document.getElementById("roomTitle");
      const roomSubtitle = document.getElementById("roomSubtitle");
      const roomMeta = document.getElementById("roomMeta");
      const messages = document.getElementById("messages");
      const connectionState = document.getElementById("connectionState");
      const composer = document.getElementById("composer");
      const chatInput = document.getElementById("chatInput");
      const sendButton = document.getElementById("sendButton");

      joinButton.addEventListener("click", () => vscode.postMessage({ type: "join" }));
      leaveButton.addEventListener("click", () => vscode.postMessage({ type: "leave" }));
      copyRoomButton.addEventListener("click", () =>
        vscode.postMessage({ type: "copy-room-id" }),
      );
      teacherModeButton.addEventListener("click", () =>
        vscode.postMessage({ type: "teacher-mode" }),
      );
      collabModeButton.addEventListener("click", () =>
        vscode.postMessage({ type: "collab-mode" }),
      );

      composer.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = chatInput.value.trim();
        if (!text) {
          return;
        }

        vscode.postMessage({ type: "send-chat", text });
        chatInput.value = "";
      });

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message.type === "state") {
          render(message.state);
        }
      });

      function render(state) {
        const session = state.session;
        const isConnected = state.connectionState === "connected";
        const isInRoom = Boolean(session);
        const isTeacher = session?.selfUser?.role === "teacher";

        connectionState.textContent =
          state.connectionState.charAt(0).toUpperCase() + state.connectionState.slice(1);
        roomTitle.textContent = isInRoom ? "Room " + session.roomId : "CollabCode Room";
        roomSubtitle.textContent = isInRoom
          ? session.document.name + " | " + session.users.length + " collaborators"
          : "Join a room to start collaborating.";

        roomMeta.innerHTML = "";
        if (isInRoom) {
          const metaItems = [
            "Mode: " + (session.mode === "teacher" ? "Teacher" : "Collaboration"),
            "Your role: " + session.selfUser.role,
            "Editing: " + (session.canEdit ? "Enabled" : "Read-only"),
            "Language: " + session.document.languageId,
          ];

          metaItems.forEach((text) => {
            const div = document.createElement("div");
            div.className = "muted";
            div.textContent = text;
            roomMeta.appendChild(div);
          });
        }

        joinButton.disabled = isInRoom || state.connectionState === "connecting";
        leaveButton.disabled = !isInRoom;
        copyRoomButton.disabled = !isInRoom;
        teacherModeButton.disabled = !isInRoom || !isTeacher || session.mode === "teacher";
        collabModeButton.disabled =
          !isInRoom || !isTeacher || session.mode === "collaboration";
        chatInput.disabled = !isConnected || !isInRoom;
        sendButton.disabled = !isConnected || !isInRoom;

        messages.innerHTML = "";
        const roomMessages = session?.messages ?? [];
        if (roomMessages.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "Room messages will appear here.";
          messages.appendChild(empty);
        } else {
          roomMessages.forEach((roomMessage) => {
            const wrapper = document.createElement("div");
            wrapper.className = "message" + (roomMessage.type === "system" ? " system" : "");

            const header = document.createElement("div");
            header.className = "message-header";

            const author = document.createElement("span");
            author.className = "message-author";
            author.textContent = roomMessage.userName;

            const time = document.createElement("span");
            time.className = "muted";
            time.textContent = new Date(roomMessage.timestamp).toLocaleTimeString();

            header.appendChild(author);
            header.appendChild(time);

            const body = document.createElement("div");
            body.textContent = roomMessage.text;

            wrapper.appendChild(header);
            wrapper.appendChild(body);
            messages.appendChild(wrapper);
          });
          messages.scrollTop = messages.scrollHeight;
        }
      }

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
  }
}

function getNonce(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return nonce;
}
