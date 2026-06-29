const CONFIG = {
    startingHealth: 20,
    totalEncounters: 10,
    weaponUpgradeGain: 1,
    stepDelay: 1000,
    rollDelay: 1200,
    attackDelay: 650,
    dropChances: {
        loot: 0.5,
        potion: 0.25,
        upgrade: 0.25
    },
    lootRange: {
        min: 5,
        max: 25
    },
    attunementRange: {
        min: 1,
        max: 5
    },
    potionRange: {
        min: 3,
        max: 6
    },
    classBonuses: {
        warriorDefense: 1,
        paladinHealing: 2,
        mageWeaponHone: 1,
        hunterEvadeChance: 0.2
    },
    enemyDamageVariance: 3,
    ambushChance: 0.25,
    daily: {
        enabled: true,
        storageKey: "idlerpgdle-last-played",
        salt: "idlerpgdle-v1"
    },
    audio: {
        enabled: true,
        volume: 0.5,
        path: "sfx/"
    }
};

const SOUNDS = {
    begin: "begin.mp3",
    attackMelee: "attack_melee.wav",
    attackBow: "attack_bow.wav",
    monsterAttack: "hurt.wav",
    enemyDefeat: "enemy_defeat.mp3",
    health: "potion.wav",
    hone: "hone.wav",
    coin: "coin.mp3",
    win: "win.wav",
    lose: "lose.wav",
    click: "click.wav"
};

const CLASSES = [
    { name: "Warrior", icon: "🛡️", baseDamage: 4, baseHealthBonus: 6, perk: "defense", perkText: "+1 defense" },
    { name: "Mage", icon: "🔮", baseDamage: 6, baseHealthBonus: 0, perk: "hone", perkText: "+1 weapon hone" },
    { name: "Paladin", icon: "✨", baseDamage: 3, baseHealthBonus: 8, perk: "healing", perkText: "+2 healing" },
    { name: "Hunter", icon: "🏹", baseDamage: 5, baseHealthBonus: 2, perk: "evade", perkText: "chance to evade" }
];

const WEAPONS = [
    { name: "Rusted Sword", icon: "🗡️", damage: 2, ranged: false },
    { name: "Oak Staff", icon: "🪄", damage: 2, ranged: false },
    { name: "Hunting Bow", icon: "🏹", damage: 3, ranged: true },
    { name: "War Hammer", icon: "🔨", damage: 4, ranged: false },
    { name: "Twin Daggers", icon: "🔪", damage: 3, ranged: false },
    { name: "Holy Mace", icon: "⚜️", damage: 3, ranged: false }
];

const CLASS_WEAPON_AFFINITY = {
    Warrior: ["War Hammer", "Rusted Sword"],
    Mage: ["Oak Staff", "Holy Mace"],
    Paladin: ["Holy Mace", "War Hammer"],
    Hunter: ["Hunting Bow", "Twin Daggers"]
};

const ENEMIES = [
    { name: "Spider", icon: "🕷️", health: 5, damage: 2, lootMultiplier: 1.0, killScore: 10 },
    { name: "Goblin", icon: "👺", health: 7, damage: 3, lootMultiplier: 1.2, killScore: 18 },
    { name: "Bandit", icon: "🥷", health: 10, damage: 4, lootMultiplier: 1.5, killScore: 28 },
    { name: "Skeleton", icon: "💀", health: 12, damage: 4, lootMultiplier: 1.6, killScore: 34 },
    { name: "Ogre", icon: "👹", health: 18, damage: 6, lootMultiplier: 2.2, killScore: 55 }
];

const state = {
    running: false,
    health: 0,
    maxHealth: 0,
    damage: 0,
    score: 0,
    gold: 0,
    encounter: 0,
    completed: 0,
    survived: false,
    seed: "-",
    weapon: null,
    weaponDamage: 0,
    playerClass: null
};

