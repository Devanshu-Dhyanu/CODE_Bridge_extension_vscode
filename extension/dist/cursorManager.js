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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorManager = void 0;
const vscode = __importStar(require("vscode"));
class CursorManager {
    constructor() {
        this.cursors = new Map();
        this.disposables = [];
        this.documentUri = null;
        this.disposables.push(vscode.window.onDidChangeVisibleTextEditors(() => {
            this.renderAll();
        }));
    }
    setDocument(uri) {
        this.documentUri = uri?.toString() ?? null;
        this.renderAll();
    }
    updateCursor(state) {
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
    removeCursor(userId) {
        const existing = this.cursors.get(userId);
        if (!existing) {
            return;
        }
        existing.cursorDecoration.dispose();
        existing.selectionDecoration.dispose();
        this.cursors.delete(userId);
        this.renderAll();
    }
    clearAll() {
        for (const userId of [...this.cursors.keys()]) {
            this.removeCursor(userId);
        }
    }
    dispose() {
        this.clearAll();
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }
    renderAll() {
        for (const editor of vscode.window.visibleTextEditors) {
            const isCollabDocument = this.documentUri !== null &&
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
                editor.setDecorations(remoteCursor.selectionDecoration, selectionRange ? [selectionRange] : []);
            }
        }
    }
    toCursorRange(document, state) {
        if (document.lineCount === 0) {
            return null;
        }
        const safeLine = Math.min(state.cursor.line, document.lineCount - 1);
        const safeCharacter = Math.min(state.cursor.character, document.lineAt(safeLine).text.length);
        const position = new vscode.Position(safeLine, safeCharacter);
        return new vscode.Range(position, position);
    }
    toSelectionRange(document, state) {
        if (!state.selection || document.lineCount === 0) {
            return null;
        }
        const startLine = Math.min(state.selection.start.line, document.lineCount - 1);
        const endLine = Math.min(state.selection.end.line, document.lineCount - 1);
        const start = new vscode.Position(startLine, Math.min(state.selection.start.character, document.lineAt(startLine).text.length));
        const end = new vscode.Position(endLine, Math.min(state.selection.end.character, document.lineAt(endLine).text.length));
        return new vscode.Range(start, end);
    }
}
exports.CursorManager = CursorManager;
//# sourceMappingURL=cursorManager.js.map