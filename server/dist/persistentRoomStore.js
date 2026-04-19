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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistentRoomStore = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class PersistentRoomStore {
    constructor(dbPath) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        this.database = new better_sqlite3_1.default(dbPath);
        this.database.pragma("journal_mode = WAL");
        this.database.pragma("synchronous = NORMAL");
        this.database.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        document_name TEXT NOT NULL,
        language_id TEXT NOT NULL,
        document_code TEXT NOT NULL,
        messages_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        yjs_state BLOB NOT NULL
      );
    `);
        this.loadStatement = this.database.prepare(`
      SELECT
        id,
        mode,
        document_name,
        language_id,
        document_code,
        messages_json,
        created_at,
        updated_at,
        expires_at,
        yjs_state
      FROM rooms
      WHERE expires_at > ?
      ORDER BY updated_at DESC
    `);
        this.saveStatement = this.database.prepare(`
      INSERT INTO rooms (
        id,
        mode,
        document_name,
        language_id,
        document_code,
        messages_json,
        created_at,
        updated_at,
        expires_at,
        yjs_state
      ) VALUES (
        @id,
        @mode,
        @documentName,
        @languageId,
        @documentCode,
        @messagesJson,
        @createdAt,
        @updatedAt,
        @expiresAt,
        @yjsState
      )
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode,
        document_name = excluded.document_name,
        language_id = excluded.language_id,
        document_code = excluded.document_code,
        messages_json = excluded.messages_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at,
        yjs_state = excluded.yjs_state
    `);
        this.deleteStatement = this.database.prepare("DELETE FROM rooms WHERE id = ?");
        this.deleteExpiredStatement = this.database.prepare("DELETE FROM rooms WHERE expires_at <= ?");
    }
    loadRooms(now = Date.now()) {
        const rows = this.loadStatement.all(now);
        const records = [];
        for (const row of rows) {
            try {
                records.push({
                    id: row.id,
                    mode: row.mode,
                    document: {
                        name: row.document_name,
                        languageId: row.language_id,
                        code: row.document_code,
                    },
                    messages: JSON.parse(row.messages_json),
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    expiresAt: row.expires_at,
                    yjsState: Uint8Array.from(row.yjs_state),
                });
            }
            catch {
                continue;
            }
        }
        return records;
    }
    saveRoom(room, yjsState) {
        this.saveStatement.run({
            id: room.id,
            mode: room.mode,
            documentName: room.document.name,
            languageId: room.document.languageId,
            documentCode: room.document.code,
            messagesJson: JSON.stringify(room.messages),
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
            expiresAt: room.expiresAt,
            yjsState: Buffer.from(yjsState),
        });
    }
    deleteRoom(roomId) {
        this.deleteStatement.run(roomId);
    }
    deleteExpiredRooms(now = Date.now()) {
        const result = this.deleteExpiredStatement.run(now);
        return result.changes;
    }
    close() {
        this.database.close();
    }
}
exports.PersistentRoomStore = PersistentRoomStore;
//# sourceMappingURL=persistentRoomStore.js.map