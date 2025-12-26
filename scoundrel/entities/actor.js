export class Actor {
    constructor(x, y) {
        this.obj = add(this.components(x, y));
    }

    components(x, y) {
        return [
            pos(x, y),
            area(),
        ];
    }

    destroy() {
        destroy(this.obj);
    }
}
