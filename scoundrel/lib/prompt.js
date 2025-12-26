export class Prompt {
    constructor(message, options, onChoice) {
        this.done = false;
        this.choice = null;

        const w = 220;
        const h = 60;
        const x = width() / 2;
        const y = height() / 2;

        this.bg = add([
            rect(w, h),
            pos(x, y),
            anchor("center"),
            color(0, 0, 0),
            opacity(0.8),
            outline(2, rgb(255, 255, 255)),
            z(2000),
        ]);

        this.text = add([
            text(message),
            pos(x, y - 10),
            anchor("center"),
            z(2001),
        ]);

        this.opts = options.map((opt, i) => {
            return add([
                text(opt.label),
                pos(x + (i === 0 ? -40 : 40), y + 15),
                anchor("center"),
                z(2001),
            ]);
        });

        options.forEach((opt, i) => {
            onKeyPress(opt.key, () => {
                if (this.done) return;
                this.done = true;
                this.destroy();
                onChoice(opt.value);
            });
        });
    }

    destroy() {
        destroy(this.bg);
        destroy(this.text);
        this.opts.forEach(o => destroy(o));
    }
}
