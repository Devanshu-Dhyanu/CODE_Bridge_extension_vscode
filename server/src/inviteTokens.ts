import { createHmac, timingSafeEqual } from "crypto";
import { InviteTokenClaims, UserRole } from "./types";

const INVITE_TOKEN_VERSION = 1;

export function createInviteToken(
  roomId: string,
  role: UserRole,
  secret: string,
  ttlHours: number,
): string {
  const claims: InviteTokenClaims = {
    version: INVITE_TOKEN_VERSION,
    scope: "room:join",
    roomId,
    role,
    exp: Date.now() + ttlHours * 60 * 60 * 1000,
  };

  return signClaims(claims, secret);
}

export function verifyInviteToken(
  token: string,
  secret: string,
): InviteTokenClaims | null {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const receivedSignature = Buffer.from(encodedSignature, "base64url");
  const actualSignature = Buffer.from(expectedSignature, "base64url");

  if (
    receivedSignature.length !== actualSignature.length ||
    !timingSafeEqual(receivedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<InviteTokenClaims>;

    if (
      parsedPayload.version !== INVITE_TOKEN_VERSION ||
      parsedPayload.scope !== "room:join" ||
      typeof parsedPayload.roomId !== "string" ||
      (parsedPayload.role !== "teacher" && parsedPayload.role !== "student") ||
      typeof parsedPayload.exp !== "number" ||
      parsedPayload.exp <= Date.now()
    ) {
      return null;
    }

    return {
      version: parsedPayload.version,
      scope: parsedPayload.scope,
      roomId: parsedPayload.roomId,
      role: parsedPayload.role,
      exp: parsedPayload.exp,
    };
  } catch {
    return null;
  }
}

function signClaims(claims: InviteTokenClaims, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url",
  );

  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}
