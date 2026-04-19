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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const collabManager_1 = require("./collabManager");
const cursorManager_1 = require("./cursorManager");
const gettingStartedPanel_1 = require("./gettingStartedPanel");
const inviteTokenStore_1 = require("./inviteTokenStore");
const sidebarViewProvider_1 = require("./sidebarViewProvider");
const statusBar_1 = require("./statusBar");
const usersTreeProvider_1 = require("./usersTreeProvider");
const websocketClient_1 = require("./websocketClient");
const HAS_SHOWN_GETTING_STARTED_KEY = "collabCode.hasShownGettingStarted";
let collabManager;
let statusBar;
let cursorManager;
function activate(context) {
    const wsClient = new websocketClient_1.WebSocketClient();
    const inviteTokenStore = new inviteTokenStore_1.InviteTokenStore(context.globalState);
    statusBar = new statusBar_1.StatusBarManager();
    cursorManager = new cursorManager_1.CursorManager();
    collabManager = new collabManager_1.CollabManager(wsClient, cursorManager);
    const usersProvider = new usersTreeProvider_1.UsersTreeProvider();
    const usersView = vscode.window.createTreeView("collabCode.users", {
        treeDataProvider: usersProvider,
        showCollapseAll: false,
    });
    const sidebarProvider = new sidebarViewProvider_1.SidebarViewProvider(collabManager);
    context.subscriptions.push(usersView, wsClient, statusBar, cursorManager, collabManager, vscode.window.registerWebviewViewProvider("collabCode.room", sidebarProvider));
    context.subscriptions.push(collabManager.onDidChangeState((state) => {
        statusBar?.update(state);
        usersProvider.setState(state);
        sidebarProvider.setState(state);
        usersView.message = state.session
            ? `${state.session.roomId} | ${state.session.users.length} users`
            : "Not connected";
    }));
    const createRoomCommand = vscode.commands.registerCommand("collabCode.createRoom", async () => {
        await createRoomFlow();
    });
    const joinRoomCommand = vscode.commands.registerCommand("collabCode.joinRoom", async () => {
        await joinRoomFlow();
    });
    const leaveRoomCommand = vscode.commands.registerCommand("collabCode.leaveRoom", async () => {
        if (!collabManager?.isInSession) {
            void vscode.window.showInformationMessage("CollabCode: You are not in a room.");
            return;
        }
        const confirmed = await vscode.window.showWarningMessage("Leave the current collaboration room?", { modal: true }, "Leave");
        if (confirmed === "Leave") {
            collabManager.leaveRoom();
        }
    });
    const teacherModeCommand = vscode.commands.registerCommand("collabCode.setTeacherMode", () => {
        collabManager?.changeMode("teacher");
    });
    const collabModeCommand = vscode.commands.registerCommand("collabCode.setCollabMode", () => {
        collabManager?.changeMode("collaboration");
    });
    const copyRoomIdCommand = vscode.commands.registerCommand("collabCode.copyRoomId", () => {
        collabManager?.copyRoomId();
    });
    const copyStudentInviteTokenCommand = vscode.commands.registerCommand("collabCode.copyStudentInviteToken", async () => {
        const inviteSet = inviteTokenStore.getLatest();
        if (!inviteSet) {
            void vscode.window.showInformationMessage("CollabCode: Create a room first to store a student invite token.");
            return;
        }
        await vscode.env.clipboard.writeText(inviteSet.studentInviteToken);
        void vscode.window.showInformationMessage(`CollabCode: Student invite token for room ${inviteSet.roomId} copied to the clipboard.`);
    });
    const quickChatCommand = vscode.commands.registerCommand("collabCode.sendChatMessage", async () => {
        if (!collabManager?.isInSession) {
            void vscode.window.showInformationMessage("CollabCode: Join a room before sending chat messages.");
            return;
        }
        const text = await vscode.window.showInputBox({
            prompt: "Send a room message",
            placeHolder: "Type your message",
            ignoreFocusOut: true,
            validateInput: (value) => value.trim().length > 0 ? null : "Message cannot be empty.",
        });
        if (text) {
            collabManager.sendChatMessage(text);
        }
    });
    const openGettingStartedCommand = vscode.commands.registerCommand(gettingStartedPanel_1.GettingStartedPanel.commandId, async () => {
        await gettingStartedPanel_1.GettingStartedPanel.open();
    });
    context.subscriptions.push(createRoomCommand, joinRoomCommand, leaveRoomCommand, teacherModeCommand, collabModeCommand, copyRoomIdCommand, copyStudentInviteTokenCommand, quickChatCommand, openGettingStartedCommand);
    void maybeShowGettingStarted(context);
    async function createRoomFlow() {
        if (!collabManager) {
            return;
        }
        if (collabManager.isInSession) {
            void vscode.window.showInformationMessage("CollabCode: Leave the current room before joining another one.");
            return;
        }
        const suggestedRoomId = vscode.workspace.getConfiguration("collabCode").get("lastRoomId") ?? "";
        const roomId = await vscode.window.showInputBox({
            prompt: "Create a room ID",
            placeHolder: "for example: cs101-lab-1",
            value: suggestedRoomId,
            validateInput: (value) => value.trim().length > 0 ? null : "Room ID cannot be empty.",
            ignoreFocusOut: true,
        });
        if (!roomId) {
            return;
        }
        const userName = await promptForDisplayName();
        if (!userName) {
            return;
        }
        await vscode.workspace
            .getConfiguration("collabCode")
            .update("userName", userName.trim(), vscode.ConfigurationTarget.Global);
        await vscode.workspace
            .getConfiguration("collabCode")
            .update("lastRoomId", roomId.trim(), vscode.ConfigurationTarget.Global);
        const inviteSet = await collabManager.createRoom(roomId.trim(), userName.trim());
        if (!inviteSet) {
            return;
        }
        await saveInviteTokens(inviteSet);
        await showInviteTokens(inviteSet);
    }
    async function joinRoomFlow() {
        if (!collabManager) {
            return;
        }
        if (collabManager.isInSession) {
            void vscode.window.showInformationMessage("CollabCode: Leave the current room before joining another one.");
            return;
        }
        const inviteToken = await vscode.window.showInputBox({
            prompt: "Paste the invite token",
            placeHolder: "Use the teacher or student invite token",
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => value.trim().length > 0 ? null : "Invite token cannot be empty.",
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
    async function promptForDisplayName() {
        const savedName = vscode.workspace.getConfiguration("collabCode").get("userName") ?? "";
        return await vscode.window.showInputBox({
            prompt: "Display name",
            value: savedName,
            placeHolder: "for example: Alice",
            validateInput: (value) => value.trim().length > 0 ? null : "Display name cannot be empty.",
            ignoreFocusOut: true,
        });
    }
    async function saveInviteTokens(inviteSet) {
        const storedInviteSet = {
            ...inviteSet,
            createdAt: Date.now(),
        };
        await inviteTokenStore.save(storedInviteSet);
    }
    async function showInviteTokens(inviteSet) {
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
        void vscode.window.showInformationMessage(`CollabCode: Room ${inviteSet.roomId} created. Student invite token copied to the clipboard.`);
    }
    const initialState = collabManager.viewState;
    statusBar.update(initialState);
    usersProvider.setState(initialState);
    sidebarProvider.setState(initialState);
    usersView.message = initialState.session
        ? `${initialState.session.roomId} | ${initialState.session.users.length} users`
        : "Not connected";
}
function deactivate() {
    collabManager?.dispose();
    statusBar?.dispose();
    cursorManager?.dispose();
}
async function maybeShowGettingStarted(context) {
    const hasShown = context.globalState.get(HAS_SHOWN_GETTING_STARTED_KEY) ?? false;
    if (hasShown) {
        return;
    }
    await context.globalState.update(HAS_SHOWN_GETTING_STARTED_KEY, true);
    await gettingStartedPanel_1.GettingStartedPanel.open();
}
//# sourceMappingURL=extension.js.map