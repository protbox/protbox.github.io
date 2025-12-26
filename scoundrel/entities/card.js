export const SUITS = {
    clubs: 0,
    spades: 1,
    hearts: 2,
    diamonds: 3,
};

const BACK_ROW = 4;
const COLS = 13;
const cardWidth = 36;
const cardHeight = 44;

export class Card {
    constructor(rank, suit, x, y) {
        this.rank = rank; // 0..12 (A..K)
        this.suit = suit; // from SUITS

        this.obj = add([
            sprite("cards", {
                frame: this.frameIndex(),
            }),
            pos(x, y),
            anchor("center"),
            area(),
            scale(1),
            "card",
        ]);
    }

    frameIndex() {
        if (!this.faceUp) {
            return BACK_ROW * COLS; // = 52
        }
        return this.suit * COLS + this.rank;
    }

    set(rank, suit) {
        this.rank = rank;
        this.suit = suit;
        this.obj.frame = this.frameIndex();
    }
    
    getRealPos(x, y) {
        return [x + cardWidth / 2, y + cardHeight / 2]; 
    }

    bringToFront() {
        this.obj.z = 1000;
    }

    sendToBack(z = 0) {
        this.obj.z = z;
    }

    moveTo(x, y, time = 0.3, ease = easings.easeOutQuad, topZ = 1000) {
        const startZ = this.obj.z ?? 0;
        this.obj.z = topZ;

        const p = vec2(this.obj.pos.x, this.obj.pos.y);

        tween(
            p,
            vec2(x, y),
            time,
            v => {
                this.obj.pos.x = v.x;
                this.obj.pos.y = v.y;
            },
            ease
        );

        wait(time, () => {
            this.obj.z = startZ;
            //play("card_place")
        });
    }

    flip(time = 0.15) {
        const half = time;

        const s = vec2(1, 0)

        tween(
            s,
            vec2(0, 0),
            half,
            p => {
                this.obj.scale.x = p.x;
            },
            easings.easeInQuad
        );

        play("card_move")

        wait(half, () => {
            this.faceUp = !this.faceUp;
            this.obj.frame = this.frameIndex();

            tween(
                s,
                vec2(1, 0),
                half,
                p => {
                    this.obj.scale.x = p.x;
                },
                easings.easeOutQuad
            );
        });
    }

    onClick(fn) {
        this.obj.onClick(() => fn(this));
    }

    destroy() {
        destroy(this.obj);
    }
}
