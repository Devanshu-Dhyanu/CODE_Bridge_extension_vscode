"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUint8Array = toUint8Array;
function toUint8Array(value) {
    if (value instanceof Uint8Array) {
        return value;
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value)) {
        return Uint8Array.from(value);
    }
    throw new Error("CollabCode received an invalid binary payload from a client.");
}
//# sourceMappingURL=binary.js.map