import * as vscode from "vscode";
import { CollabViewState, RoomUser } from "./types";

class UserTreeItem extends vscode.TreeItem {
  constructor(
    readonly user: RoomUser,
    readonly isSelf: boolean,
  ) {
    super(
      isSelf ? `${user.name} (You)` : user.name,
      vscode.TreeItemCollapsibleState.None,
    );

    this.description = user.role === "teacher" ? "Teacher" : "Student";
    this.tooltip = `${user.name}\nRole: ${this.description}\nColor: ${user.color}`;
    this.iconPath = new vscode.ThemeIcon(
      user.role === "teacher" ? "megaphone" : "person",
    );
  }
}

export class UsersTreeProvider implements vscode.TreeDataProvider<UserTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    UserTreeItem | undefined | null | void
  >();
  private state: CollabViewState = {
    connectionState: "disconnected",
    session: null,
  };

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  setState(state: CollabViewState): void {
    this.state = state;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: UserTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: UserTreeItem): Thenable<UserTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    if (!this.state.session) {
      return Promise.resolve([
        new UserTreeItem(
          {
            id: "placeholder",
            name: "No connected users",
            role: "student",
            color: "#888888",
            joinedAt: Date.now(),
          },
          false,
        ),
      ]);
    }

    return Promise.resolve(
      this.state.session.users.map(
        (user) => new UserTreeItem(user, user.id === this.state.session?.selfId),
      ),
    );
  }
}
