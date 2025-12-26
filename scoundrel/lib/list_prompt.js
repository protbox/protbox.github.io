export class ListPrompt {
    constructor(title, items, onConfirm, onCancel) {
        this.items = items;
        this.index = 0;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        const w = 200;
        const h = 20 + items.length * 14;
        const x = width() / 2;
        const y = height() / 2;

        this.bg = add([
            rect(w, h),
            pos(x, y),
            anchor("center"),
            color(0, 0, 0),
            opacity(0.85),
            outline(2, rgb(255, 255, 255)),
            z(2000),
        ]);

        this.title = add([
            text(title.toUpperCase()),
            pos(x, y - h / 2 + 10),
            anchor("center"),
            z(2001),
        ]);

        this.labels = items.map((it, i) => {
            const label = add([
                text(it.label.toUpperCase()),
                pos(x - w / 2 + 10, y - h / 2 + 24 + i * 14),
                anchor("left"),
                area(),
                z(2001),
            ]);

            label.onHover(() => {
                this.index = i;
                this.updateCursor();
            });

            label.onClick(() => {
                this.destroy();
                this.onConfirm(this.items[i].value);
            });

            return label;
        });

        const leftX = x - w / 2 + 2;

        this.cursor = add([
            rect(w - 4, 12),
            pos(leftX, y - h / 2 + 24),
            anchor("left"),
            color(80, 80, 80),
            opacity(0.5),
            z(2000),
        ]);

        this.updateCursor();
        this.bindKeys();
    }

    bindKeys() {
        this.kUp = onKeyPress("up", () => this.move(-1));
        this.kDown = onKeyPress("down", () => this.move(1));

        this.kOk = onKeyPress("z", () => {
            this.destroy();
            this.onConfirm(this.items[this.index].value);
        });

        this.kCancel = onKeyPress("x", () => {
            this.destroy();
            if (this.onCancel) this.onCancel();
        });
    }

    move(dir) {
        this.index = (this.index + dir + this.items.length) % this.items.length;
        this.updateCursor();
    }

    updateCursor() {
        const y = this.labels[this.index].pos.y;
        this.cursor.pos.y = y - 1;
    }

    destroy() {
        destroy(this.bg);
        destroy(this.title);
        destroy(this.cursor);
        this.labels.forEach(l => destroy(l));
        this.kUp.cancel();
        this.kDown.cancel();
        this.kOk.cancel();
        this.kCancel.cancel();
    }
}