const el = {
    seed: document.getElementById("seedValue"),
    heroGlyph: document.getElementById("heroGlyph"),
    heroStatus: document.getElementById("heroStatus"),
    heroSub: document.getElementById("heroSub"),
    health: document.getElementById("statHealth"),
    damage: document.getElementById("statDamage"),
    score: document.getElementById("statScore"),
    gold: document.getElementById("statGold"),
    encounter: document.getElementById("statEncounter"),
    log: document.getElementById("log"),
    logPulse: document.getElementById("logPulse"),
    beginBtn: document.getElementById("beginBtn"),
    resetBtn: document.getElementById("resetBtn"),
    shareBtn: document.getElementById("shareBtn"),
    charPortrait: document.getElementById("charPortrait"),
    charName: document.getElementById("charName"),
    charTitle: document.getElementById("charTitle"),
    charClassIcon: document.getElementById("charClassIcon"),
    charClass: document.getElementById("charClass"),
    charClassMeta: document.getElementById("charClassMeta"),
    charWeaponIcon: document.getElementById("charWeaponIcon"),
    charWeapon: document.getElementById("charWeapon"),
    charWeaponMeta: document.getElementById("charWeaponMeta"),
    charAffinity: document.getElementById("charAffinity"),
    charAffinityValue: document.getElementById("charAffinityValue")
};

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const audioCache = {};

function preloadSounds() {
    if (!CONFIG.audio.enabled) return;
    Object.keys(SOUNDS).forEach(key => {
        const audio = new Audio(CONFIG.audio.path + SOUNDS[key]);
        audio.preload = "auto";
        audio.volume = CONFIG.audio.volume;
        audioCache[key] = audio;
    });
}

function playSound(key) {
    if (!CONFIG.audio.enabled) return;
    const base = audioCache[key];
    if (!base) return;
    const node = base.cloneNode();
    node.volume = CONFIG.audio.volume;
    const result = node.play();
    if (result && typeof result.catch === "function") {
        result.catch(() => {});
    }
}

let rng = Math.random;

function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function makeSeed() {
    let seed = "";
    for (let i = 0; i < 6; i++) {
        seed += Math.floor(Math.random() * 36).toString(36).toUpperCase();
    }
    return seed;
}

function seedRng(seedString) {
    rng = mulberry32(hashString(CONFIG.daily.salt + seedString));
}

function pick(list) {
    return list[Math.floor(rng() * list.length)];
}

