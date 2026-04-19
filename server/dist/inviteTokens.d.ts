import { InviteTokenClaims, UserRole } from "./types";
export declare function createInviteToken(roomId: string, role: UserRole, secret: string, ttlHours: number): string;
export declare function verifyInviteToken(token: string, secret: string): InviteTokenClaims | null;
//# sourceMappingURL=inviteTokens.d.ts.map