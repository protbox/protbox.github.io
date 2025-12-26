import { BaseScene } from "./scene.js";
import { Card, SUITS } from "../entities/card.js";
import { ListPrompt } from "../lib/list_prompt.js";

let opts = {
    theme: "DEFAULT",
    roomStart: { x: 50, y: 41 }, // top left of first room card on board
    roomPad: 4, // space between each room card
    wpnCard: {
        x: 82,
        y: 103,
        card: null // reference to card object
    },
    deck: {
        x: 270,
        y: 12
    },
    item: {
        x: 138,
        y: 103,
        card: null
    },
    cardSize: { x: 36, y: 44 }
}

function irand(min, max) {
    return Math.floor(rand(min, max + 1));
}

function isValidRoomCard(rank, suit) {
    const isRed = suit === SUITS.hearts || suit === SUITS.diamonds;
    const isFace = rank >= 10; // J=10, Q=11, K=12
    const isAce = rank === 0;

    if (isRed && (isFace || isAce)) return false;
    return true;
}

function randomRoomCard() {
    let rank, suit;
    do {
        rank = irand(0, 12);
        suit = irand(0, 3);
    } while (!isValidRoomCard(rank, suit));
    return { rank, suit };
}

export class GameScene extends BaseScene {
    init() {
        this.health = 20;
        this.rooms = [];
        this.weaponCard = null;
        this.usedPotion = false;
        this.canFlee = true;     // can’t flee twice in a row
        this.movedThisTurn = false;

        this.dungeon = this.buildDungeon();
        this.deckCount = this.dungeon.length;

        this.deckCard = new Card(
            0, 0,
            opts.deck.x + opts.cardSize.x / 2, opts.deck.y + opts.cardSize.y / 2,
            false);

        this.deckCard.obj.z = 5;

        this.deckText = add([
            text(this.dungeon.length),
            pos(opts.deck.x + 10, opts.deck.y - 10),
            z(6),
        ]);

        add([
            sprite("dungeon_" + opts.theme),
            pos(0, 0),
        ]);

        this.healthText = add([
            text(this.health),
            pos(284, 59)
        ])

        add([
            sprite("heart"),
            pos(274, 60)
        ]);

        this.fleeBtn = add([
            rect(60, 16),
            pos(10, 16),
            area(),
            color(60, 60, 60),
            z(20),
        ]);

        this.fleeText = add([
            text("FLEE"),
            pos(40, 24),
            anchor("center"),
            z(21),
        ]);

        this.fleeBtn.onClick(() => this.tryFlee());

        this.nextBtn = add([
            rect(90, 16),
            pos(80, 16),
            area(),
            color(60, 60, 60),
            z(20),
        ]);

        this.nextText = add([
            text("NEXT ROOM"),
            pos(125, 24),
            anchor("center"),
            z(21),
        ]);

        this.nextBtn.onClick(() => this.onNextRoom());
        this.hideNextRoom();

        this.rooms = [];
        this.startNextRoom();
    }

    getEmptyRoomSlots() {
        const used = new Set(this.rooms.map(c => c.slotIndex));
        const slots = [];
        for (let i = 0; i < 4; i++) {
            if (!used.has(i)) slots.push(i);
        }
        return slots;
    }

    roomSlotPos(slot) {
        const x = opts.roomStart.x + slot * (opts.cardSize.x + opts.roomPad);
        const y = opts.roomStart.y;
        return { x, y };
    }

    spawnItem(type) {
        if (opts.item.card) {
            this.discardCard(opts.item.card);
            opts.item.card = null;
        }

        let frame;

        if (type === "fairy") frame = 26;
        if (type === "shield") frame = 53;

        const card = new Card(0, 0, opts.deck.x, opts.deck.y, true);
        card.obj.frame = frame;
        card.type = type;

        const [x, y] = card.getRealPos(opts.item.x, opts.item.y);

        card.bringToFront();
        card.moveTo(x, y, 0.3);

        opts.item.card = card;
    }

    drawIntoRoom(n) {
        const slots = this.getEmptyRoomSlots();
        const count = Math.min(n, slots.length);

        for (let i = 0; i < count; i++) {
            const data = this.dungeon.shift();
            if (!data) {
                this.winGame();
                return;
            }

            const slot = slots[i];
            const card = new Card(
                data.rank,
                data.suit,
                opts.deck.x,
                opts.deck.y,
                false
            );

            card.slotIndex = slot;
            card.onClick(c => this.onRoomCardSelected(c));

            this.rooms.push(card);

            const { x, y } = this.roomSlotPos(slot);
            const [rx, ry] = card.getRealPos(x, y);

            wait(i * 0.2, () => {
                card.bringToFront();
                card.moveTo(rx, ry, 0.3);
                wait(0.3, () => card.flip());
            });
        }

        this.updateDeckText();
    }

