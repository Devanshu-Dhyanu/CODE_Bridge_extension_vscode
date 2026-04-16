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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.update({ connectionState: "disconnected", session: null });
        this.item.show();
    }
    update(state) {
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
        const suffix = `${session.roomId} | ${session.users.length} user${session.users.length === 1 ? "" : "s"}`;
        if (session.mode === "collaboration") {
            this.item.text = `$(broadcast) CollabCode: ${suffix}`;
            this.item.tooltip = `Room ${session.roomId}\nMode: Collaboration`;
            this.item.backgroundColor = undefined;
        }
        else if (session.selfUser.role === "teacher") {
            this.item.text = `$(megaphone) CollabCode: ${suffix}`;
            this.item.tooltip = `Room ${session.roomId}\nMode: Teacher\nYou can edit`;
            this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        }
        else {
            this.item.text = `$(eye) CollabCode: ${suffix}`;
            this.item.tooltip = `Room ${session.roomId}\nMode: Teacher\nYou are read-only`;
            this.item.backgroundColor = undefined;
        }
        this.item.command = "collabCode.leaveRoom";
    }
    dispose() {
        this.item.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map