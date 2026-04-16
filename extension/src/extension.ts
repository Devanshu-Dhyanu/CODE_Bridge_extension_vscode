import * as vscode from "vscode";
import { CollabManager } from "./collabManager";
import { CursorManager } from "./cursorManager";
import { SidebarViewProvider } from "./sidebarViewProvider";
import { StatusBarManager } from "./statusBar";
import { UserRole } from "./types";
import { UsersTreeProvider } from "./usersTreeProvider";
import { WebSocketClient } from "./websocketClient";

let collabManager: CollabManager | undefined;
let statusBar: StatusBarManager | undefined;
let cursorManager: CursorManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const wsClient = new WebSocketClient();
  statusBar = new StatusBarManager();
  cursorManager = new CursorManager();
  collabManager = new CollabManager(wsClient, cursorManager);

  const usersProvider = new UsersTreeProvider();
  const usersView = vscode.window.createTreeView("collabCode.users", {
    treeDataProvider: usersProvider,
    showCollapseAll: false,
  });

  const sidebarProvider = new SidebarViewProvider(collabManager);

  context.subscriptions.push(
    usersView,
    wsClient,
    statusBar,
    cursorManager,
    collabManager,
    vscode.window.registerWebviewViewProvider("collabCode.room", sidebarProvider),
  );

  context.subscriptions.push(
    collabManager.onDidChangeState((state) => {
      statusBar?.update(state);
      usersProvider.setState(state);
      sidebarProvider.setState(state);
      usersView.message = state.session
        ? `${state.session.roomId} | ${state.session.users.length} users`
        : "Not connected";
    }),
  );

  const createRoomCommand = vscode.commands.registerCommand(
    "collabCode.createRoom",
    async () => {
      await joinRoomFlow("teacher", true);
    },
  );

  const joinRoomCommand = vscode.commands.registerCommand(
    "collabCode.joinRoom",
    async () => {
      await joinRoomFlow();
    },
  );

  const leaveRoomCommand = vscode.commands.registerCommand(
    "collabCode.leaveRoom",
    async () => {
      if (!collabManager?.isInSession) {
        void vscode.window.showInformationMessage("CollabCode: You are not in a room.");
        return;
      }

      const confirmed = await vscode.window.showWarningMessage(
        "Leave the current collaboration room?",
        { modal: true },
        "Leave",
      );

      if (confirmed === "Leave") {
        collabManager.leaveRoom();
      }
    },
  );

  const teacherModeCommand = vscode.commands.registerCommand(
    "collabCode.setTeacherMode",
    () => {
      collabManager?.changeMode("teacher");
    },
  );

  const collabModeCommand = vscode.commands.registerCommand(
    "collabCode.setCollabMode",
    () => {
      collabManager?.changeMode("collaboration");
    },
  );

  const copyRoomIdCommand = vscode.commands.registerCommand(
    "collabCode.copyRoomId",
    () => {
      collabManager?.copyRoomId();
    },
  );

  const quickChatCommand = vscode.commands.registerCommand(
    "collabCode.sendChatMessage",
    async () => {
      if (!collabManager?.isInSession) {
        void vscode.window.showInformationMessage(
          "CollabCode: Join a room before sending chat messages.",
        );
        return;
      }

      const text = await vscode.window.showInputBox({
        prompt: "Send a room message",
        placeHolder: "Type your message",
        ignoreFocusOut: true,
        validateInput: (value) =>
          value.trim().length > 0 ? null : "Message cannot be empty.",
      });

      if (text) {
        collabManager.sendChatMessage(text);
      }
    },
  );

  context.subscriptions.push(
    createRoomCommand,
    joinRoomCommand,
    leaveRoomCommand,
    teacherModeCommand,
    collabModeCommand,
    copyRoomIdCommand,
    quickChatCommand,
  );

  async function joinRoomFlow(defaultRole?: UserRole, isCreateFlow = false): Promise<void> {
    if (!collabManager) {
      return;
    }

    if (collabManager.isInSession) {
      void vscode.window.showInformationMessage(
        "CollabCode: Leave the current room before joining another one.",
      );
      return;
    }

    const suggestedRoomId =
      vscode.workspace.getConfiguration("collabCode").get<string>("lastRoomId") ?? "";

    const roomId = await vscode.window.showInputBox({
      prompt: isCreateFlow ? "Create a room ID" : "Enter the room ID",
      placeHolder: "for example: cs101-lab-1",
      value: suggestedRoomId,
      validateInput: (value) =>
        value.trim().length > 0 ? null : "Room ID cannot be empty.",
    });

    if (!roomId) {
      return;
    }

    const savedName =
      vscode.workspace.getConfiguration("collabCode").get<string>("userName") ?? "";
    const userName = await vscode.window.showInputBox({
      prompt: "Display name",
      value: savedName,
      placeHolder: "for example: Alice",
      validateInput: (value) =>
        value.trim().length > 0 ? null : "Display name cannot be empty.",
    });

    if (!userName) {
      return;
    }

    let role = defaultRole;
    if (!role) {
      const selectedRole = await vscode.window.showQuickPick(
        [
          {
            label: "Teacher",
            description: "Can switch between teacher and collaboration modes",
            value: "teacher" as UserRole,
          },
          {
            label: "Student",
            description: "Can collaborate unless the teacher enables read-only mode",
            value: "student" as UserRole,
          },
        ],
        {
          placeHolder: "Choose how you want to join this room",
        },
      );

      if (!selectedRole) {
        return;
      }

      role = selectedRole.value;
    }

    if (!role) {
      return;
    }

    await vscode.workspace
      .getConfiguration("collabCode")
      .update("userName", userName.trim(), vscode.ConfigurationTarget.Global);
    await vscode.workspace
      .getConfiguration("collabCode")
      .update("lastRoomId", roomId.trim(), vscode.ConfigurationTarget.Global);

    await collabManager.joinRoom(roomId.trim(), userName.trim(), role);
  }

  const initialState = collabManager.viewState;
  statusBar.update(initialState);
  usersProvider.setState(initialState);
  sidebarProvider.setState(initialState);
  usersView.message = initialState.session
    ? `${initialState.session.roomId} | ${initialState.session.users.length} users`
    : "Not connected";
}

export function deactivate(): void {
  collabManager?.dispose();
  statusBar?.dispose();
  cursorManager?.dispose();
}
