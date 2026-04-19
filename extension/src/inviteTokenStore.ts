import * as vscode from "vscode";
import { StoredInviteTokenSet } from "./types";

const INVITE_TOKEN_STORE_KEY = "collabCode.lastInviteTokens";

export class InviteTokenStore {
  constructor(private readonly state: vscode.Memento) {}

  async save(inviteSet: StoredInviteTokenSet): Promise<void> {
    await this.state.update(INVITE_TOKEN_STORE_KEY, inviteSet);
  }

  getLatest(): StoredInviteTokenSet | undefined {
    return this.state.get<StoredInviteTokenSet>(INVITE_TOKEN_STORE_KEY);
  }

  hasStoredInvite(): boolean {
    return this.getLatest() !== undefined;
  }
}
