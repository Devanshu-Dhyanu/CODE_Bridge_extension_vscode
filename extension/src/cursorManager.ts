import * as vscode from "vscode";
import { CursorBroadcastPayload } from "./types";

interface RemoteCursorDecoration {
  state: CursorBroadcastPayload;
  cursorDecoration: vscode.TextEditorDecorationType;
  selectionDecoration: vscode.TextEditorDecorationType;
}

export class CursorManager {
  private readonly cursors = new Map<string, RemoteCursorDecoration>();
  private readonly disposables: vscode.Disposable[] = [];
  private documentUri: string | null = null;

  constructor() {
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => {
        this.renderAll();
      }),
    );
  }

  setDocument(uri: vscode.Uri | null): void {
    this.documentUri = uri?.toString() ?? null;
    this.renderAll();
  }

  updateCursor(state: CursorBroadcastPayload): void {
    const existing = this.cursors.get(state.userId);
    if (existing) {
      existing.cursorDecoration.dispose();
      existing.selectionDecoration.dispose();
    }

    const cursorDecoration = vscode.window.createTextEditorDecorationType({
      borderColor: state.color,
      borderStyle: "solid",
      borderWidth: "0 0 0 2px",
      after: {
        contentText: ` ${state.userName}`,
        color: state.color,
        fontStyle: "italic",
        margin: "0 0 0 4px",
      },
    });

    const selectionDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: `${state.color}33`,
      borderRadius: "2px",
    });

    this.cursors.set(state.userId, {
      state,
      cursorDecoration,
      selectionDecoration,
    });

    this.renderAll();
  }

  removeCursor(userId: string): void {
    const existing = this.cursors.get(userId);
    if (!existing) {
      return;
    }

    existing.cursorDecoration.dispose();
    existing.selectionDecoration.dispose();
    this.cursors.delete(userId);
    this.renderAll();
  }

  clearAll(): void {
    for (const userId of [...this.cursors.keys()]) {
      this.removeCursor(userId);
    }
  }

  dispose(): void {
    this.clearAll();
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private renderAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const isCollabDocument =
        this.documentUri !== null &&
        editor.document.uri.toString() === this.documentUri;

      for (const remoteCursor of this.cursors.values()) {
        if (!isCollabDocument) {
          editor.setDecorations(remoteCursor.cursorDecoration, []);
          editor.setDecorations(remoteCursor.selectionDecoration, []);
          continue;
        }

        const cursorRange = this.toCursorRange(editor.document, remoteCursor.state);
        const selectionRange = this.toSelectionRange(editor.document, remoteCursor.state);

        editor.setDecorations(remoteCursor.cursorDecoration, cursorRange ? [cursorRange] : []);
        editor.setDecorations(
          remoteCursor.selectionDecoration,
          selectionRange ? [selectionRange] : [],
        );
      }
    }
  }

  private toCursorRange(
    document: vscode.TextDocument,
    state: CursorBroadcastPayload,
  ): vscode.Range | null {
    if (document.lineCount === 0) {
      return null;
    }

    const safeLine = Math.min(state.cursor.line, document.lineCount - 1);
    const safeCharacter = Math.min(
      state.cursor.character,
      document.lineAt(safeLine).text.length,
    );
    const position = new vscode.Position(safeLine, safeCharacter);
    return new vscode.Range(position, position);
  }

  private toSelectionRange(
    document: vscode.TextDocument,
    state: CursorBroadcastPayload,
  ): vscode.Range | null {
    if (!state.selection || document.lineCount === 0) {
      return null;
    }

    const startLine = Math.min(state.selection.start.line, document.lineCount - 1);
    const endLine = Math.min(state.selection.end.line, document.lineCount - 1);
    const start = new vscode.Position(
      startLine,
      Math.min(state.selection.start.character, document.lineAt(startLine).text.length),
    );
    const end = new vscode.Position(
      endLine,
      Math.min(state.selection.end.character, document.lineAt(endLine).text.length),
    );

    return new vscode.Range(start, end);
  }
}
