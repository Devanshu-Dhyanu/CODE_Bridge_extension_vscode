"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeConnectionFailure = describeConnectionFailure;
exports.describeProtocolError = describeProtocolError;
const protocol_1 = require("./protocol");
function describeConnectionFailure(serverUrl, error) {
    const errorMessage = error instanceof Error && error.message ? error.message.toLowerCase() : "";
    if (errorMessage.includes("timeout") ||
        errorMessage.includes("websocket error") ||
        errorMessage.includes("xhr poll error")) {
        return serverUrl === protocol_1.DEFAULT_SERVER_URL
            ? `Unable to reach the hosted CollabCode service right now. Check ${serverUrl}/health and try again in a moment.`
            : `Unable to reach ${serverUrl}. Check that the backend is healthy and reachable from this machine.`;
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Unknown connection error.";
}
function describeProtocolError(error) {
    switch (error.code) {
        case "invite-invalid-or-expired":
            return "This invite token is invalid or has expired. Ask the host for a fresh student invite token.";
        case "protocol-mismatch":
            return `Your extension build is not compatible with the server (expected protocol ${protocol_1.PROTOCOL_VERSION}). Install the latest CollabCode release and try again.`;
        case "rate-limited":
            return error.retryAfterMs
                ? `${error.message} Try again in about ${Math.ceil(error.retryAfterMs / 1000)} seconds.`
                : error.message;
        case "room-unavailable":
            return "That room is not available right now. The host may need to recreate it.";
        case "room-full":
            return error.message;
        case "teacher-already-connected":
            return "A teacher is already connected to this room. Use the student invite token instead.";
        case "read-only":
            return "This room is read-only for you right now.";
        default:
            return error.message;
    }
}
//# sourceMappingURL=errors.js.map