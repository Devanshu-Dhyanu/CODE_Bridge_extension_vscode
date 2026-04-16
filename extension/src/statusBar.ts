import * as vscode from "vscode";
import { CollabViewState } from "./types";

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.update({ connectionState: "disconnected", session: null });
    this.item.show();
  }

  update(state: CollabViewState): void {
    const { connectionState, session } = state;

    if (!session) {
      if (connectionState === "connecting") {
        this.item.text = "$(sync~spin) CollabCode: Connecting";
        this.item.tooltip = "Connecting to the collaboration server";
        this.item.command = "collabCode.joinRoom";
        this.item.backgroundColor = undefined;
        return;
      }

      this.item.text = "$(circle-slash) CollabCode";
      this.item.tooltip = "Join or create a collaboration room";
      this.item.command = "collabCode.joinRoom";
      this.item.backgroundColor = undefined;
      return;
    }

    if (connectionState === "reconnecting") {
      this.item.text = `$(sync~spin) CollabCode: Reconnecting ${session.roomId}`;
      this.item.tooltip = `Trying to reconnect to room ${session.roomId}`;
      this.item.command = "collabCode.leaveRoom";
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      return;
    }

    const suffix = `${session.roomId} | ${session.users.length} user${
      session.users.length === 1 ? "" : "s"
    }`;

    if (session.mode === "collaboration") {
      this.item.text = `$(broadcast) CollabCode: ${suffix}`;
      this.item.tooltip = `Room ${session.roomId}\nMode: Collaboration`;
      this.item.backgroundColor = undefined;
    } else if (session.selfUser.role === "teacher") {
      this.item.text = `$(megaphone) CollabCode: ${suffix}`;
      this.item.tooltip = `Room ${session.roomId}\nMode: Teacher\nYou can edit`;
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
      this.item.text = `$(eye) CollabCode: ${suffix}`;
      this.item.tooltip = `Room ${session.roomId}\nMode: Teacher\nYou are read-only`;
      this.item.backgroundColor = undefined;
    }

    this.item.command = "collabCode.leaveRoom";
  }

  dispose(): void {
    this.item.dispose();
  }
}
