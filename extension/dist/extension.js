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
const sidebarViewProvider_1 = require("./sidebarViewProvider");
const statusBar_1 = require("./statusBar");
const usersTreeProvider_1 = require("./usersTreeProvider");
const websocketClient_1 = require("./websocketClient");
let collabManager;
let statusBar;
let cursorManager;
function activate(context) {
    const wsClient = new websocketClient_1.WebSocketClient();
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
        await joinRoomFlow("teacher", true);
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
    context.subscriptions.push(createRoomCommand, joinRoomCommand, leaveRoomCommand, teacherModeCommand, collabModeCommand, copyRoomIdCommand, quickChatCommand);
    async function joinRoomFlow(defaultRole, isCreateFlow = false) {
        if (!collabManager) {
            return;
        }
        if (collabManager.isInSession) {
            void vscode.window.showInformationMessage("CollabCode: Leave the current room before joining another one.");
            return;
        }
        const suggestedRoomId = vscode.workspace.getConfiguration("collabCode").get("lastRoomId") ?? "";
        const roomId = await vscode.window.showInputBox({
            prompt: isCreateFlow ? "Create a room ID" : "Enter the room ID",
            placeHolder: "for example: cs101-lab-1",
            value: suggestedRoomId,
            validateInput: (value) => value.trim().length > 0 ? null : "Room ID cannot be empty.",
        });
        if (!roomId) {
            return;
        }
        const savedName = vscode.workspace.getConfiguration("collabCode").get("userName") ?? "";
        const userName = await vscode.window.showInputBox({
            prompt: "Display name",
            value: savedName,
            placeHolder: "for example: Alice",
            validateInput: (value) => value.trim().length > 0 ? null : "Display name cannot be empty.",
        });
        if (!userName) {
            return;
        }
        let role = defaultRole;
        if (!role) {
            const selectedRole = await vscode.window.showQuickPick([
                {
                    label: "Teacher",
                    description: "Can switch between teacher and collaboration modes",
                    value: "teacher",
                },
                {
                    label: "Student",
                    description: "Can collaborate unless the teacher enables read-only mode",
                    value: "student",
                },
            ], {
                placeHolder: "Choose how you want to join this room",
            });
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
function deactivate() {
    collabManager?.dispose();
    statusBar?.dispose();
    cursorManager?.dispose();
}
//# sourceMappingURL=extension.js.map