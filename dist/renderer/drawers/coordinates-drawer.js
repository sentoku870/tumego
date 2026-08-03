export class CoordinatesDrawer {
    constructor(factory) {
        this.factory = factory;
    }
    draw(labels) {
        labels.forEach(label => {
            const text = this.factory.append('text', {
                x: label.x.toString(),
                y: label.y.toString(),
                class: label.className,
                'font-size': label.fontSize.toString()
            });
            text.textContent = label.text;
        });
    }
}
//# sourceMappingURL=coordinates-drawer.js.map