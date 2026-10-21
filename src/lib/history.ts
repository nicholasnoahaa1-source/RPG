export interface Command {
  label: string;
  undo(): void;
  redo(): void;
}

/** Pilha de desfazer/refazer. Independente de React e de Three. */
export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private listeners = new Set<() => void>();

  constructor(private readonly limit = 200) {}

  push(cmd: Command) {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
  }

  undo(): Command | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo();
    this.redoStack.push(cmd);
    this.emit();
    return cmd;
  }

  redo(): Command | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.redo();
    this.undoStack.push(cmd);
    this.emit();
    return cmd;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get undoLabel() {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }
  get redoLabel() {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}