    onNextRoom() {
        if (this.rooms.length !== 1) return;

        this.hideNextRoom();
        this.canFlee = true;
        this.movedThisTurn = false;
        this.usedPotion = false;

        // keep the last card, draw 3 more
        this.drawIntoRoom(3);
    }

    updateFleeButton() {
        const enabled = this.canFlee && !this.movedThisTurn;
        this.fleeBtn.color = enabled ? rgb(60,60,60) : rgb(30,30,30);
        this.fleeText.color = enabled ? rgb(255,255,255) : rgb(120,120,120);
    }

    updateDeckText() {
        this.deckText.text = this.dungeon.length;
    }

    tryFlee() {
        if (!this.canFlee || this.movedThisTurn) return;

        this.canFlee = false;
        this.movedThisTurn = true;

        for (const card of this.rooms) {
            this.dungeon.push({ rank: card.rank, suit: card.suit });
            this.returnToDeck(card);
        }

        this.rooms = [];
        this.updateDeckText();
        this.hideNextRoom();

        wait(0.5, () => this.startNextRoom());
    }

    showNextRoom() {
        play("door_unlocked")
        this.nextBtn.hidden = false;
        this.nextText.hidden = false;
    }

    hideNextRoom() {
        this.nextBtn.hidden = true;
        this.nextText.hidden = true;
    }

    buildDungeon() {
        const deck = [];

        for (let suit = 0; suit < 4; suit++) {
            for (let rank = 0; rank < 13; rank++) {
                const isRed = suit === SUITS.hearts || suit === SUITS.diamonds;
                const isFace = rank >= 10; // J,Q,K
                const isAce = rank === 0;

                // remove red face cards & red aces
                if (isRed && (isFace || isAce)) continue;

                deck.push({ rank, suit });
            }
        }

        // shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(rand(0, i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        return deck;
    }

    resolveAndAdvance(card, actionFn) {
        // perform effect
        actionFn();

        // now officially consume the card
        this.rooms = this.rooms.filter(c => c !== card);

        this.movedThisTurn = true;
        this.updateFleeButton();

        if (this.rooms.length === 1) {
            this.showNextRoom();
            return;
        }

        if (this.rooms.length === 0) {
            this.hideNextRoom();
            wait(0.4, () => this.startNextRoom());
        }
    }

    startNextRoom() {
        this.usedPotion = false;
        this.movedThisTurn = false;
        this.canFlee = true;

        this.hideNextRoom();
        this.rooms = [];

        this.drawIntoRoom(4);
        this.updateFleeButton();
    }

    dealRooms() {
        this.rooms = [];
        this.usedPotion = false;
        this.movedThisTurn = false;

        const start = opts.roomStart;

        for (let i = 0; i < 4; i++) {
            const data = this.dungeon.shift();
            if (!data) return;

            const card = new Card(
                data.rank,
                data.suit,
                opts.deck.x,
                opts.deck.y,
                false
            );

            this.rooms.push(card);
            card.onClick(c => this.onRoomCardSelected(c));

            const x = start.x + i * (opts.cardSize.x + opts.roomPad);
            const y = start.y;
            const [rx, ry] = card.getRealPos(x, y);

            wait(i * 0.2, () => {
                card.bringToFront();
                card.moveTo(rx, ry, 0.3);
                wait(0.3, () => card.flip());
            });
        }

        this.updateDeckText();
    }

    onRoomCardSelected(card) {
        if (!this.rooms.includes(card)) return;

        // Weapon
        if (card.suit === SUITS.diamonds) {
            this.resolveAndAdvance(card, () => this.takeWeapon(card));
        }
        // Potion
        else if (card.suit === SUITS.hearts) {
            this.resolveAndAdvance(card, () => this.takePotion(card));
        }
        // Monster
        else {
            if (this.weaponCard) {
                new ListPrompt(
                    "Fight Monster",
                    [
                        { label: "Use Weapon", value: "weapon" },
                        { label: "Bare Hands", value: "hand" },
                    ],
                    choice => {
                        this.resolveAndAdvance(card, () =>
                            this.resolveMonster(card, choice)
                        );
                    },
                    () => {
                        // do nuthin
                    }
                );
            } else {
                this.resolveAndAdvance(card, () =>
                    this.resolveMonster(card, "hand")
                );
            }
        }
    }

    winGame() {
        console.log("You cleared the dungeon!");
        // TODO: do cool shit
    }

