export class DebugLogger {
  enabled = true;
  private container: HTMLElement | null = null;
  private readonly maxLines = 500;

  log(message: string): void {
    if (!this.enabled) {
      return;
    }

    const timestamp = this.formatTimestamp(new Date());
    const entry = `[${timestamp}] ${message}`;

    const target = this.getContainer();
    if (!target) {
      console.debug(entry);
      return;
    }

    const line = document.createElement('div');
    line.textContent = entry;
    target.appendChild(line);

    while (target.childElementCount > this.maxLines) {
      target.removeChild(target.firstElementChild as Element);
    }

    target.scrollTop = target.scrollHeight;
  }

  private getContainer(): HTMLElement | null {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    this.container = document.getElementById('debug-log');
    return this.container;
  }

  private formatTimestamp(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
}

export const debugLog = new DebugLogger();
