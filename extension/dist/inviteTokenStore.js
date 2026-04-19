"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteTokenStore = void 0;
const INVITE_TOKEN_STORE_KEY = "collabCode.lastInviteTokens";
class InviteTokenStore {
    constructor(state) {
        this.state = state;
    }
    async save(inviteSet) {
        await this.state.update(INVITE_TOKEN_STORE_KEY, inviteSet);
    }
    getLatest() {
        return this.state.get(INVITE_TOKEN_STORE_KEY);
    }
    hasStoredInvite() {
        return this.getLatest() !== undefined;
    }
}
exports.InviteTokenStore = InviteTokenStore;
//# sourceMappingURL=inviteTokenStore.js.map