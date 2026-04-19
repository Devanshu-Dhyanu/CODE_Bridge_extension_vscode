import * as vscode from "vscode";
import { DEFAULT_SERVER_URL } from "./protocol";

export class GettingStartedPanel {
  static readonly commandId = "collabCode.openGettingStarted";

  static async open(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "collabCode.gettingStarted",
      "CollabCode Getting Started",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      },
    );

    panel.webview.html = this.getHtml();
    panel.webview.onDidReceiveMessage(async (message: { type: string }) => {
      switch (message.type) {
        case "create-room":
          await vscode.commands.executeCommand("collabCode.createRoom");
          break;
        case "join-room":
          await vscode.commands.executeCommand("collabCode.joinRoom");
          break;
        case "open-settings":
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "@ext:collab-code.collab-code collabCode",
          );
          break;
        default:
          break;
      }
    });
  }

  private static getHtml(): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background: linear-gradient(180deg, var(--vscode-editor-background), color-mix(in srgb, var(--vscode-sideBar-background) 78%, black));
      }
      main {
        max-width: 760px;
        display: grid;
        gap: 16px;
      }
      .hero,
      .card {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 16px;
        padding: 18px;
        background: color-mix(in srgb, var(--vscode-editor-background) 90%, transparent);
      }
      h1, h2, p {
        margin: 0;
      }
      .hero {
        display: grid;
        gap: 10px;
      }
      .muted {
        color: var(--vscode-descriptionForeground);
      }
      .steps {
        display: grid;
        gap: 12px;
      }
      .step {
        display: grid;
        gap: 4px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 8px;
      }
      button {
        font: inherit;
        border-radius: 999px;
        padding: 8px 14px;
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        cursor: pointer;
      }
      button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      code {
        font-family: var(--vscode-editor-font-family);
      }
      ul {
        margin: 8px 0 0 18px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>CollabCode is ready to use</h1>
        <p class="muted">This build points to the hosted backend by default, so most users can install the extension and start collaborating immediately.</p>
        <div class="actions">
          <button id="createRoomButton">Create Room</button>
          <button id="joinRoomButton" class="secondary">Join Room</button>
          <button id="settingsButton" class="secondary">Open Settings</button>
        </div>
      </section>
      <section class="card steps">
        <div class="step">
          <h2>1. Host flow</h2>
          <p class="muted">Run <code>CollabCode: Create Room</code>, choose a room ID, and share the student invite token with collaborators.</p>
        </div>
        <div class="step">
          <h2>2. Join flow</h2>
          <p class="muted">Run <code>CollabCode: Join Room</code>, paste the invite token, and the shared document will open automatically.</p>
        </div>
        <div class="step">
          <h2>3. Hosted service</h2>
          <p class="muted">Default backend: <code>${DEFAULT_SERVER_URL}</code>. Advanced users can still override <code>collabCode.serverUrl</code> for self-hosted deployments.</p>
        </div>
        <div class="step">
          <h2>4. Operational note</h2>
          <p class="muted">The collaborative editor runs in a dedicated scratch document. Keep the teacher token private and share only the student token.</p>
        </div>
      </section>
      <section class="card">
        <h2>Quick checks</h2>
        <ul>
          <li>Use <code>/health</code> on the backend URL if you suspect a server outage.</li>
          <li>Rooms, messages, and shared code are retained for seven days of inactivity.</li>
          <li>Self-hosted users can override the default server URL in VS Code settings.</li>
        </ul>
      </section>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.getElementById("createRoomButton").addEventListener("click", () => {
        vscode.postMessage({ type: "create-room" });
      });
      document.getElementById("joinRoomButton").addEventListener("click", () => {
        vscode.postMessage({ type: "join-room" });
      });
      document.getElementById("settingsButton").addEventListener("click", () => {
        vscode.postMessage({ type: "open-settings" });
      });
    </script>
  </body>
</html>`;
  }
}

function getNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return nonce;
}