    takeMonster(card) {
        if (this.weaponCard) {
            new ListPrompt(
                "Fight Monster",
                [
                    { label: "Use Weapon", value: "weapon" },
                    { label: "Bare Hands", value: "hand" },
                ],
                choice => this.resolveMonster(card, choice),
                () => {
                    // cancelled: do nada
                }
            );
        } else {
            this.resolveMonster(card, "hand");
        }
    }

    applyDamage(dmg) {
        if (dmg <= 0) return;

        // shield absorbs first
        if (opts.item.card && opts.item.card.type === "shield") {
            console.log("Shield absorbed damage!");
            this.discardCard(opts.item.card);
            opts.item.card = null;
            return;
        }

        this.health -= dmg;

        // fairy will bring you back to life with 10HP
        if (this.health <= 0 && opts.item.card && opts.item.card.type === "fairy") {
            console.log("Fairy saved you!");
            this.health = 10;
            this.discardCard(opts.item.card);
            opts.item.card = null;
        }

        if (this.health < 0) this.health = 0;
    }

    resolveMonster(card, mode) {
        const mVal = this.monsterValue(card);

        let dmg = 0;

        if (mode === "hand" || !this.weaponCard) {
            dmg = mVal;
            console.log("Barehand fight:", dmg);
            shake(3) // TODO: higher shake the more damage you take
        } else {
            const wVal = this.cardValue(this.weaponCard);
            const last = this.weaponCard.lastSlain ?? Infinity;

            if (mVal <= last) {
                dmg = Math.max(0, mVal - wVal);
                const newVal = this.monsterValue(card);

                this.weaponCard.rank =
                    newVal === 14 ? 0 : newVal - 1;

                this.weaponCard.lastSlain = newVal;
                this.weaponCard.obj.frame = this.weaponCard.frameIndex();

                // let 'em know it changed!
                this.weaponCard.bringToFront();
                this.weaponCard.flip(0.1);
                wait(0.1, () => this.weaponCard.flip(0.1));
            } else {
                shake(3);
                // forced barehand
                dmg = mVal;
                console.log("Weapon too weak, barehand:", dmg);
            }
        }

        this.applyDamage(dmg);

        if (this.health < 0) {
            this.health = 0;
        } else {
            play("enemy_hit")
            if (mVal === 14) {
                const type = rand() < 0.5 ? "fairy" : "shield";
                this.spawnItem(type);
            }
        }

        this.healthText.text = this.health;

        this.discardCard(card);

        if (this.health <= 0) {
            console.log("Game Over");
            // TODO: end game
        }
    }

    takeWeapon(card) {
        if (this.weaponCard) {
            this.discardCard(this.weaponCard);
        }

        this.weaponCard = card;
        this.weaponCard.lastSlain = Infinity;

        const [x, y] = card.getRealPos(opts.wpnCard.x, opts.wpnCard.y);
        card.moveTo(x, y, 0.25);
        play("new_weapon");
    }

    takePotion(card) {
        if (!this.usedPotion) {
            play("heal")
            this.health = Math.min(20, this.health + this.cardValue(card));
            this.usedPotion = true;
            this.healthText.text = this.health;
            console.log("Healed to", this.health);

            // remove fairy from inventory if it exists
            if (opts.item.card && opts.item.card.type === "fairy") {
                console.log("Fairy consumed by potion use");
                this.discardCard(opts.item.card);
                opts.item.card = null;
            }
        }

        this.discardCard(card);
    }

    endTurn() {
        this.canFlee = true;

        // keep last room card as first of next room
        const keep = this.rooms[0];
        this.rooms = keep ? [keep] : [];

        wait(0.4, () => this.nextTurn());
    }

    nextTurn() {
        if (this.dungeon.length === 0) {
            console.log("You win!");
            return;
        }

        this.startNextRoom();
        this.updateFleeButton();
    }

    returnToDeck(card) {
        card.bringToFront();

        const [x, y] = card.getRealPos(
            opts.deck.x,
            opts.deck.y
        );

        if (card.faceUp) {
            card.flip();
        }

        card.moveTo(x, y, 0.3);
    }

    discardCard(card) {
        const [x, y] = card.getRealPos(
            opts.deck.x,
            opts.deck.y + 90
        );

        if (card.faceUp) {
            card.flip();
        }
        card.moveTo(x, y, 0.25);
    }

    cardValue(card) {
        const r = card.rank;
        if (r === 0) return 1;      // Ace default
        if (r >= 10) return r + 1; // J=11, Q=12, K=13
        return r + 1;
    }

    monsterValue(card) {
        if (card.rank === 0) return 14;
        if (card.rank >= 10) return card.rank + 1;
        return card.rank + 1;
    }

    bindKeys() {}
}

