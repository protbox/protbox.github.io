import { Actor } from "./actor.js";

export class Enemy extends Actor {
    components(x, y) {
        return [
            ...super.components(x, y),
            rect(16, 16),
            color(255, 0, 0),
            "enemy",
        ];
    }
}