function rollBetween(min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function flashStat(node) {
    const stat = node.closest(".stat");
    stat.classList.add("flash");
    setTimeout(() => stat.classList.remove("flash"), 350);
}

function setHealth(value) {
    state.health = Math.max(0, value);
    el.health.textContent = `${state.health}/${state.maxHealth}`;
    flashStat(el.health);
}

function setDamage(value) {
    state.damage = value;
    el.damage.textContent = state.damage;
    flashStat(el.damage);
}

function setScore(value) {
    state.score = value;
    el.score.textContent = state.score;
    flashStat(el.score);
}

function setGold(value) {
    state.gold = value;
    el.gold.textContent = state.gold;
    flashStat(el.gold);
}

function setEncounter(value) {
    state.encounter = value;
    el.encounter.textContent = `${state.encounter}/${CONFIG.totalEncounters}`;
    flashStat(el.encounter);
}

function setHero(glyph, status, sub) {
    el.heroGlyph.textContent = glyph;
    el.heroStatus.textContent = status;
    el.heroSub.textContent = sub;
}

function flashCard(node) {
    node.classList.add("flash");
    setTimeout(() => node.classList.remove("flash"), 400);
}

function setPanelClass() {
    el.charPortrait.textContent = state.playerClass.icon;
    el.charPortrait.classList.remove("summoned");
    void el.charPortrait.offsetWidth;
    el.charPortrait.classList.add("summoned");
    el.charName.textContent = state.playerClass.name;
    el.charTitle.textContent = "summoned by the dice";
    el.charClassIcon.textContent = state.playerClass.icon;
    el.charClass.textContent = state.playerClass.name;
    el.charClassMeta.textContent = `+${state.playerClass.baseDamage} base damage`;
    flashCard(el.charClassIcon.closest(".char-card"));
}

function setPanelWeapon() {
    el.charWeaponIcon.textContent = state.weapon.icon;
    el.charWeapon.textContent = state.weapon.name;
    el.charWeaponMeta.textContent = `+${state.weaponDamage} damage`;
    flashCard(el.charWeaponIcon.closest(".char-card"));
}

function setPanelAffinity(text) {
    el.charAffinity.hidden = false;
    el.charAffinityValue.textContent = text;
}

function resetPanel() {
    el.charPortrait.textContent = "❔";
    el.charPortrait.classList.remove("summoned");
    el.charName.textContent = "Unknown";
    el.charTitle.textContent = "awaiting the roll";
    el.charClassIcon.textContent = "🎭";
    el.charClass.textContent = "-";
    el.charClassMeta.textContent = "";
    el.charWeaponIcon.textContent = "🗡️";
    el.charWeapon.textContent = "-";
    el.charWeaponMeta.textContent = "";
    el.charAffinity.hidden = false;
    el.charAffinityValue.textContent = "None";
}

function logEntry(icon, html, variant) {
    const li = document.createElement("li");
    li.className = "entry" + (variant ? ` ${variant}` : "");
    li.innerHTML = `<span class="entry-icon">${icon}</span><span class="entry-text">${html}</span>`;
    el.log.appendChild(li);
    el.log.scrollTop = el.log.scrollHeight;
}

function rollDrop() {
    const roll = rng();
    if (roll < CONFIG.dropChances.loot) return "loot";
    if (roll < CONFIG.dropChances.loot + CONFIG.dropChances.potion) return "potion";
    return "upgrade";
}

async function rollFate() {
    el.logPulse.classList.add("live");

    setHero("🎴", "Reading the cards of fate", "The dungeon decides who you are");
    await wait(CONFIG.rollDelay);

    state.playerClass = pick(CLASSES);
    state.maxHealth = CONFIG.startingHealth + state.playerClass.baseHealthBonus;
    setHealth(state.maxHealth);
    setPanelClass();
    setHero(state.playerClass.icon, `You are a ${state.playerClass.name}`, "A class is chosen by the dice");
    logEntry(state.playerClass.icon, `Fate names you a <b>${state.playerClass.name}</b> (${state.playerClass.perkText}).`, "fate");
    await wait(CONFIG.rollDelay);

    state.weapon = pick(WEAPONS);
    const hone = state.playerClass.perk === "hone" ? CONFIG.classBonuses.mageWeaponHone : 0;
    state.weaponDamage = state.weapon.damage + hone;
    const suited = CLASS_WEAPON_AFFINITY[state.playerClass.name].includes(state.weapon.name);
    const attunementBonus = suited ? rollBetween(CONFIG.attunementRange.min, CONFIG.attunementRange.max) : 0;
    setDamage(state.playerClass.baseDamage + state.weaponDamage + attunementBonus);
    setPanelWeapon();
    setPanelAffinity(suited ? `Attuned 🔥 +${attunementBonus}` : "None");
    setHero(state.weapon.icon, `You wield the ${state.weapon.name}`, `${state.damage} total damage to start`);
    logEntry(state.weapon.icon, `You draw the <b>${state.weapon.name}</b> (+${state.weapon.damage} damage).`, "fate");
    if (hone) {
        logEntry("🔮", `Your arcane focus hones the blade: <b>+${hone}</b> damage.`, "fate");
    }
    if (suited) {
        logEntry("🔥", `It resonates with your ${state.playerClass.name} soul: <b>+${attunementBonus}</b> attunement damage.`, "fate");
    }
    await wait(CONFIG.rollDelay);
}

function playPlayerAttack() {
    playSound(state.weapon && state.weapon.ranged ? "attackBow" : "attackMelee");
}

async function enemyAttack(enemy, context) {
    const evadeRoll = rng();
    const evaded = state.playerClass.perk === "evade" && evadeRoll < CONFIG.classBonuses.hunterEvadeChance;
    if (evaded) {
        logEntry("💨", `You roll aside and <b>evade</b> the ${enemy.name}'s ${context}.`, "heal");
        return;
    }
    const rolled = rollBetween(enemy.damage, enemy.damage + CONFIG.enemyDamageVariance);
    const incoming = state.playerClass.perk === "defense"
        ? Math.max(1, rolled - CONFIG.classBonuses.warriorDefense)
        : rolled;
    setHealth(state.health - incoming);
    logEntry("🩸", `The ${enemy.name} ${context} for <b>${incoming}</b>.`, "hit");
    playSound("monsterAttack");
}

async function fightEnemy(enemy) {
    let enemyHealth = enemy.health;
    setHero(enemy.icon, `A ${enemy.name} appears`, `${enemyHealth} health · ${enemy.damage}-${enemy.damage + CONFIG.enemyDamageVariance} damage`);
    logEntry(enemy.icon, `A <b>${enemy.name}</b> blocks your path.`);
    await wait(CONFIG.stepDelay);

    if (rng() < CONFIG.ambushChance) {
        logEntry("⚡", `The <b>${enemy.name}</b> ambushes you and strikes first!`, "hit");
        await wait(CONFIG.attackDelay);
        await enemyAttack(enemy, "ambush");
        await wait(CONFIG.attackDelay);
        if (state.health <= 0) return false;
    }

    while (enemyHealth > 0 && state.health > 0) {
        enemyHealth -= state.damage;
        if (enemyHealth > 0) {
            logEntry("⚔️", `You strike for <b>${state.damage}</b>. The ${enemy.name} has ${enemyHealth} left.`);
            playPlayerAttack();
            await wait(CONFIG.attackDelay);
            await enemyAttack(enemy, "bites back");
            await wait(CONFIG.attackDelay);
        } else {
            setScore(state.score + enemy.killScore);
            logEntry("💥", `You strike for <b>${state.damage}</b>. The ${enemy.name} falls! <b>+${enemy.killScore}</b> score.`);
            playPlayerAttack();
            playSound("enemyDefeat");
            await wait(CONFIG.stepDelay);
        }
    }

    return state.health > 0;
}

async function awardDrop(enemy) {
    const drop = rollDrop();

    if (drop === "loot") {
        const base = rollBetween(CONFIG.lootRange.min, CONFIG.lootRange.max);
        const gain = Math.round(base * enemy.lootMultiplier);
        setGold(state.gold + gain);
        setScore(state.score + gain);
        setHero("💰", `Looted ${gain} gold`, "Coin and score alike");
        logEntry("💰", `The ${enemy.name} drops <b>${gain}</b> gold.`, "loot");
        playSound("coin");
    } else if (drop === "potion") {
        const roll = rollBetween(CONFIG.potionRange.min, CONFIG.potionRange.max);
        const bonus = state.playerClass.perk === "healing" ? CONFIG.classBonuses.paladinHealing : 0;
        const potion = roll + bonus;
        const before = state.health;
        setHealth(Math.min(state.maxHealth, state.health + potion));
        const healed = state.health - before;
        setHero("🧪", `Quaffed a +${potion} potion`, "A timely draught");
        const blessed = bonus ? ` (${roll}+${bonus} blessed)` : "";
        const wasted = healed < potion ? ` - ${potion - healed} wasted at full health` : "";
        logEntry("🧪", `A health potion heals <b>${potion}</b>${blessed}${wasted}.`, "heal");
        playSound("health");
    } else {
        state.weaponDamage += CONFIG.weaponUpgradeGain;
        setDamage(state.damage + CONFIG.weaponUpgradeGain);
        el.charWeaponMeta.textContent = `+${state.weaponDamage} damage`;
        flashCard(el.charWeaponIcon.closest(".char-card"));
        setHero("🛠️", "Weapon upgraded", `Now dealing ${state.damage} damage`);
        logEntry("🛠️", `Your weapon is honed: <b>+${CONFIG.weaponUpgradeGain}</b> damage.`, "upgrade");
        playSound("hone");
    }

    await wait(CONFIG.stepDelay);
}

async function runGame() {
    state.running = true;
    state.completed = 0;
    playSound("click");
    playSound("begin");
    el.beginBtn.disabled = true;
    el.beginBtn.hidden = true;
    el.resetBtn.hidden = true;
    el.shareBtn.hidden = true;
    el.log.innerHTML = "";
    resetPanel();
    setScore(0);
    setGold(0);
    setEncounter(0);
    state.seed = makeSeed();
    seedRng(state.seed);
    el.seed.textContent = state.seed;

    await rollFate();

    let survived = true;
    for (let i = 1; i <= CONFIG.totalEncounters; i++) {
        setEncounter(i);
        const enemy = pick(ENEMIES);
        const won = await fightEnemy(enemy);
        if (!won) {
            survived = false;
            break;
        }
        state.completed = i;
        await awardDrop(enemy);
    }

    el.logPulse.classList.remove("live");
    endRun(survived);
}

function endRun(survived) {
    state.survived = survived;
    if (survived) {
        setHero("🏆", "You cleared the dungeon", `Final score: ${state.score}`);
        logEntry("🏆", `All ten encounters survived. Final score: <b>${state.score}</b>.`, "verdict");
        playSound("win");
    } else {
        setHero("⚰️", "You have fallen", `Encounter ${state.encounter} · score ${state.score}`);
        logEntry("⚰️", `Slain at encounter ${state.encounter}. Final score: <b>${state.score}</b>.`, "verdict");
        playSound("lose");
    }
    state.running = false;
    if (CONFIG.daily.enabled) {
        try { localStorage.setItem(CONFIG.daily.storageKey, todayKey()); } catch (err) {}
        el.resetBtn.hidden = true;
        showLockMessage();
    } else {
        el.resetBtn.hidden = false;
    }
    el.shareBtn.hidden = false;
    el.shareBtn.textContent = "📋 Share run";
}

function buildShareText() {
    const outcome = state.survived ? "🏆 Cleared the dungeon!" : "⚰️ Fell in battle";
    return [
        `idlerpgdle ${state.seed}`,
        outcome,
        `${state.playerClass.icon} Class: ${state.playerClass.name}`,
        `${state.weapon.icon} Weapon: ${state.weapon.name}`,
        `❤️ Health: ${state.health}/${state.maxHealth}`,
        `🗺️ Encounters: ${state.completed}/${CONFIG.totalEncounters}`,
        `💰 Gold: ${state.gold}`,
        `🏅 Final score: ${state.score}`
    ].join("\n");
}

async function shareRun() {
    playSound("click");
    const text = buildShareText();
    try {
        await navigator.clipboard.writeText(text);
        el.shareBtn.textContent = "✅ Copied!";
    } catch (err) {
        el.shareBtn.textContent = "⚠️ Copy failed";
    }
    setTimeout(() => { el.shareBtn.textContent = "📋 Share run"; }, 2000);
}

function playedToday() {
    if (!CONFIG.daily.enabled) return false;
    try {
        return localStorage.getItem(CONFIG.daily.storageKey) === todayKey();
    } catch (err) {
        return false;
    }
}

function showLockMessage() {
    setHero("🔒", "Today's run is complete", "Come back tomorrow for a fresh descent");
    el.beginBtn.hidden = true;
    el.beginBtn.disabled = true;
}

function startGame() {
    if (state.running) return;
    if (playedToday()) {
        showLockMessage();
        return;
    }
    runGame();
}

el.beginBtn.addEventListener("click", startGame);
el.resetBtn.addEventListener("click", startGame);
el.shareBtn.addEventListener("click", shareRun);

preloadSounds();

if (playedToday()) {
    showLockMessage();
    el.shareBtn.hidden = true;
}
