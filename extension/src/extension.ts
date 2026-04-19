import * as path from "path";
import * as vscode from "vscode";
import { CollabManager } from "./collabManager";
import { CursorManager } from "./cursorManager";
import { GettingStartedPanel } from "./gettingStartedPanel";
import { InviteTokenStore } from "./inviteTokenStore";
import { SidebarViewProvider } from "./sidebarViewProvider";
import { StatusBarManager } from "./statusBar";
import { StoredInviteTokenSet } from "./types";
import { UsersTreeProvider } from "./usersTreeProvider";
import { WebSocketClient } from "./websocketClient";

const HAS_SHOWN_GETTING_STARTED_KEY = "collabCode.hasShownGettingStarted";

let collabManager: CollabManager | undefined;
let statusBar: StatusBarManager | undefined;
let cursorManager: CursorManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const wsClient = new WebSocketClient();
  const inviteTokenStore = new InviteTokenStore(context.globalState);
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
      await createRoomFlow();
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

  const copyStudentInviteTokenCommand = vscode.commands.registerCommand(
    "collabCode.copyStudentInviteToken",
    async () => {
      const inviteSet = inviteTokenStore.getLatest();
      if (!inviteSet) {
        void vscode.window.showInformationMessage(
          "CollabCode: Create a room first to store a student invite token.",
        );
        return;
      }

      await vscode.env.clipboard.writeText(inviteSet.studentInviteToken);
      void vscode.window.showInformationMessage(
        `CollabCode: Student invite token for room ${inviteSet.roomId} copied to the clipboard.`,
      );
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

  const openGettingStartedCommand = vscode.commands.registerCommand(
    GettingStartedPanel.commandId,
    async () => {
      await GettingStartedPanel.open();
    },
  );

  context.subscriptions.push(
    createRoomCommand,
    joinRoomCommand,
    leaveRoomCommand,
    teacherModeCommand,
    collabModeCommand,
    copyRoomIdCommand,
    copyStudentInviteTokenCommand,
    quickChatCommand,
    openGettingStartedCommand,
  );

  void maybeShowGettingStarted(context);

  async function createRoomFlow(): Promise<void> {
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
      prompt: "Create a room ID",
      placeHolder: "for example: cs101-lab-1",
      value: suggestedRoomId,
      validateInput: (value) =>
        value.trim().length > 0 ? null : "Room ID cannot be empty.",
      ignoreFocusOut: true,
    });

    if (!roomId) {
      return;
    }

    const userName = await promptForDisplayName();

    if (!userName) {
      return;
    }

    const documentName = await promptForDocumentName(roomId.trim());
    if (!documentName) {
      return;
    }

    await vscode.workspace
      .getConfiguration("collabCode")
      .update("userName", userName.trim(), vscode.ConfigurationTarget.Global);
    await vscode.workspace
      .getConfiguration("collabCode")
      .update("lastRoomId", roomId.trim(), vscode.ConfigurationTarget.Global);

    const inviteSet = await collabManager.createRoom(
      roomId.trim(),
      userName.trim(),
      documentName.trim(),
    );
    if (!inviteSet) {
      return;
    }

    await saveInviteTokens(inviteSet);
    await showInviteTokens(inviteSet);
  }

  async function joinRoomFlow(): Promise<void> {
    if (!collabManager) {
      return;
    }

    if (collabManager.isInSession) {
      void vscode.window.showInformationMessage(
        "CollabCode: Leave the current room before joining another one.",
      );
      return;
    }

    const inviteToken = await vscode.window.showInputBox({
      prompt: "Paste the invite token",
      placeHolder: "Use the teacher or student invite token",
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) =>
        value.trim().length > 0 ? null : "Invite token cannot be empty.",
    });

    if (!inviteToken) {
      return;
    }

    const userName = await promptForDisplayName();
    if (!userName) {
      return;
    }

    await vscode.workspace
      .getConfiguration("collabCode")
      .update("userName", userName.trim(), vscode.ConfigurationTarget.Global);

    await collabManager.joinRoom(inviteToken.trim(), userName.trim());
  }

  async function promptForDisplayName(): Promise<string | undefined> {
    const savedName =
      vscode.workspace.getConfiguration("collabCode").get<string>("userName") ?? "";

    return await vscode.window.showInputBox({
      prompt: "Display name",
      value: savedName,
      placeHolder: "for example: Alice",
      validateInput: (value) =>
        value.trim().length > 0 ? null : "Display name cannot be empty.",
      ignoreFocusOut: true,
    });
  }

  async function promptForDocumentName(roomId: string): Promise<string | undefined> {
    const activeDocument = vscode.window.activeTextEditor?.document;
    const suggestedName =
      path.basename(activeDocument?.fileName || "") || `${roomId || "collab-code"}.txt`;

    return await vscode.window.showInputBox({
      prompt: "Shared document name",
      value: suggestedName,
      placeHolder: "for example: main.cpp",
      validateInput: (value) =>
        value.trim().length > 0 ? null : "Document name cannot be empty.",
      ignoreFocusOut: true,
    });
  }

  async function saveInviteTokens(inviteSet: {
    roomId: string;
    teacherInviteToken: string;
    studentInviteToken: string;
  }): Promise<void> {
    const storedInviteSet: StoredInviteTokenSet = {
      ...inviteSet,
      createdAt: Date.now(),
    };

    await inviteTokenStore.save(storedInviteSet);
  }

  async function showInviteTokens(inviteSet: {
    roomId: string;
    teacherInviteToken: string;
    studentInviteToken: string;
  }): Promise<void> {
    const content = [
      `CollabCode room: ${inviteSet.roomId}`,
      "",
      "Teacher invite token:",
      inviteSet.teacherInviteToken,
      "",
      "Student invite token:",
      inviteSet.studentInviteToken,
      "",
      "Notes:",
      "- Keep the teacher token private.",
      "- Share only the student token with collaborators.",
      "- The student token has already been copied to your clipboard.",
      "- You can also run `CollabCode: Copy Student Invite Token` later.",
    ].join("\n");

    await vscode.env.clipboard.writeText(inviteSet.studentInviteToken);

    const inviteDocument = await vscode.workspace.openTextDocument({
      language: "plaintext",
      content,
    });

    await vscode.window.showTextDocument(inviteDocument, {
      preview: false,
      preserveFocus: false,
    });

    void vscode.window.showInformationMessage(
      `CollabCode: Room ${inviteSet.roomId} created. Student invite token copied to the clipboard.`,
    );
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

async function maybeShowGettingStarted(context: vscode.ExtensionContext): Promise<void> {
  const hasShown = context.globalState.get<boolean>(HAS_SHOWN_GETTING_STARTED_KEY) ?? false;
  if (hasShown) {
    return;
  }

  await context.globalState.update(HAS_SHOWN_GETTING_STARTED_KEY, true);
  await GettingStartedPanel.open();
}
