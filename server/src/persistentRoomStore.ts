import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { ChatMessage, Room, RoomMode } from "./types";

export interface PersistedRoomRecord {
  id: string;
  mode: RoomMode;
  document: {
    name: string;
    languageId: string;
    code: string;
  };
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  yjsState: Uint8Array;
}

export class PersistentRoomStore {
  private readonly database: Database.Database;
  private readonly deleteExpiredStatement: Database.Statement<[number]>;
  private readonly deleteStatement: Database.Statement<[string]>;
  private readonly loadStatement: Database.Statement<[number]>;
  private readonly saveStatement: Database.Statement<{
    id: string;
    mode: RoomMode;
    documentName: string;
    languageId: string;
    documentCode: string;
    messagesJson: string;
    createdAt: number;
    updatedAt: number;
    expiresAt: number;
    yjsState: Buffer;
  }>;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    this.database = new Database(dbPath);
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
    this.deleteExpiredStatement = this.database.prepare(
      "DELETE FROM rooms WHERE expires_at <= ?",
    );
  }

  loadRooms(now = Date.now()): PersistedRoomRecord[] {
    const rows = this.loadStatement.all(now) as Array<{
      id: string;
      mode: RoomMode;
      document_name: string;
      language_id: string;
      document_code: string;
      messages_json: string;
      created_at: number;
      updated_at: number;
      expires_at: number;
      yjs_state: Buffer;
    }>;

    const records: PersistedRoomRecord[] = [];
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
          messages: JSON.parse(row.messages_json) as ChatMessage[],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          expiresAt: row.expires_at,
          yjsState: Uint8Array.from(row.yjs_state),
        });
      } catch {
        continue;
      }
    }

    return records;
  }

  saveRoom(room: Room, yjsState: Uint8Array): void {
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

  deleteRoom(roomId: string): void {
    this.deleteStatement.run(roomId);
  }

  deleteExpiredRooms(now = Date.now()): number {
    const result = this.deleteExpiredStatement.run(now);
    return result.changes;
  }

  close(): void {
    this.database.close();
  }
}
