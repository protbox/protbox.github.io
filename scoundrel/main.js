kaplay({
    width: 320,
    height: 180,
    background: "#000000",
    scale: 4,
    crisp: true, // disable anti-aliasing for pixel art
    canvas: document.getElementById("canvas"),
});

// main font
loadFont("nes", "fonts/nes.otf")

// load cards and slice them
loadSprite("cards", "img/cards.png", {
    sliceX: 13,
    sliceY: 5,
});

loadSprite("heart", "img/heart.png")

// load dungeon sprites
loadSprite("dungeon_DEFAULT", "img/dungeons/default.png");

//load sounds
loadSound("card_move", "sfx/card_move.wav");
loadSound("card_place", "sfx/card_place.wav");
loadSound("enemy_hit", "sfx/enemy_hit.wav");
loadSound("new_weapon", "sfx/new_weapon.wav");
loadSound("door_unlocked", "sfx/door_unlocked.wav");
loadSound("heal", "sfx/heal.wav");

// monkey patch text() so we can provide a default font
// ideally kaplay would allow us to do this without patching ffs
const _text = text;

window.text = (str, opts = {}) => {
    return _text(str, {
        font: "nes",
        size: 8,
        ...opts,
    });
};

import { GameScene } from "./scenes/game.js";

scene("game", () => {
    new GameScene().start();
});

go("game")