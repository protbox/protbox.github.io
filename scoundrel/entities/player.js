import { Actor } from "./actor.js";

export class Player extends Actor {
    components(x, y) {
        return [
            ...super.components(x, y),
            rect(16, 16),
            body(),
            "player",
        ];
    }

    constructor(x, y) {
        super(x, y);

        this.obj.onUpdate(() => {
            if (isKeyDown("left")) this.obj.move(-120, 0);
            if (isKeyDown("right")) this.obj.move(120, 0);
        });
    }
}
