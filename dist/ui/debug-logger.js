export class DebugLogger {
    constructor() {
        this.enabled = true;
        this.container = null;
        this.maxLines = 500;
    }
    log(message) {
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
            target.removeChild(target.firstElementChild);
        }
        target.scrollTop = target.scrollHeight;
    }
    getContainer() {
        if (this.container && document.body.contains(this.container)) {
            return this.container;
        }
        this.container = document.getElementById('debug-log');
        return this.container;
    }
    formatTimestamp(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
}
export const debugLog = new DebugLogger();
//# sourceMappingURL=debug-logger.js.map