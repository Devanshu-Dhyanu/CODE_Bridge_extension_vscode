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
exports.UsersTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
class UserTreeItem extends vscode.TreeItem {
    constructor(user, isSelf) {
        super(isSelf ? `${user.name} (You)` : user.name, vscode.TreeItemCollapsibleState.None);
        this.user = user;
        this.isSelf = isSelf;
        this.description = user.role === "teacher" ? "Teacher" : "Student";
        this.tooltip = `${user.name}\nRole: ${this.description}\nColor: ${user.color}`;
        this.iconPath = new vscode.ThemeIcon(user.role === "teacher" ? "megaphone" : "person");
    }
}
class UsersTreeProvider {
    constructor() {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
        this.state = {
            connectionState: "disconnected",
            session: null,
        };
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }
    setState(state) {
        this.state = state;
        this.onDidChangeTreeDataEmitter.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }
        if (!this.state.session) {
            return Promise.resolve([
                new UserTreeItem({
                    id: "placeholder",
                    name: "No connected users",
                    role: "student",
                    color: "#888888",
                    joinedAt: Date.now(),
                }, false),
            ]);
        }
        return Promise.resolve(this.state.session.users.map((user) => new UserTreeItem(user, user.id === this.state.session?.selfId)));
    }
}
exports.UsersTreeProvider = UsersTreeProvider;
//# sourceMappingURL=usersTreeProvider.js.map