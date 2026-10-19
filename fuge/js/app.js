(function () {
    "use strict";

    const TRACKS = [
        { key: "pulse1", name: "Pulse 1", short: "PU1", kind: "pulse", color: "--ch1" },
        { key: "pulse2", name: "Pulse 2", short: "PU2", kind: "pulse", color: "--ch2" },
        { key: "wave", name: "Wave", short: "WAV", kind: "wave", color: "--ch3" },
        { key: "noise", name: "Noise", short: "NOI", kind: "noise", color: "--ch4" }
    ];
    const KINDS = ["pulse", "wave", "noise"];
    const KIND_LABEL = { pulse: "Pulse", wave: "Wave", noise: "Noise" };
    const KIND_COLOR = { pulse: "--ch1", wave: "--ch3", noise: "--ch4" };
    const MAX_ROWS = 64;
    let ROWS = MAX_ROWS;
    const NOTE_MAX = 71;
    const NOISE_MAX = 63;
    const MAX_INST = 15;
    const VBLANK_HZ = 59.7275;
    const NOTE_NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
    const SLOT_W = 84;
    const KEY_W = 64;
    const RULER_H = 20;
    const PITCH_H = 14;
    const LANE_MIN = 30;
    const LANE_MAX = 44;
    const DUTY_LABELS = ["12.5%", "25%", "50%", "75%"];
    const DUTY_FRAC = [0.125, 0.25, 0.5, 0.75];
    const WAVE_LEVELS = [{ v: 1, label: "100%" }, { v: 2, label: "50%" }, { v: 3, label: "25%" }, { v: 0, label: "Mute" }];
    const WAVE_GAIN = [0, 15, 8, 4];
    const FX = [
        { code: 0x0, name: "Arpeggio", kinds: ["pulse", "wave"], x: "+semitones", y: "+semitones", hint: "Cycles +y, +x and the note itself every tick for the whole note. 4 7 makes a major chord, 3 7 a minor one." },
        { code: 0x1, name: "Slide up", kinds: ["pulse", "wave"], x: "speed", y: "speed", hint: "Bends the pitch up by xy period steps every tick while the note plays." },
        { code: 0x2, name: "Slide down", kinds: ["pulse", "wave"], x: "speed", y: "speed", hint: "Bends the pitch down by xy period steps every tick while the note plays." },
        { code: 0x3, name: "Glide to note", kinds: ["pulse", "wave"], x: "speed", y: "speed", hint: "Slides from the previous note to this one at speed xy instead of jumping." },
        { code: 0x4, name: "Vibrato", kinds: ["pulse", "wave"], x: "rate", y: "depth", hint: "Flips the pitch up by y and back. x sets the rate: 4 is about 7 Hz (natural), 8 about 3 Hz (slow), 1 about 19 Hz (shimmer). The same depth wobbles more on higher notes." },
        { code: 0x7, name: "Note delay", kinds: ["pulse", "wave", "noise"], x: "ticks", y: "ticks", hint: "Starts the note xy ticks into the row. Must be less than the song speed, and 00 never plays." },
        { code: 0x9, name: "Set duty", kinds: ["pulse"], x: "duty", y: "-", hint: "Changes the pulse width: 00 = 12.5%, 40 = 25%, 80 = 50%, C0 = 75%." },
        { code: 0xA, name: "Volume step", kinds: ["pulse", "wave", "noise"], x: "up", y: "down", hint: "Restarts the note x louder or y quieter. It happens once, at the start of the row." },
        { code: 0xC, name: "Set volume", kinds: ["pulse", "wave", "noise"], x: "0", y: "volume", hint: "Restarts the note at volume y (0–F). Keep x at 0." },
        { code: 0xE, name: "Note cut", kinds: ["pulse", "wave", "noise"], x: "ticks", y: "ticks", hint: "Silences the channel xy ticks into the row (00 = straight away)." },
        { code: 0x8, name: "Panning", kinds: ["pulse", "wave", "noise"], x: "left", y: "right", hint: "Sets the speaker mix for every channel (NR51). Bits in x are left, bits in y right: 8 = noise, 4 = wave, 2 = pulse 2, 1 = pulse 1." },
        { code: 0x5, name: "Master volume", kinds: ["pulse", "wave", "noise"], x: "left", y: "right", hint: "Sets the overall left/right volume, 0–7 each." },
        { code: 0xF, name: "Set speed", kinds: ["pulse", "wave", "noise"], x: "ticks", y: "ticks", hint: "Changes the song speed (ticks per row) from here on." }
    ];
    const SUB_MAX = 32;
    const LOOP_MAX = 30;
    const TABLE_FX = { pulse: [0x0, 0x1, 0x2, 0x4, 0x9, 0xA, 0xC], wave: [0x0, 0x1, 0x2, 0x4, 0xC], noise: [0x9, 0xA, 0xC] };
    const TABLE_HINT = {
        0x0: "Plays +y, +x or the note itself on this tick, in turn. Loop a single row for a steady chord.",
        0x1: "Bends the pitch up by xy period steps on this tick.",
        0x2: "Bends the pitch down by xy period steps on this tick.",
        0x4: "Flips the pitch up by y or back, at rate x. Loop a single row for a steady vibrato.",
        0x9: "Pulse width: 00 = 12.5%, 40 = 25%, 80 = 50%, C0 = 75%. On noise, 08 switches to metallic and 00 back, until the pitch changes.",
        0xA: "Restarts the note x louder or y quieter. Restarts click a little and can bring back a note that already ended.",
        0xC: "Sets volume y. Pulse and noise restart (a small click); wave changes level smoothly but only has 4 steps."
    };
    const SCALES = {
        Ionian: { label: "Major (Ionian)", steps: [2, 2, 1, 2, 2, 2, 1] },
        Dorian: { label: "Dorian", steps: [2, 1, 2, 2, 2, 1, 2] },
        Phrygian: { label: "Phrygian", steps: [1, 2, 2, 2, 1, 2, 2] },
        Lydian: { label: "Lydian", steps: [2, 2, 2, 1, 2, 2, 1] },
        Mixolydian: { label: "Mixolydian", steps: [2, 2, 1, 2, 2, 1, 2] },
        Aeolian: { label: "Minor (Aeolian)", steps: [2, 1, 2, 2, 1, 2, 2] },
        Locrian: { label: "Locrian", steps: [1, 2, 2, 1, 2, 2, 2] },
        HarmonicMinor: { label: "Harmonic minor", steps: [2, 1, 2, 2, 1, 3, 1] },
        MelodicMinor: { label: "Melodic minor", steps: [2, 1, 2, 2, 2, 2, 1] },
        PhrygianDom: { label: "Phrygian dominant", steps: [1, 3, 1, 2, 1, 2, 2] },
        MinorBlues: { label: "Minor blues", steps: [3, 2, 1, 1, 3, 2] },
        Chinese: { label: "Chinese", steps: [4, 2, 1, 4, 1] },
        Romanian: { label: "Romanian", steps: [2, 1, 3, 1, 2, 1, 2] },
        MajorBeBop: { label: "Major bebop", steps: [2, 2, 1, 2, 1, 1, 2, 1] },
        MinorBebop: { label: "Minor bebop", steps: [2, 1, 1, 1, 2, 2, 1, 2] }
    };
    const ROOT_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const KB_ROWS = [
        ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
        ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash"],
        ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
        ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"]
    ];
    const KB_FLAT = KB_ROWS.flat();
    const KB_CODES = new Set(KB_FLAT);
    const KB_FREE = {
        KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
        KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30, BracketRight: 31
    };
    const KB_OCT_MAX = 3;
    const KB = { held: new Map(), sound: null, ch: -1, warned: false };
    const STORE_KEY = "fuge.autosave";
    const THEME_KEY = "fuge.theme";
    const VOL_KEY = "fuge.volume";
    const PATH_KEY = "fuge.path";
    const INST_CLIP_KEY = "fuge.instclip";
    const OLD_KEYS = { "fuge.autosave": "gbdaw.autosave", "fuge.theme": "gbdaw.theme", "fuge.volume": "gbdaw.volume" };

    const $ = id => document.getElementById(id);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const hex = (n, w) => n.toString(16).toUpperCase().padStart(w, "0");
    const pad2 = n => String(n).padStart(2, "0");
    const uid = () => Math.random().toString(36).slice(2, 10);
    const clone = o => JSON.parse(JSON.stringify(o));
    const noteName = n => NOTE_NAMES[n % 12] + (Math.floor(n / 12) + 3);
    const isBlack = n => [1, 3, 6, 8, 10].includes(n % 12);
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

    function storeSet(k, v) {
        try {
            localStorage.setItem(k, v);
        } catch (e) {
            return false;
        }
        return true;
    }

    function storeGet(k) {
        try {
            const v = localStorage.getItem(k);
            return v === null && OLD_KEYS[k] ? localStorage.getItem(OLD_KEYS[k]) : v;
        } catch (e) {
            return null;
        }
    }

    function makeInst(type, presetName) {
        const preset = Presets.LIBRARY[type].find(p => p.name === presetName) || { name: presetName, data: {} };
        const inst = Presets.make(type, preset);
        inst.id = uid();
        return inst;
    }

    function blankSong() {
        return {
            format: "fuge",
            version: 1,
            name: "Untitled",
            artist: "",
            comment: "",
            mode: "song",
            scale: { root: 0, name: "Free" },
            speed: 7,
            rowsPerBeat: 4,
            beatsPerBar: 4,
            instruments: [
                makeInst("pulse", "Square Lead"),
                makeInst("pulse", "Pluck"),
                makeInst("pulse", "Echo"),
                makeInst("wave", "Triangle Bass"),
                makeInst("noise", "Kick"),
                makeInst("noise", "Snare"),
                makeInst("noise", "Closed Hat"),
                makeInst("noise", "Open Hat")
            ],
            tracks: TRACKS.map(t => ({ key: t.key, patterns: [] })),
            order: [[-1, -1, -1, -1]]
        };
    }

    function demoSong() {
        return normalize(clone(DEMO_SONG));
    }

    function num(v, lo, hi, d) {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? clamp(n, lo, hi) : d;
    }

    function subLimit(loop) {
        return loop >= 0 ? SUB_MAX : SUB_MAX - 2;
    }

    function normSub(raw, oldFx, type) {
        if (raw && Array.isArray(raw.rows) && raw.rows.length) {
            const rows = raw.rows.slice(0, SUB_MAX).map(r => {
                const fx = r && r.fx && Number.isFinite(Number(r.fx.code)) ? { code: num(r.fx.code, 0, 15, 0), param: num(r.fx.param, 0, 255, 0) } : null;
                const n = r ? parseInt(r.note, 10) : NaN;
                return { note: Number.isFinite(n) ? clamp(n, -36, 35) : null, fx: fx && (TABLE_FX[type] || []).includes(fx.code) ? fx : null };
            });
            let loop = parseInt(raw.loop, 10);
            loop = Number.isFinite(loop) && loop >= 0 && loop < rows.length ? Math.min(loop, LOOP_MAX) : -1;
            return { name: String(raw.name || "Custom").slice(0, 32), loop, rows: rows.slice(0, subLimit(loop)) };
        }
        if (oldFx && Number.isFinite(Number(oldFx.code))) {
            const fx = { code: num(oldFx.code, 0, 15, 0), param: num(oldFx.param, 0, 255, 0) };
            if (!(TABLE_FX[type] || []).includes(fx.code)) return null;
            return { name: (FX.find(f => f.code === fx.code) || { name: "Effect" }).name, loop: 0, rows: [{ note: null, fx }] };
        }
        return null;
    }

    function normalize(raw) {
        if (!raw || typeof raw !== "object" || !Array.isArray(raw.instruments) || !Array.isArray(raw.tracks) || !Array.isArray(raw.order)) {
            throw new Error("This file isn't a fUGE project.");
        }
        const s = {
            format: "fuge",
            version: 1,
            name: String(raw.name || "Untitled").slice(0, 60),
            artist: String(raw.artist || "").slice(0, 60),
            comment: String(raw.comment || "").slice(0, 255),
            speed: num(raw.speed, 1, 255, 7),
            rowsPerBeat: num(raw.rowsPerBeat, 1, 16, 4),
            beatsPerBar: num(raw.beatsPerBar, 1, 16, 4),
            instruments: [],
            tracks: [],
            order: []
        };
        const ids = new Set();
        for (const r of raw.instruments) {
            if (!r || !Presets.DEFAULTS[r.type]) continue;
            if (s.instruments.filter(i => i.type === r.type).length >= MAX_INST) continue;
            const d = Presets.DEFAULTS[r.type];
            const inst = { id: typeof r.id === "string" && !ids.has(r.id) ? r.id : uid(), type: r.type, name: String(r.name || KIND_LABEL[r.type]).slice(0, 32) };
            inst.length = num(r.length, 0, r.type === "wave" ? 256 : 64, 0);
            if (r.type === "wave") {
                inst.level = num(r.level, 0, 3, 1);
                const w = Array.isArray(r.wave) ? r.wave : Presets.SHAPES.triangle();
                inst.wave = Array.from({ length: 32 }, (_, k) => num(w[k], 0, 15, 0));
            } else {
                inst.vol = num(r.vol, 0, 15, d.vol);
                inst.envDir = r.envDir === "up" ? "up" : "down";
                inst.envPace = num(r.envPace, 0, 7, d.envPace);
                inst.fadeTo = num(r.fadeTo, 0, 15, 15);
            }
            if (r.type === "pulse") {
                inst.duty = num(r.duty, 0, 3, 2);
                inst.sweepTime = num(r.sweepTime, 0, 7, 0);
                inst.sweepDir = r.sweepDir === "up" ? "up" : "down";
                inst.sweepShift = num(r.sweepShift, 0, 7, 0);
            }
            if (r.type === "noise") {
                inst.bits = parseInt(r.bits, 10) === 7 ? 7 : 15;
                inst.note = num(r.note, 0, NOISE_MAX, d.note);
            }
            inst.sub = normSub(r.sub, r.fx, r.type);
            ids.add(inst.id);
            s.instruments.push(inst);
        }
        const kindOf = new Map(s.instruments.map(i => [i.id, i.type]));
        TRACKS.forEach((t, k) => {
            const rt = raw.tracks[k] || {};
            const pats = (Array.isArray(rt.patterns) ? rt.patterns : []).map(p => {
                const notes = (p && Array.isArray(p.notes) ? p.notes : []).filter(n => n && kindOf.get(n.inst) === t.kind).map(n => {
                    const row = num(n.row, 0, MAX_ROWS - 1, 0);
                    const fx = n.fx && Number.isFinite(Number(n.fx.code)) ? { code: num(n.fx.code, 0, 15, 0), param: num(n.fx.param, 0, 255, 0) } : null;
                    const out = { row, len: num(n.len, 1, MAX_ROWS - row, 1), note: num(n.note, 0, t.kind === "noise" ? NOISE_MAX : NOTE_MAX, 24), inst: n.inst, fx };
                    if (n.swell && t.kind !== "noise") out.swell = true;
                    const sl = parseInt(n.slide, 10);
                    if (t.kind !== "noise" && Number.isFinite(sl) && sl && Math.abs(sl) <= NOTE_MAX) {
                        out.slide = sl;
                        const at = num(n.slideAt, 0, out.len - 1, 0);
                        if (at) out.slideAt = at;
                        const slen = num(n.slideLen, 0, out.len - at, 0);
                        if (slen && at + slen < out.len) out.slideLen = slen;
                    }
                    return out;
                });
                return { notes };
            });
            s.tracks.push({ key: t.key, patterns: pats });
        });
        for (const row of raw.order) {
            s.order.push(TRACKS.map((t, k) => {
                const v = Array.isArray(row) ? parseInt(row[k], 10) : -1;
                return Number.isInteger(v) && v >= 0 && v < s.tracks[k].patterns.length ? v : -1;
            }));
        }
        if (!s.order.length) s.order.push([-1, -1, -1, -1]);
        const lens = Array.isArray(raw.orderRows) ? raw.orderRows : [];
        s.orderRows = s.order.map((r, k) => num(lens[k], 1, MAX_ROWS, MAX_ROWS));
        s.mode = raw.mode === "sfx" ? "sfx" : "song";
        const sc = raw.scale || {};
        s.scale = { root: num(sc.root, 0, 11, 0), name: SCALES[sc.name] ? sc.name : "Free" };
        if (s.mode === "sfx") {
            const src = Array.isArray(raw.sfx) ? raw.sfx : [];
            s.sfx = s.order.map((r, k) => {
                const x = src[k] || {};
                return { name: String(x.name || "Sound " + (k + 1)).slice(0, 32), rows: num(x.rows, 1, MAX_ROWS, 16), speed: num(x.speed, 1, 255, 3) };
            });
        }
        return s;
    }

    function sfxSet(examples) {
        const names = examples
            ? { pulse: ["Jump", "Coin", "Power Up", "Laser Zap", "Hurt", "Swoosh", "Teleport", "Charge Up", "Sparkle", "Menu Blip", "Error Buzz"], wave: ["Rumble", "Warble"], noise: ["Hit", "Big Boom", "Slash", "Footstep"] }
            : { pulse: ["Menu Blip", "Confirm", "Coin", "Jump"], wave: ["Warble"], noise: ["Hit", "Big Boom", "Slash"] };
        const instruments = [];
        for (const type of KINDS) for (const n of names[type]) instruments.push(makeInst(type, n));
        const s = {
            format: "fuge",
            version: 1,
            name: examples ? "Sound effects" : "Untitled sounds",
            artist: "",
            comment: "",
            mode: "sfx",
            scale: { root: 0, name: "Free" },
            speed: 3,
            rowsPerBeat: 4,
            beatsPerBar: 4,
            instruments,
            tracks: TRACKS.map(t => ({ key: t.key, patterns: [] })),
            order: [],
            sfx: []
        };
        const id = n => s.instruments.find(i => i.name === n).id;
        const add = (name, rows, speed, parts) => {
            const row = [-1, -1, -1, -1];
            parts.forEach((notes, c) => {
                if (!notes) return;
                s.tracks[c].patterns.push({ notes: notes.map(x => ({ row: x[0], len: x[1], note: x[2], inst: id(x[3]), fx: x[4] || null })) });
                row[c] = s.tracks[c].patterns.length - 1;
            });
            s.order.push(row);
            s.sfx.push({ name, rows, speed });
        };
        if (!examples) {
            add("Sound 1", 16, 3, []);
            return s;
        }
        const arp = p => ({ code: 0x0, param: p });
        add("Jump", 8, 3, [[[0, 6, 24, "Jump"]]]);
        add("Coin", 12, 2, [[[0, 2, 47, "Coin"], [2, 10, 52, "Coin"]]]);
        add("Power Up", 24, 2, [[[0, 3, 24, "Power Up"], [3, 3, 28, "Power Up"], [6, 3, 31, "Power Up"], [9, 3, 36, "Power Up"], [12, 3, 40, "Power Up"], [15, 3, 43, "Power Up"], [18, 6, 48, "Power Up"]]]);
        add("Laser", 10, 2, [[[0, 8, 48, "Laser Zap", { code: 0x2, param: 0x18 }]]]);
        add("Hit", 8, 2, [[[0, 5, 31, "Hurt"]], null, null, [[0, 1, 40, "Hit"]]]);
        add("Explosion", 32, 3, [null, null, [[0, 24, 12, "Rumble", { code: 0x2, param: 0x03 }]], [[0, 1, 30, "Big Boom"]]]);
        add("Magic", 24, 2, [null, [[0, 4, 43, "Sparkle", arp(0x7c)], [4, 4, 47, "Sparkle", arp(0x7c)], [8, 4, 50, "Sparkle", arp(0x7c)], [12, 10, 55, "Sparkle", arp(0x47)]], [[0, 22, 36, "Warble", { code: 0x4, param: 0x13 }]]]);
        add("Menu Select", 6, 2, [null, [[0, 1, 48, "Menu Blip"], [1, 4, 55, "Menu Blip"]]]);
        add("Sword", 8, 2, [[[0, 6, 36, "Swoosh"]], null, null, [[0, 1, 54, "Slash"]]]);
        add("Error", 12, 3, [null, [[0, 3, 14, "Error Buzz"], [4, 6, 14, "Error Buzz"]]]);
        add("Teleport", 20, 2, [[[0, 18, 24, "Teleport"]]]);
        add("Charge", 32, 3, [[[0, 32, 24, "Charge Up"]]]);
        add("Footsteps", 8, 3, [null, null, null, [[0, 1, 46, "Footstep"], [4, 1, 42, "Footstep"]]]);
        return s;
    }

    const state = {
        song: null,
        track: 0,
        ord: 0,
        inst: null,
        lastInst: { pulse: null, wave: null, noise: null },
        lastPulseTrack: 0,
        sel: [],
        clip: null,
        tool: "draw",
        drawLen: 4,
        ghost: true,
        waveMirror: true,
        subOpen: false,
        kb: false,
        kbOct: 0,
        mute: [false, false, false, false],
        solo: [false, false, false, false],
        playing: false,
        loop: false,
        playOrd: 0,
        playRow: 0,
        startRow: 0,
        dirty: false,
        filePath: null
    };
    const history = { undo: [], redo: [], key: null, time: 0 };

    function checkpoint(key) {
        const now = Date.now();
        if (key && key === history.key && now - history.time < 1500) {
            history.time = now;
            return;
        }
        history.key = key || null;
        history.time = now;
        history.undo.push(JSON.stringify(state.song));
        if (history.undo.length > 200) history.undo.shift();
        history.redo = [];
        state.dirty = true;
        scheduleAutosave();
        updateTitle();
        $("btnUndo").disabled = false;
        $("btnRedo").disabled = true;
    }

    function restore(json) {
        state.song = JSON.parse(json);
        state.sel = [];
        if (state.ord >= state.song.order.length) state.ord = state.song.order.length - 1;
        if (!instById(state.inst)) state.inst = null;
        syncInstToTrack();
        state.dirty = true;
        scheduleAutosave();
        renderAll();
    }

    function undo() {
        if (!history.undo.length) return;
        history.redo.push(JSON.stringify(state.song));
        history.key = null;
        restore(history.undo.pop());
        status("Undone.");
    }

    function redo() {
        if (!history.redo.length) return;
        history.undo.push(JSON.stringify(state.song));
        history.key = null;
        restore(history.redo.pop());
        status("Redone.");
    }

    let autosaveTimer = 0;

    function scheduleAutosave() {
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            storeSet(STORE_KEY, JSON.stringify(state.song));
            storeSet(PATH_KEY, state.filePath || "");
        }, 400);
        schedulePush();
    }

    let pushTimer = 0;

    function pushSong() {
        clearTimeout(pushTimer);
        if (!GBAudio.started) return;
        GBAudio.send({ type: "song", song: compileNow() });
    }

    function schedulePush() {
        clearTimeout(pushTimer);
        if (GBAudio.started) pushTimer = setTimeout(pushSong, 60);
    }

    function sendMute() {
        if (GBAudio.started) GBAudio.send({ type: "mute", mask: TRACKS.map((t, k) => !muted(k)) });
    }

    function audioSpec(inst) {
        const spec = clone(inst);
        const eff = UGE.instSub(inst);
        spec.table = UGE.compileSub(eff);
        if (UGE.fadeTick(inst) && eff === inst.sub) spec.hold = { tick: UGE.fadeTick(inst), fp: UGE.holdFx(inst) };
        delete spec.sub;
        if (inst.type === "wave") spec.waveIndex = -2;
        return spec;
    }

    function previewChannel(inst) {
        if (inst.type === "wave") return 2;
        if (inst.type === "noise") return 3;
        if (inst.sweepTime) return 0;
        return trackKind(state.track) === "pulse" ? state.track : 0;
    }

    function preview(inst, note, ch, fx) {
        if (!inst || state.playing) return;
        const c = ch === undefined ? previewChannel(inst) : ch;
        const n = note === undefined ? (inst.type === "noise" ? inst.note : inst.type === "wave" ? 24 : 36) : note;
        const f = fx === undefined ? null : fx;
        const moving = subActive(inst.sub) || (f && (f.code === 0x4 || f.code === 0x0));
        GBAudio.start().then(sendMute).catch(() => toast("Couldn't start audio in this browser."));
        let dur = inst.type === "noise" ? 0.9 : moving ? 0.8 : 0.45;
        if (inst.type !== "wave" && inst.envDir === "up" && inst.envPace) dur = Math.max(dur, Math.min(2.5, (fadeCap(inst) - inst.vol) * inst.envPace / 64 + 0.4));
        GBAudio.send({ type: "preview", ch: c, inst: audioSpec(inst), note: n, fx: f, dur });
    }

    const trackKind = t => TRACKS[t].kind;
    const instById = id => state.song.instruments.find(i => i.id === id) || null;
    const instsOf = kind => state.song.instruments.filter(i => i.type === kind);
    const instNum = inst => instsOf(inst.type).indexOf(inst) + 1;
    const patIndex = (t, o) => state.song.order[o] ? state.song.order[o][t] : -1;
    const usage = (t, idx) => state.song.order.filter(r => r[t] === idx).length;
    const curInst = () => instById(state.inst);
    const muted = k => state.mute[k] || (state.solo.some(Boolean) && !state.solo[k]);
    const isSfx = () => state.song.mode === "sfx";
    const curSfx = () => isSfx() ? state.song.sfx[state.ord] : null;
    const speedNow = () => isSfx() && curSfx() ? curSfx().speed : state.song.speed;
    const sfxSeconds = s => s.rows * s.speed / VBLANK_HZ;

    function scaleSet() {
        const sc = state.song.scale;
        if (!sc || !SCALES[sc.name]) return null;
        const set = new Set();
        let pc = sc.root;
        for (const step of SCALES[sc.name].steps) {
            set.add(pc % 12);
            pc += step;
        }
        return set;
    }

    function labelRoot() {
        const sc = state.song.scale;
        return sc && SCALES[sc.name] ? sc.root : 0;
    }

    function ordRows(o) {
        if (isSfx()) return state.song.sfx[o] ? state.song.sfx[o].rows : 16;
        const v = state.song.orderRows && state.song.orderRows[o];
        return v > 0 ? v : MAX_ROWS;
    }

    function lengthChoices(cur) {
        const bar = state.song.rowsPerBeat * state.song.beatsPerBar;
        const set = new Set([cur, MAX_ROWS]);
        for (let v = bar; v <= MAX_ROWS; v += bar) set.add(v);
        [16, 32, 48].forEach(v => set.add(v));
        return [...set].sort((a, b) => a - b);
    }

    function setOrderRows(o, rows, all) {
        checkpoint();
        if (!state.song.orderRows) state.song.orderRows = state.song.order.map(() => MAX_ROWS);
        const list = all ? state.song.orderRows.map((v, k) => k) : [o];
        let hidden = 0;
        for (const k of list) {
            state.song.orderRows[k] = rows;
            state.song.order[k].forEach((idx, t) => {
                if (idx >= 0) hidden += state.song.tracks[t].patterns[idx].notes.filter(n => n.row >= rows).length;
            });
        }
        state.startRow = Math.min(state.startRow, rows - 1);
        if (state.playing) pushSong();
        renderAll();
        const bar = state.song.rowsPerBeat * state.song.beatsPerBar;
        status((all ? "Every order is now " : "Order " + pad2(o) + " is now ") + rows + " rows" + (rows % bar === 0 ? " (" + rows / bar + " bar" + (rows / bar === 1 ? "" : "s") + ")" : "") + "." + (hidden ? " " + hidden + " note" + (hidden === 1 ? " is" : "s are") + " past the end and won't play; lengthen the order to bring " + (hidden === 1 ? "it" : "them") + " back." : ""));
    }

    function syncRows() {
        ROWS = ordRows(state.ord);
    }

    function compileNow() {
        return isSfx() ? UGE.compile(state.song, { sfx: state.ord }).song : UGE.compile(state.song).song;
    }

    function playMsg(row) {
        syncRows();
        const r = Math.min(row, ROWS - 1);
        return isSfx() ? { type: "play", order: 0, row: r, once: !state.loop, cutAtEnd: true } : { type: "play", order: state.ord, row: r };
    }

    function patAt(t, o) {
        const i = patIndex(t, o);
        return i >= 0 ? state.song.tracks[t].patterns[i] : null;
    }

    const curPat = () => patAt(state.track, state.ord);
    const effFx = n => n.fx || null;
    const fxLabel = fx => fx ? hex(fx.code, 1) + hex(fx.param, 2) + " " + ((FX.find(f => f.code === fx.code) || { name: "" }).name) : "";

    function instUseCount(id) {
        let c = 0;
        for (const t of state.song.tracks) for (const p of t.patterns) for (const n of p.notes) if (n.inst === id) c++;
        return c;
    }

    function ensurePattern() {
        let pat = curPat();
        if (pat) return pat;
        pat = { notes: [] };
        const pats = state.song.tracks[state.track].patterns;
        pats.push(pat);
        state.song.order[state.ord][state.track] = pats.length - 1;
        return pat;
    }

    function syncInstToTrack() {
        const kind = trackKind(state.track);
        const cur = curInst();
        if (cur && cur.type === kind) return;
        const last = instById(state.lastInst[kind]);
        const pick = last && last.type === kind ? last : instsOf(kind)[0] || null;
        if (pick) state.inst = pick.id;
        else if (!cur) state.inst = state.song.instruments[0] ? state.song.instruments[0].id : null;
    }

    function selectSlot(t, o) {
        const trackChanged = t !== state.track;
        if (trackChanged) kbStopAll();
        state.track = clamp(t, 0, 3);
        state.ord = clamp(o, 0, state.song.order.length - 1);
        state.sel = [];
        if (trackKind(state.track) === "pulse") state.lastPulseTrack = state.track;
        syncInstToTrack();
        if (state.playing) {
            state.playOrd = state.ord;
            state.playRow = 0;
            if (isSfx()) pushSong();
            GBAudio.send(playMsg(0));
        }
        renderAll();
        revealSlot();
        centerRoll(trackChanged);
    }

    function selectInst(id) {
        const inst = instById(id);
        if (!inst) return;
        state.inst = id;
        state.lastInst[inst.type] = id;
        if (trackKind(state.track) !== inst.type) {
            const t = inst.type === "pulse" ? state.lastPulseTrack : TRACKS.findIndex(x => x.kind === inst.type);
            status("Switched to " + TRACKS[t].name + ": " + KIND_LABEL[inst.type] + " instruments only play on " + (inst.type === "pulse" ? "the pulse channels." : "the " + KIND_LABEL[inst.type] + " channel."));
            selectSlot(t, state.ord);
            return;
        }
        renderInstList();
        renderEditor();
        renderInspector();
        renderHint();
        drawKeys();
        drawGrid();
    }

    let P = {};

    function readPalette() {
        const cs = getComputedStyle(document.documentElement);
        const g = k => cs.getPropertyValue(k).trim();
        P = {
            bg: g("--roll-bg"),
            alt: g("--roll-alt"),
            out: g("--roll-out"),
            beat: g("--roll-beat"),
            bar: g("--roll-bar"),
            line: g("--line"),
            lineStrong: g("--line-strong"),
            ink: g("--ink"),
            muted: g("--muted"),
            panel: g("--panel"),
            panel2: g("--panel-2"),
            accent: g("--accent"),
            accentSoft: g("--accent-soft"),
            keyW: g("--key-white"),
            keyB: g("--key-black"),
            dim: g("--dim"),
            ch: [g("--ch1"), g("--ch2"), g("--ch3"), g("--ch4")],
            kind: { pulse: g("--ch1"), wave: g("--ch3"), noise: g("--ch4") },
            mono: g("--f-mono"),
            body: g("--f-body")
        };
    }

    function prep(cv, w, h, fluid) {
        const dpr = window.devicePixelRatio || 1;
        const W = Math.max(1, Math.round(w * dpr));
        const H = Math.max(1, Math.round(h * dpr));
        if (cv.width !== W) cv.width = W;
        if (cv.height !== H) cv.height = H;
        if (!fluid) cv.style.width = w + "px";
        cv.style.height = h + "px";
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        return ctx;
    }

    function envAt(inst, t) {
        if (inst.length && t >= inst.length / 256) return 0;
        if (inst.type === "wave") return WAVE_GAIN[inst.level];
        if (!inst.envPace) return inst.vol;
        const steps = Math.floor(t / (inst.envPace / 64));
        return inst.envDir === "down" ? Math.max(0, inst.vol - steps) : Math.min(fadeCap(inst), inst.vol + steps);
    }

    function fadeCap(inst) {
        return inst.fadeTo > inst.vol && inst.fadeTo < 15 ? inst.fadeTo : 15;
    }

    function drawIcon(cv, inst, w, h) {
        const ctx = prep(cv, w, h);
        const c = P.kind[inst.type];
        ctx.strokeStyle = c;
        ctx.fillStyle = c;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        if (inst.type === "pulse") {
            const d = DUTY_FRAC[inst.duty];
            const cw = (w - 4) / 2;
            const top = 3;
            const bot = h - 3;
            ctx.beginPath();
            ctx.moveTo(2, bot);
            for (let k = 0; k < 2; k++) {
                const x0 = 2 + k * cw;
                ctx.lineTo(x0, bot);
                ctx.lineTo(x0, top);
                ctx.lineTo(x0 + cw * d, top);
                ctx.lineTo(x0 + cw * d, bot);
            }
            ctx.lineTo(w - 2, bot);
            ctx.stroke();
        } else if (inst.type === "wave") {
            const bw = (w - 4) / inst.wave.length;
            ctx.beginPath();
            inst.wave.forEach((v, k) => {
                const y = h - 3 - v / 15 * (h - 6);
                const x = 2 + k * bw;
                if (k === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                ctx.lineTo(x + bw, y);
            });
            ctx.stroke();
        } else {
            let seed = inst.note * 7 + 3;
            const rnd = () => {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return seed / 0x7fffffff;
            };
            const n = inst.bits === 7 ? 10 : 16;
            const bw = (w - 4) / n;
            for (let k = 0; k < n; k++) {
                const env = Math.max(envAt(inst, k / n * 0.6), 1) / 15;
                const amp = (inst.bits === 7 ? (k % 2 ? 1 : 0.45) : 0.25 + rnd() * 0.75) * env;
                const bh = Math.max(1, amp * (h - 4));
                ctx.fillRect(2 + k * bw, (h - bh) / 2, Math.max(1, bw - 1), bh);
            }
        }
    }

    function refreshIcon(inst) {
        const cv = document.querySelector(".inst[data-id=\"" + inst.id + "\"] canvas");
        if (cv) drawIcon(cv, inst, 38, 18);
    }

    function renderTop() {
        const s = state.song;
        const sp = $("speed");
        const speeds = [];
        const cur = speedNow();
        for (let v = 1; v <= 20; v++) speeds.push(v);
        if (!speeds.includes(cur)) speeds.push(cur);
        sp.innerHTML = speeds.map(v => "<option value=\"" + v + "\">" + v + "</option>").join("");
        sp.value = String(cur);
        $("modeChip").hidden = !isSfx();
        const rp = $("rpb");
        const rpbs = [2, 3, 4, 6, 8];
        if (!rpbs.includes(s.rowsPerBeat)) rpbs.push(s.rowsPerBeat);
        rp.innerHTML = rpbs.map(v => "<option value=\"" + v + "\">" + v + "</option>").join("");
        rp.value = String(s.rowsPerBeat);
        $("bpm").textContent = isSfx() && curSfx() ? (VBLANK_HZ / cur).toFixed(1) + " rows/s · " + sfxSeconds(curSfx()).toFixed(2) + " s" : "≈ " + bpm().toFixed(1) + " BPM";
        if (document.activeElement !== $("songName")) $("songName").value = s.name;
        if (document.activeElement !== $("songArtist")) $("songArtist").value = s.artist;
        $("btnUndo").disabled = !history.undo.length;
        $("btnRedo").disabled = !history.redo.length;
        $("btnLoop").setAttribute("aria-pressed", String(state.loop));
        $("btnLoop").textContent = isSfx() ? "Loop sound" : "Loop order";
        $("btnLoop").title = isSfx() ? "Keep repeating the selected sound" : "Loop the selected order";
        $("btnPlay").setAttribute("aria-pressed", String(state.playing));
    }

    const bpm = () => 60 * VBLANK_HZ / (speedNow() * state.song.rowsPerBeat);

    function renderInstList() {
        const kind = trackKind(state.track);
        const el = $("instList");
        const scroll = el.scrollTop;
        el.innerHTML = "";
        for (const type of KINDS) {
            const list = instsOf(type);
            const g = document.createElement("div");
            g.className = "inst-group";
            g.innerHTML = "<div class=\"inst-group-head\"><p class=\"label\"><span class=\"kind-dot\" style=\"background:var(" + KIND_COLOR[type] + ")\"></span>" + KIND_LABEL[type] + "<span class=\"count\">" + list.length + "/" + MAX_INST + "</span></p>" +
                "<button class=\"btn small\" type=\"button\" data-new=\"" + type + "\"" + (list.length >= MAX_INST ? " disabled" : "") + " title=\"New blank " + KIND_LABEL[type] + " instrument\">+ New</button></div>";
            if (!list.length) g.insertAdjacentHTML("beforeend", "<p class=\"empty-note\">None yet. Add one from Presets.</p>");
            list.forEach((inst, k) => {
                const b = document.createElement("button");
                b.type = "button";
                b.className = "inst" + (inst.id === state.inst ? " active" : "") + (type !== kind ? " dim" : "");
                b.dataset.id = inst.id;
                if (type !== kind) b.title = "Plays on " + (type === "pulse" ? "Pulse 1 and 2" : KIND_LABEL[type]) + ". Selecting it switches track.";
                const tag = subTag(inst.sub);
                b.innerHTML = "<span class=\"num\">" + pad2(k + 1) + "</span><canvas></canvas><span class=\"name\">" + esc(inst.name) + (tag ? " <span class=\"ifx\" title=\"Subpattern: " + esc(inst.sub.name) + "\">" + tag + "</span>" : "") + "</span>";
                g.appendChild(b);
                drawIcon(b.querySelector("canvas"), inst, 38, 18);
            });
            el.appendChild(g);
        }
        el.scrollTop = scroll;
    }

    function seg(name, options, current) {
        return "<div class=\"seg\" role=\"group\">" + options.map(o => "<button type=\"button\" data-seg=\"" + name + "\" data-v=\"" + o.v + "\" aria-pressed=\"" + (String(o.v) === String(current)) + "\">" + o.label + "</button>").join("") + "</div>";
    }

    const FMT = {
        vol: v => v + " / 15",
        envPace: v => Math.round(v / 64 * 1000) + " ms per step",
        fadeTo: v => v + " / 15",
        length: v => Math.round(v / 256 * 1000) + " ms",
        sweepTime: v => v ? (v / 128 * 1000).toFixed(1) + " ms per step" : "Off",
        sweepShift: v => String(v),
        note: v => noteName(v)
    };

    function range(k, label, min, max, value) {
        return "<label class=\"field\"><span>" + label + " <b data-out=\"" + k + "\">" + FMT[k](value) + "</b></span><input type=\"range\" data-k=\"" + k + "\" min=\"" + min + "\" max=\"" + max + "\" value=\"" + value + "\"></label>";
    }

    function envFields(inst) {
        const mode = inst.envPace ? inst.envDir : "hold";
        let h = range("vol", inst.envDir === "up" && inst.envPace ? "Start volume" : "Volume", 0, 15, inst.vol);
        h += "<div class=\"field\"><span>Envelope</span>" + seg("env", [{ v: "hold", label: "Hold" }, { v: "down", label: "Fade out" }, { v: "up", label: "Fade in" }], mode) + "</div>";
        if (inst.envPace) h += range("envPace", "Fade speed", 1, 7, inst.envPace);
        if (inst.envPace && inst.envDir === "up" && inst.vol < 14) h += range("fadeTo", "Fade up to", inst.vol + 1, 15, Math.max(inst.fadeTo === undefined ? 15 : inst.fadeTo, inst.vol + 1));
        return h;
    }

    function lengthFields(inst, max) {
        let h = "<label class=\"field\" style=\"grid-template-columns:auto 1fr;align-items:center;gap:8px\"><input type=\"checkbox\" data-k=\"lenOn\"" + (inst.length ? " checked" : "") + "><span>Stop after a set time</span></label>";
        if (inst.length) h += range("length", "Length", 1, max, inst.length);
        return h;
    }

    function isMirrored(w) {
        for (let k = 0; k < 16; k++) if (w[k] !== w[k + 16]) return false;
        return true;
    }

    function renderEditor() {
        const el = $("instEditor");
        const inst = curInst();
        if (!inst) {
            el.innerHTML = "<p class=\"hint\">Pick an instrument to edit it, or add one from Presets.</p>";
            return;
        }
        const uses = instUseCount(inst.id);
        let h = "<div class=\"editor-head\"><span class=\"chip\" style=\"--c:var(" + KIND_COLOR[inst.type] + ")\">" + KIND_LABEL[inst.type].toUpperCase() + " " + pad2(instNum(inst)) + "</span><input type=\"text\" data-k=\"name\" value=\"" + esc(inst.name) + "\" maxlength=\"32\" aria-label=\"Instrument name\"><button class=\"btn small\" type=\"button\" data-act=\"test\" title=\"Hear this instrument\">▶ Hear</button></div>";
        if (inst.type === "pulse") {
            h += "<canvas class=\"preview-canvas\" id=\"envCanvas\" aria-label=\"Volume over one second\"></canvas>";
            h += "<div class=\"field\"><span>Duty cycle</span>" + seg("duty", DUTY_LABELS.map((l, i) => ({ v: i, label: l })), inst.duty) + "</div>";
            h += envFields(inst);
            h += lengthFields(inst, 64);
            h += "<div class=\"field\"><span>Pitch sweep <b>Pulse 1 only</b></span></div>";
            h += range("sweepTime", "Sweep speed", 0, 7, inst.sweepTime);
            if (inst.sweepTime) {
                h += "<div class=\"field\"><span>Direction</span>" + seg("sweepDir", [{ v: "up", label: "Up" }, { v: "down", label: "Down" }], inst.sweepDir) + "</div>";
                h += range("sweepShift", "Sweep amount", 0, 7, inst.sweepShift);
                if (state.track === 1) h += "<p class=\"hint warn\">Pulse 2 has no sweep hardware, so the sweep is ignored on this track.</p>";
            }
        } else if (inst.type === "wave") {
            h += "<div class=\"field\"><span>Volume</span>" + seg("level", WAVE_LEVELS, inst.level) + "</div>";
            h += "<div class=\"field\"><span>Waveform <b>drag to draw · right-click to type</b></span><canvas class=\"wave-canvas\" id=\"waveCanvas\" aria-label=\"Waveform editor\"></canvas></div>";
            h += "<div class=\"chips\">" + Object.keys(Presets.SHAPE_LABELS).map(k => "<button type=\"button\" class=\"btn small\" data-shape=\"" + k + "\">" + Presets.SHAPE_LABELS[k] + "</button>").join("") + "</div>";
            h += "<label class=\"field\" style=\"grid-template-columns:auto 1fr;align-items:center;gap:8px\"><input type=\"checkbox\" data-k=\"mirror\"" + (state.waveMirror ? " checked" : "") + "><span>Draw both halves together (keeps the pitch)</span></label>";
            if (!isMirrored(inst.wave)) h += "<p class=\"hint warn\">This wave holds one cycle, so it sounds an octave lower than the notes you write.</p>";
            h += lengthFields(inst, 256);
        } else {
            h += "<canvas class=\"preview-canvas\" id=\"envCanvas\" aria-label=\"Volume over one second\"></canvas>";
            h += envFields(inst);
            h += "<div class=\"field\"><span>Noise type</span>" + seg("bits", [{ v: 15, label: "Smooth" }, { v: 7, label: "Metallic" }], inst.bits) + "</div>";
            h += range("note", "Default pitch", 0, NOISE_MAX, inst.note);
            h += "<p class=\"hint\">Hits with this instrument play this pitch. To change a single hit, use the note panel.</p>";
            h += lengthFields(inst, 64);
        }
        h += subFields(inst);
        h += "<div class=\"chips\" style=\"align-items:center\"><button class=\"btn small\" type=\"button\" data-act=\"dup\"" + (instsOf(inst.type).length >= MAX_INST ? " disabled" : "") + ">Duplicate</button><button class=\"btn small\" type=\"button\" data-act=\"del\">Delete</button><span class=\"hint\" style=\"margin-left:auto\">" + (uses ? "Used by " + uses + " note" + (uses === 1 ? "" : "s") : "Not used yet") + "</span></div>";
        el.innerHTML = h;
        drawEditorCanvases(inst);
    }

    const TABLE_NAMES = { 0x0: "Arp", 0x1: "Slide up", 0x2: "Slide down", 0x4: "Vibrato", 0x9: "Duty", 0xA: "Vol step", 0xC: "Volume" };

    function subActive(sub) {
        return !!(sub && sub.rows.some(r => typeof r.note === "number" || (r.fx && (r.fx.code || r.fx.param))));
    }

    function subTag(sub) {
        if (!subActive(sub)) return "";
        const n = sub.name.toLowerCase();
        return n.includes("vib") ? "VIB" : n.includes("arp") ? "ARP" : "SUB";
    }

    function sameSub(a, b) {
        if (!a || !b || a.loop !== b.loop || a.rows.length !== b.rows.length) return false;
        return a.rows.every((r, k) => {
            const q = b.rows[k];
            return r.note === q.note && (r.fx ? !!q.fx && r.fx.code === q.fx.code && r.fx.param === q.fx.param : !q.fx);
        });
    }

    function subPresetName(inst) {
        if (!subActive(inst.sub)) return "";
        const hit = (Presets.SUBS[inst.type] || []).find(d => sameSub(inst.sub, Presets.subOf(inst.type, d.name)));
        return hit ? hit.name : "custom";
    }

    const offName = v => v === 0 ? "±0" : v > 0 ? "+" + v : "−" + -v;

    function subFields(inst) {
        const sub = inst.sub;
        const cur = subPresetName(inst);
        const list = Presets.SUBS[inst.type] || [];
        let h = "<div class=\"sub-sec\"><div class=\"field\"><span>Subpattern <b>moves every tick</b></span><select data-sp=\"preset\" aria-label=\"Subpattern preset\"><option value=\"\">None</option>" +
            (cur === "custom" ? "<option value=\"custom\" selected>Custom" + (sub.name && sub.name !== "Custom" ? " · " + esc(sub.name) : "") + "</option>" : "") +
            list.map(d => "<option value=\"" + esc(d.name) + "\"" + (d.name === cur ? " selected" : "") + ">" + esc(d.name) + "</option>").join("") + "</select></div>";
        const def = list.find(d => d.name === cur);
        if (def) h += "<p class=\"hint\">" + esc(def.desc) + "</p>";
        else if (!cur) h += "<p class=\"hint\">A tiny pattern that runs on every note this instrument plays, one row per tick: arpeggios, vibrato, pitch drops, duty changes. It exports to hUGETracker and GB Studio as the instrument's subpattern.</p>";
        h += "<div class=\"chips\"><button type=\"button\" class=\"btn small\" data-act=\"subEdit\" aria-pressed=\"" + !!state.subOpen + "\">" + (state.subOpen ? "Hide rows" : "Edit rows") + "</button>" +
            (cur ? "<button type=\"button\" class=\"btn small\" data-act=\"subOff\">Turn off</button>" : "") + "</div>";
        if (state.subOpen) h += subGrid(inst);
        return h + "</div>";
    }

    function subGrid(inst) {
        const sub = inst.sub || { loop: -1, rows: [] };
        const len = sub.rows.length;
        const max = subLimit(sub.loop);
        let h = "<div class=\"two\"><label class=\"field\"><span>Rows</span><select data-sp=\"len\">" +
            Array.from({ length: max }, (_, k) => "<option value=\"" + (k + 1) + "\"" + (k + 1 === len ? " selected" : "") + ">" + (k + 1) + "</option>").join("") +
            (len ? "" : "<option value=\"0\" selected>0</option>") + "</select></label>";
        h += "<label class=\"field\"><span>At the end</span><select data-sp=\"loop\"><option value=\"-1\"" + (sub.loop < 0 ? " selected" : "") + (len > SUB_MAX - 2 ? " disabled" : "") + ">Stop</option>" +
            Array.from({ length: Math.min(len, LOOP_MAX + 1) }, (_, k) => "<option value=\"" + k + "\"" + (k === sub.loop ? " selected" : "") + ">Loop from " + pad2(k + 1) + "</option>").join("") + "</select></label></div>";
        if (!len) return h + "<p class=\"hint\">Pick how many rows (ticks) to start with.</p>";
        const codes = TABLE_FX[inst.type] || [];
        let notes = "<option value=\"\">—</option>";
        for (let v = 24; v >= -24; v--) notes += "<option value=\"" + v + "\">" + offName(v) + "</option>";
        h += "<div class=\"sub-grid\" role=\"grid\"><div class=\"sub-row head\"><span>#</span><span>Note</span><span>Effect</span><span>x</span><span>y</span></div>";
        sub.rows.forEach((r, k) => {
            const fx = r.fx;
            const nib = (f, v) => "<select data-sp=\"" + f + "\" data-r=\"" + k + "\"" + (fx ? "" : " disabled") + " aria-label=\"Row " + (k + 1) + " " + f + "\">" + Array.from({ length: 16 }, (_, i) => "<option value=\"" + i + "\"" + (i === v ? " selected" : "") + ">" + hex(i, 1) + "</option>").join("") + "</select>";
            const nv = typeof r.note === "number" ? String(r.note) : "";
            let ns = notes.replace("value=\"" + nv + "\">", "value=\"" + nv + "\" selected>");
            if (typeof r.note === "number" && (r.note > 24 || r.note < -24)) ns += "<option value=\"" + r.note + "\" selected>" + offName(r.note) + "</option>";
            h += "<div class=\"sub-row" + (k === sub.loop ? " loop" : "") + (k >= sub.loop && sub.loop >= 0 ? " in-loop" : "") + "\"><span class=\"num\">" + pad2(k + 1) + "</span>" +
                "<select data-sp=\"note\" data-r=\"" + k + "\" aria-label=\"Row " + (k + 1) + " note offset\">" + ns + "</select>" +
                "<select data-sp=\"fx\" data-r=\"" + k + "\" aria-label=\"Row " + (k + 1) + " effect\"><option value=\"\">—</option>" + codes.map(c => "<option value=\"" + c + "\"" + (fx && fx.code === c ? " selected" : "") + ">" + hex(c, 1) + " " + TABLE_NAMES[c] + "</option>").join("") + "</select>" +
                nib("x", fx ? fx.param >> 4 : 0) + nib("y", fx ? fx.param & 15 : 0) + "</div>";
        });
        h += "</div>";
        const used = [...new Set(sub.rows.filter(r => r.fx).map(r => r.fx.code))];
        h += "<p class=\"hint\">Each row lasts one tick (1/60 s) and starts again on every new note. Note offsets are in semitones from the note you drew" + (inst.type === "noise" ? " (noise pitch steps here)" : "") + "." + (sub.loop >= 0 ? " Rows from " + pad2(sub.loop + 1) + " repeat until the next note." : " After the last row the sound holds where it ended.") + "</p>";
        used.forEach(c => {
            h += "<p class=\"hint\"><b style=\"font-family:var(--f-mono)\">" + hex(c, 1) + "xy</b> " + TABLE_HINT[c] + "</p>";
        });
        return h;
    }

    function setSub(inst, sub, quiet) {
        checkpoint();
        inst.sub = sub;
        renderEditor();
        renderInstList();
        scheduleAutosave();
        if (!quiet) preview(inst);
    }

    function editSub(inst, fn) {
        const sub = inst.sub ? clone(inst.sub) : { name: "Custom", loop: -1, rows: [] };
        fn(sub);
        if (sub.loop >= sub.rows.length) sub.loop = sub.rows.length ? 0 : -1;
        if (sub.loop > LOOP_MAX) sub.loop = LOOP_MAX;
        if (sub.loop < 0 && sub.rows.length > SUB_MAX - 2) sub.rows.length = SUB_MAX - 2;
        if (!subPresetNameOf(inst.type, sub)) sub.name = "Custom";
        setSub(inst, sub.rows.length ? sub : null);
    }

    function subPresetNameOf(type, sub) {
        const hit = (Presets.SUBS[type] || []).find(d => sameSub(sub, Presets.subOf(type, d.name)));
        if (hit) sub.name = hit.name;
        return hit ? hit.name : "";
    }

    function onSubChange(t) {
        const inst = curInst();
        if (!inst) return;
        const f = t.dataset.sp;
        const v = t.value;
        if (f === "preset") {
            if (v === "custom") return;
            setSub(inst, v ? Presets.subOf(inst.type, v) : null);
            return;
        }
        const r = parseInt(t.dataset.r, 10);
        editSub(inst, sub => {
            if (f === "len") {
                const n = clamp(parseInt(v, 10) || 0, 0, SUB_MAX);
                while (sub.rows.length < n) sub.rows.push({ note: null, fx: null });
                sub.rows.length = n;
            } else if (f === "loop") {
                sub.loop = parseInt(v, 10);
            } else if (f === "note") {
                sub.rows[r].note = v === "" ? null : clamp(parseInt(v, 10), -36, 35);
            } else if (f === "fx") {
                const code = v === "" ? -1 : parseInt(v, 10);
                const old = sub.rows[r].fx;
                sub.rows[r].fx = code < 0 ? null : { code, param: old && old.code === code ? old.param : TABLE_DEFAULT[code] };
            } else if ((f === "x" || f === "y") && sub.rows[r].fx) {
                const k = parseInt(v, 10);
                const p = sub.rows[r].fx.param;
                sub.rows[r].fx.param = f === "x" ? (k << 4) | (p & 15) : (p & 0xf0) | k;
            }
        });
    }

    const TABLE_DEFAULT = { 0x0: 0x47, 0x1: 0x04, 0x2: 0x04, 0x4: 0x43, 0x9: 0x80, 0xA: 0x01, 0xC: 0x08 };

    function drawEditorCanvases(inst) {
        const env = $("envCanvas");
        if (env) drawEnvelope(env, inst);
        const wave = $("waveCanvas");
        if (wave) drawWave(wave, inst);
    }

    function drawEnvelope(cv, inst) {
        const w = cv.clientWidth || 240;
        const h = 54;
        const ctx = prep(cv, w, h, true);
        const c = P.kind[inst.type];
        const span = 1;
        ctx.fillStyle = P.muted;
        ctx.font = "10px " + P.mono;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, h - 12, w, 1);
        ctx.globalAlpha = 1;
        ctx.fillText("0", 4, h - 2);
        ctx.fillText("0.5 s", w / 2 - 12, h - 2);
        ctx.fillText("1 s", w - 20, h - 2);
        ctx.beginPath();
        const top = 4;
        const base = h - 13;
        ctx.moveTo(0, base);
        for (let x = 0; x <= w; x++) {
            const v = envAt(inst, x / w * span);
            ctx.lineTo(x, base - v / 15 * (base - top));
        }
        ctx.lineTo(w, base);
        ctx.closePath();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = c;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function drawWave(cv, inst) {
        const w = cv.clientWidth || 240;
        const h = Math.round(w / 2);
        const ctx = prep(cv, w, h, true);
        const cw = w / 32;
        const ch = h / 16;
        ctx.strokeStyle = P.line;
        ctx.lineWidth = 1;
        for (let k = 1; k < 32; k++) {
            ctx.globalAlpha = k === 16 ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(Math.round(k * cw) + 0.5, 0);
            ctx.lineTo(Math.round(k * cw) + 0.5, h);
            ctx.stroke();
        }
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, h / 2 + 0.5);
        ctx.lineTo(w, h / 2 + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.kind.wave;
        inst.wave.forEach((v, k) => {
            const y = h - (v + 1) * ch;
            ctx.globalAlpha = 0.28;
            ctx.fillRect(k * cw + 1, y, cw - 2, h - y);
            ctx.globalAlpha = 1;
            ctx.fillRect(k * cw + 1, y, cw - 2, Math.max(2, ch - 1));
        });
    }

    function renderArrange() {
        $("trackHeads").innerHTML = "<div class=\"th-spacer\"></div>" + TRACKS.map((t, k) =>
            "<div class=\"track-head" + (k === state.track ? " active" : "") + "\" data-t=\"" + k + "\"><span class=\"stripe\" style=\"background:var(" + t.color + ")\"></span>" +
            "<span><span class=\"tname\">" + t.name + "</span><span class=\"tkind\">" + (t.kind === "noise" ? "Drums & noise" : KIND_LABEL[t.kind] + " channel") + "</span></span>" +
            "<span class=\"ms\"><button type=\"button\" class=\"m\" data-mute=\"" + k + "\" aria-pressed=\"" + state.mute[k] + "\" title=\"Mute\">M</button><button type=\"button\" class=\"s\" data-solo=\"" + k + "\" aria-pressed=\"" + state.solo[k] + "\" title=\"Solo\">S</button></span></div>"
        ).join("");
        const order = state.song.order;
        const sfx = isSfx();
        let h = "<div class=\"ord-head\">" + order.map((r, o) => {
            const label = sfx ? esc(state.song.sfx[o].name) : pad2(o);
            const title = sfx ? esc(state.song.sfx[o].name) + " · " + state.song.sfx[o].rows + " rows · " + sfxSeconds(state.song.sfx[o]).toFixed(2) + " s" : "Order " + pad2(o) + " · " + ordRows(o) + " rows";
            return "<button type=\"button\" class=\"ord-num" + (sfx ? " sfx" : "") + (o === state.ord ? " active" : "") + "\" data-o=\"" + o + "\" title=\"" + title + "\">" + label + "</button>";
        }).join("") +
            "<button type=\"button\" class=\"ord-add\" data-add=\"1\" title=\"" + (sfx ? "Add a sound effect" : "Add an order at the end") + "\">+</button></div>";
        TRACKS.forEach((t, k) => {
            h += "<div class=\"lane\" style=\"--c:var(" + t.color + ")" + (muted(k) ? ";opacity:.4" : "") + "\">";
            order.forEach((r, o) => {
                const idx = r[k];
                const cls = "slot" + (k === state.track && o === state.ord ? " active" : "") + (o === state.ord ? " col" : "");
                if (idx < 0) {
                    h += "<button type=\"button\" class=\"" + cls + "\" data-t=\"" + k + "\" data-o=\"" + o + "\" aria-label=\"" + t.name + ", order " + o + ", empty\" title=\"Empty: double-click to add a pattern\"><div class=\"clip empty\"></div></button>";
                } else {
                    const u = usage(k, idx);
                    h += "<button type=\"button\" class=\"" + cls + "\" data-t=\"" + k + "\" data-o=\"" + o + "\" aria-label=\"" + t.name + ", order " + o + ", pattern " + idx + "\"><div class=\"clip filled\"><span class=\"pid\">P" + pad2(idx) + "</span>" +
                        (u > 1 ? "<span class=\"reuse\" title=\"Used " + u + " times\">×" + u + "</span>" : "") + "<canvas data-t=\"" + k + "\" data-p=\"" + idx + "\" data-o=\"" + o + "\"></canvas></div></button>";
                }
            });
            h += "</div>";
        });
        h += "<div class=\"playline\" id=\"playline\"></div>";
        $("lanes").innerHTML = h;
        $("lanes").querySelectorAll("canvas[data-p]").forEach(cv => drawClip(cv, +cv.dataset.t, +cv.dataset.p, +cv.dataset.o));
        if (sfx) {
            $("arrInfo").textContent = order.length + " sound" + (order.length === 1 ? "" : "s");
        } else {
            const secs = order.reduce((a, r, k) => a + ordRows(k), 0) * state.song.speed / VBLANK_HZ;
            $("arrInfo").textContent = order.length + " order" + (order.length === 1 ? "" : "s") + " · " + Math.floor(secs / 60) + ":" + pad2(Math.round(secs % 60)) + " long";
        }
        $("arrLabel").textContent = sfx ? "Sound effects" : "Arrangement";
        $("ordAdd").textContent = sfx ? "+ Sound" : "+ Order";
        $("ordAdd").title = sfx ? "Add a new sound effect after this one" : "Insert an empty order after the selected one";
        $("ordDup").textContent = sfx ? "Duplicate" : "Repeat";
        $("ordDup").title = sfx ? "Copy this sound effect so you can make a variation" : "Repeat the selected order";
        $("ordLeft").disabled = state.ord === 0;
        $("ordRight").disabled = state.ord >= order.length - 1;
        positionPlayline();
    }

    function drawClip(cv, t, idx, o) {
        const w = SLOT_W - 8;
        const h = 36;
        const ctx = prep(cv, w, h);
        const src = state.song.tracks[t].patterns[idx];
        const rows = ordRows(o);
        const pat = src ? { notes: src.notes.filter(n => n.row < rows) } : null;
        if (!pat || !pat.notes.length) return;
        ctx.fillStyle = P.ch[t];
        const top = 14;
        const bh = h - top - 4;
        const sx = w / rows;
        if (TRACKS[t].kind === "noise") {
            const ns = instsOf("noise");
            const n = Math.max(1, ns.length - 1);
            for (const hit of pat.notes) {
                const lane = Math.max(0, ns.findIndex(i => i.id === hit.inst));
                ctx.fillRect(hit.row * sx, top + lane / n * (bh - 2), Math.max(1.5, sx - 0.2), 2.5);
            }
            return;
        }
        let lo = Infinity;
        let hi = -Infinity;
        for (const n of pat.notes) {
            lo = Math.min(lo, n.note);
            hi = Math.max(hi, n.note);
        }
        const span = Math.max(hi - lo, 8);
        const mid = (hi + lo) / 2;
        for (const n of pat.notes) {
            const y = top + (0.5 - (n.note - mid) / span) * (bh - 2);
            ctx.fillRect(n.row * sx, y, Math.max(1.5, n.len * sx - 0.6), 2);
        }
    }

    function positionPlayline() {
        const pl = $("playline");
        if (!pl) return;
        if (!state.playing) {
            pl.style.display = "none";
            return;
        }
        pl.style.display = "block";
        pl.style.transform = "translate3d(" + Math.round(state.playOrd * SLOT_W + Math.floor(state.playRow) / ordRows(state.playOrd) * SLOT_W) + "px, 0, 0)";
    }

    function revealSlot() {
        const sc = $("lanesScroll");
        const x = state.ord * SLOT_W;
        if (x < sc.scrollLeft) sc.scrollLeft = x;
        else if (x + SLOT_W > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = x + SLOT_W - sc.clientWidth;
    }

    function renderPatBar() {
        const t = TRACKS[state.track];
        const idx = patIndex(state.track, state.ord);
        const u = idx >= 0 ? usage(state.track, idx) : 0;
        $("patTitle").innerHTML = "<span class=\"chip\" style=\"--c:var(" + t.color + ")\">" + t.short + "</span><span class=\"where\">" + t.name + (isSfx() ? "" : " · Order " + pad2(state.ord)) + "</span>" +
            (u > 1 ? "<span class=\"shared\" title=\"Edits change every slot that uses this pattern. Use Make unique to edit just this one.\">Shared ×" + u + "</span>" : "");
        const pats = state.song.tracks[state.track].patterns;
        const sel = $("patSelect");
        sel.innerHTML = "<option value=\"-1\">— Empty —</option>" + pats.map((p, i) => {
            const c = usage(state.track, i);
            return "<option value=\"" + i + "\">P" + pad2(i) + " · " + p.notes.length + " note" + (p.notes.length === 1 ? "" : "s") + (c === 0 ? " · unused" : c > 1 ? " · used " + c + "×" : "") + "</option>";
        }).join("") + "<option value=\"new\">+ New pattern</option>";
        sel.value = String(idx);
        const pat = curPat();
        $("patUnique").disabled = u < 2;
        $("patClear").disabled = !pat || !pat.notes.length;
        const sc = state.song.scale || { root: 0, name: "Free" };
        $("scaleRoot").innerHTML = ROOT_NAMES.map((n, i) => "<option value=\"" + i + "\">" + n + "</option>").join("");
        $("scaleRoot").value = String(sc.root);
        $("scaleRoot").disabled = t.kind === "noise";
        $("scaleName").innerHTML = "<option value=\"Free\">Free</option>" + Object.keys(SCALES).map(k => "<option value=\"" + k + "\">" + SCALES[k].label + "</option>").join("");
        $("scaleName").value = sc.name;
        $("scaleName").disabled = t.kind === "noise";
        $("btnKb").setAttribute("aria-pressed", String(state.kb));
        $("kbOct").hidden = !state.kb || t.kind === "noise";
        $("kbBase").textContent = noteName(kbBase());
        $("kbDown").disabled = state.kbOct <= 0;
        $("kbUp").disabled = state.kbOct >= KB_OCT_MAX;
        $("toolDraw").setAttribute("aria-pressed", String(state.tool === "draw"));
        $("toolSelect").setAttribute("aria-pressed", String(state.tool === "select"));
        $("toolErase").setAttribute("aria-pressed", String(state.tool === "erase"));
        $("btnGhost").setAttribute("aria-pressed", String(state.ghost));
        $("btnGhost").disabled = t.kind === "noise";
        const songLen = !isSfx();
        $("ordRows").hidden = !songLen;
        $("ordBuild").hidden = !songLen;
        if (songLen) {
            const cur = ordRows(state.ord);
            const bar = state.song.rowsPerBeat * state.song.beatsPerBar;
            $("ordRows").innerHTML = lengthChoices(cur).map(v => "<option value=\"" + v + "\">" + v + " rows" + (v % bar ? "" : " · " + v / bar + " bar" + (v / bar === 1 ? "" : "s")) + "</option>").join("");
            $("ordRows").value = String(cur);
        }
        const sx = curSfx();
        $("sfxCtl").hidden = !sx;
        if (sx) {
            if (document.activeElement !== $("sfxName")) $("sfxName").value = sx.name;
            const lens = [2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
            if (!lens.includes(sx.rows)) lens.push(sx.rows);
            lens.sort((a, b) => a - b);
            $("sfxRows").innerHTML = lens.map(v => "<option value=\"" + v + "\">" + v + " rows</option>").join("");
            $("sfxRows").value = String(sx.rows);
            $("sfxDur").textContent = sfxSeconds(sx).toFixed(2) + " s";
        }
    }

    const G = { colW: 16, rowH: PITCH_H, lanes: [], drum: false, w: 0, h: 0, hover: null };

    function renderRoll() {
        const scroll = $("rollScroll");
        const kind = trackKind(state.track);
        G.drum = kind === "noise";
        G.lanes = G.drum ? instsOf("noise") : [];
        syncRows();
        G.colW = clamp(Math.floor((scroll.clientWidth - KEY_W) / ROWS), 12, 64);
        G.w = G.colW * ROWS;
        const availH = Math.max(120, scroll.clientHeight - RULER_H);
        if (G.drum) {
            G.rowH = clamp(Math.floor(availH / Math.max(1, G.lanes.length)), LANE_MIN, LANE_MAX);
            G.h = Math.max(availH, G.lanes.length * G.rowH);
        } else {
            G.rowH = PITCH_H;
            G.h = (NOTE_MAX + 1) * PITCH_H;
        }
        const inner = $("rollInner");
        inner.style.gridTemplateColumns = KEY_W + "px " + G.w + "px";
        inner.style.gridTemplateRows = RULER_H + "px " + G.h + "px";
        drawRuler();
        drawKeys();
        drawGrid();
        const empty = $("rollEmpty");
        let msg = "";
        if (G.drum && !G.lanes.length) msg = "Add a Noise instrument from Presets to start a beat.";
        else if (!instsOf(kind).length) msg = "There are no " + KIND_LABEL[kind] + " instruments yet. Add one from Presets to draw here.";
        else if (!curPat()) msg = "This slot is empty. Start drawing to create a new pattern for " + TRACKS[state.track].name + ", or pick an existing one from the menu above.";
        empty.hidden = !msg;
        empty.textContent = msg;
        placeHead();
    }

    function centerRoll(force) {
        if (G.drum) return;
        const scroll = $("rollScroll");
        const pat = curPat();
        const view = scroll.clientHeight - RULER_H;
        const topNote = NOTE_MAX - Math.floor(scroll.scrollTop / PITCH_H);
        const botNote = NOTE_MAX - Math.floor((scroll.scrollTop + view) / PITCH_H);
        let target;
        if (pat && pat.notes.length) {
            const visible = pat.notes.some(n => n.note <= topNote && n.note >= botNote);
            if (visible && !force) return;
            target = pat.notes.reduce((a, n) => a + n.note, 0) / pat.notes.length;
        } else {
            if (!force) return;
            target = trackKind(state.track) === "wave" ? 18 : 38;
        }
        scroll.scrollTop = Math.max(0, (NOTE_MAX - target) * PITCH_H - view / 2);
    }

    function drawRuler() {
        const cv = $("ruler");
        const ctx = prep(cv, G.w, RULER_H);
        const rpb = state.song.rowsPerBeat;
        const bar = rpb * state.song.beatsPerBar;
        ctx.fillStyle = P.panel;
        ctx.fillRect(0, 0, G.w, RULER_H);
        ctx.font = "600 10px " + P.mono;
        for (let r = 0; r < ROWS; r++) {
            const x = r * G.colW;
            if (r % rpb === 0) {
                ctx.fillStyle = r % bar === 0 ? P.ink : P.muted;
                ctx.fillRect(x, r % bar === 0 ? 0 : 10, 1, RULER_H);
                if (G.colW * rpb >= 22 || r % bar === 0) ctx.fillText(pad2(r), x + 3, 13);
            }
        }
        if (state.startRow) {
            ctx.fillStyle = P.accent;
            const x = state.startRow * G.colW;
            ctx.beginPath();
            ctx.moveTo(x, RULER_H - 7);
            ctx.lineTo(x + 6, RULER_H - 7);
            ctx.lineTo(x, RULER_H);
            ctx.fill();
        }
        ctx.fillStyle = P.lineStrong;
        ctx.fillRect(0, RULER_H - 1, G.w, 1);
    }

    function drawKeys() {
        const cv = $("keys");
        const ctx = prep(cv, KEY_W, G.h);
        const mono = P.mono;
        if (G.drum) {
            ctx.fillStyle = P.panel;
            ctx.fillRect(0, 0, KEY_W, G.h);
            ctx.font = "11px " + P.body;
            G.lanes.forEach((inst, k) => {
                const y = k * G.rowH;
                if (inst.id === state.inst) {
                    ctx.fillStyle = P.accentSoft;
                    ctx.fillRect(0, y, KEY_W, G.rowH);
                }
                if (kbHeld(k)) {
                    ctx.fillStyle = P.accent;
                    ctx.globalAlpha = 0.45;
                    ctx.fillRect(0, y, KEY_W, G.rowH);
                    ctx.globalAlpha = 1;
                }
                ctx.fillStyle = P.kind.noise;
                ctx.fillRect(0, y + 3, 3, G.rowH - 6);
                ctx.fillStyle = P.ink;
                const name = inst.name.length > 9 ? inst.name.slice(0, 8) + "…" : inst.name;
                ctx.fillText(name, 7, y + G.rowH / 2 + 4);
                ctx.fillStyle = P.line;
                ctx.fillRect(0, y + G.rowH - 1, KEY_W, 1);
            });
        } else {
            ctx.font = "10px " + mono;
            ctx.fillStyle = P.keyW;
            ctx.fillRect(0, 0, KEY_W, G.h);
            for (let n = 0; n <= NOTE_MAX; n++) {
                const y = (NOTE_MAX - n) * PITCH_H;
                if ([0, 5].includes(n % 12)) {
                    ctx.fillStyle = "#8a90a2";
                    ctx.fillRect(0, y + PITCH_H - 1, KEY_W, 1);
                }
            }
            for (let n = 0; n <= NOTE_MAX; n++) {
                const y = (NOTE_MAX - n) * PITCH_H;
                const hover = (G.hover && G.hover.pitch === n) || kbHeld(n);
                if (isBlack(n)) {
                    ctx.fillStyle = P.keyB;
                    ctx.fillRect(0, y + 1, KEY_W * 0.6, PITCH_H - 2);
                }
                if (hover) {
                    ctx.fillStyle = P.accent;
                    ctx.globalAlpha = 0.45;
                    ctx.fillRect(0, y, isBlack(n) ? KEY_W * 0.6 : KEY_W, PITCH_H);
                    ctx.globalAlpha = 1;
                }
                if (n % 12 === labelRoot() || hover) {
                    ctx.fillStyle = "#1b1e2b";
                    ctx.fillText(noteName(n), KEY_W - 26, y + PITCH_H - 3);
                }
            }
        }
        ctx.fillStyle = P.lineStrong;
        ctx.fillRect(KEY_W - 1, 0, 1, G.h);
    }

    function noteRect(n) {
        if (G.drum) {
            const lane = G.lanes.findIndex(i => i.id === n.inst);
            return { x: n.row * G.colW, y: lane * G.rowH, w: G.colW, h: G.rowH, lane };
        }
        return { x: n.row * G.colW, y: (NOTE_MAX - n.note) * PITCH_H, w: n.len * G.colW, h: PITCH_H };
    }

    const slideTo = n => clamp(n.note + (n.slide || 0), 0, NOTE_MAX);

    function drawSlide(ctx, n, color, alpha) {
        const at = Math.min(n.slideAt || 0, n.len - 1);
        const sx = (n.row + at) * G.colW;
        const xe = (n.row + n.len) * G.colW - 1;
        const x1 = n.slideLen > 0 ? Math.min(xe, (n.row + at + n.slideLen) * G.colW - 1) : xe;
        const ym = (NOTE_MAX - n.note) * PITCH_H + PITCH_H / 2;
        const yt = (NOTE_MAX - slideTo(n)) * PITCH_H + PITCH_H / 2;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.moveTo(sx, ym);
        ctx.lineTo(x1, yt);
        ctx.lineTo(x1, ym);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, ym);
        ctx.lineTo(x1, yt);
        ctx.stroke();
        if (x1 < xe) {
            ctx.beginPath();
            ctx.moveTo(x1, yt);
            ctx.lineTo(xe, yt);
            ctx.stroke();
        }
        ctx.fillRect(xe - 3, yt - PITCH_H / 2 + 2, 3, PITCH_H - 4);
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
    }

    function drawGrid() {
        const cv = $("roll");
        const ctx = prep(cv, G.w, G.h);
        const rpb = state.song.rowsPerBeat;
        const bar = rpb * state.song.beatsPerBar;
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, G.w, G.h);
        if (G.drum) {
            G.lanes.forEach((inst, k) => {
                ctx.fillStyle = k % 2 ? P.alt : P.bg;
                ctx.fillRect(0, k * G.rowH, G.w, G.rowH);
                if (inst.id === state.inst) {
                    ctx.fillStyle = P.accent;
                    ctx.globalAlpha = 0.06;
                    ctx.fillRect(0, k * G.rowH, G.w, G.rowH);
                    ctx.globalAlpha = 1;
                }
                ctx.fillStyle = P.line;
                ctx.fillRect(0, (k + 1) * G.rowH - 1, G.w, 1);
            });
        } else {
            const inScale = scaleSet();
            for (let n = 0; n <= NOTE_MAX; n++) {
                const y = (NOTE_MAX - n) * PITCH_H;
                if (inScale && !inScale.has(n % 12)) {
                    ctx.fillStyle = P.out;
                    ctx.fillRect(0, y, G.w, PITCH_H);
                } else if (isBlack(n)) {
                    ctx.fillStyle = P.alt;
                    ctx.fillRect(0, y, G.w, PITCH_H);
                }
                const octave = n % 12 === labelRoot();
                ctx.fillStyle = octave ? P.beat : P.line;
                ctx.globalAlpha = octave ? 1 : 0.45;
                ctx.fillRect(0, y + PITCH_H - 1, G.w, 1);
                ctx.globalAlpha = 1;
            }
        }
        for (let r = 0; r <= ROWS; r++) {
            const x = r * G.colW;
            if (r % bar === 0) {
                ctx.fillStyle = P.bar;
                ctx.fillRect(x, 0, 1, G.h);
            } else if (r % rpb === 0) {
                ctx.fillStyle = P.beat;
                ctx.fillRect(x, 0, 1, G.h);
            } else {
                ctx.fillStyle = P.line;
                ctx.globalAlpha = 0.35;
                ctx.fillRect(x, 0, 1, G.h);
                ctx.globalAlpha = 1;
            }
        }
        if (KB.held.size) {
            ctx.fillStyle = P.accent;
            ctx.globalAlpha = 0.24;
            for (const v of KB.held.values()) {
                if (G.drum) ctx.fillRect(0, v * G.rowH, G.w, G.rowH - 1);
                else ctx.fillRect(0, (NOTE_MAX - v) * PITCH_H, G.w, PITCH_H - 1);
            }
            ctx.globalAlpha = 1;
        }
        if (G.hover && !G.drum && state.tool === "draw" && !G.drag && !G.hoverMod) {
            const inst = curInst();
            if (inst && inst.type === trackKind(state.track) && !noteAt(G.hover.row, G.hover.pitch)) {
                ctx.strokeStyle = P.ch[state.track];
                ctx.globalAlpha = 0.6;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(G.hover.row * G.colW + 0.5, (NOTE_MAX - G.hover.pitch) * PITCH_H + 0.5, Math.min(state.drawLen, ROWS - G.hover.row) * G.colW - 1, PITCH_H - 1);
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }
        if (G.hover && G.drum && state.tool === "draw" && G.hover.lane >= 0 && G.hover.lane < G.lanes.length && !G.drag && !G.hoverMod && !hitIn(G.hover.row, G.hover.lane)) {
            ctx.fillStyle = P.ch[3];
            ctx.globalAlpha = 0.18;
            ctx.fillRect(G.hover.row * G.colW + 2, G.hover.lane * G.rowH + 3, G.colW - 4, G.rowH - 6);
            ctx.globalAlpha = 1;
        }
        if (state.ghost && !G.drum) {
            [0, 1, 2].forEach(t => {
                if (t === state.track) return;
                const pat = patAt(t, state.ord);
                if (!pat) return;
                ctx.strokeStyle = P.ch[t];
                ctx.fillStyle = P.ch[t];
                for (const n of pat.notes) {
                    const r = { x: n.row * G.colW, y: (NOTE_MAX - n.note) * PITCH_H, w: n.len * G.colW };
                    ctx.globalAlpha = 0.12;
                    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, PITCH_H - 2);
                    ctx.globalAlpha = 0.5;
                    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, PITCH_H - 3);
                    if (n.slide) {
                        drawSlide(ctx, n, P.ch[t], 0.35);
                        ctx.strokeStyle = P.ch[t];
                        ctx.fillStyle = P.ch[t];
                        ctx.globalAlpha = 0.12;
                    }
                }
            });
            ctx.globalAlpha = 1;
        }
        const pat = curPat();
        if (pat) {
            const color = P.ch[state.track];
            ctx.font = "600 10px " + P.mono;
            for (const n of pat.notes) {
                const r = noteRect(n);
                if (G.drum && r.lane < 0) continue;
                const inst = instById(n.inst);
                const sel = isSel(n);
                ctx.fillStyle = color;
                if (G.drum) {
                    const pad = 3;
                    const lvl = inst ? Math.max(0.35, inst.vol / 15) : 1;
                    ctx.globalAlpha = lvl;
                    roundRect(ctx, r.x + 2, r.y + pad, r.w - 4, r.h - pad * 2, 3);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    if (inst && n.note !== inst.note) {
                        ctx.fillStyle = P.panel;
                        ctx.fillRect(r.x + r.w / 2 - 1.5, r.y + r.h / 2 - 1.5, 3, 3);
                    }
                } else {
                    roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 2);
                    ctx.fill();
                    if (inst && r.w >= 22) {
                        ctx.fillStyle = P.panel;
                        const label = pad2(instNum(inst)) + (r.w > 70 ? " " + inst.name : "");
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(r.x + 2, r.y, r.w - 6, r.h);
                        ctx.clip();
                        ctx.fillText(label, r.x + 4, r.y + PITCH_H - 3.5);
                        ctx.restore();
                    }
                    if (n.swell && r.w >= 12) {
                        ctx.strokeStyle = P.panel;
                        ctx.globalAlpha = 0.75;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(r.x + 3, r.y + r.h - 3);
                        ctx.lineTo(r.x + r.w / 2, r.y + 3);
                        ctx.lineTo(r.x + r.w - 5, r.y + r.h - 3);
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                    if (r.w >= 10) {
                        ctx.fillStyle = P.panel;
                        ctx.globalAlpha = 0.5;
                        ctx.fillRect(r.x + r.w - 4, r.y + 3, 1, r.h - 6);
                        ctx.globalAlpha = 1;
                    }
                }
                if (n.fx) {
                    ctx.fillStyle = P.accent;
                    ctx.globalAlpha = 1;
                    ctx.beginPath();
                    ctx.moveTo(r.x + 1, r.y + 1);
                    ctx.lineTo(r.x + 7, r.y + 1);
                    ctx.lineTo(r.x + 1, r.y + 7);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
                if (sel) {
                    ctx.strokeStyle = P.accent;
                    ctx.lineWidth = 2;
                    if (G.drum) roundRect(ctx, r.x + 1, r.y + 2, r.w - 2, r.h - 4, 3);
                    else roundRect(ctx, r.x, r.y, r.w, r.h, 2);
                    ctx.stroke();
                    ctx.lineWidth = 1;
                }
            }
        }
        if (pat) {
            for (const n of pat.notes) if (n.slide) drawSlide(ctx, n, isSel(n) ? P.accent : P.ch[state.track], 0.9);
        }
        if (G.drag && G.drag.mode === "box") {
            const d = G.drag;
            const x = Math.min(d.x0, d.x1);
            const y = Math.min(d.y0, d.y1);
            const w = Math.abs(d.x1 - d.x0);
            const h = Math.abs(d.y1 - d.y0);
            ctx.fillStyle = P.accent;
            ctx.globalAlpha = 0.1;
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = P.accent;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(x + 0.5, y + 0.5, w, h);
            ctx.setLineDash([]);
        }
    }

    function placeHead() {
        const h = $("rollHead");
        if (!state.playing || state.playOrd !== state.ord) {
            h.style.display = "none";
            return;
        }
        h.style.display = "block";
        h.style.height = G.h + "px";
        h.style.width = G.colW + "px";
        h.style.transform = "translate3d(" + (KEY_W + Math.floor(state.playRow) * G.colW) + "px, " + RULER_H + "px, 0)";
    }

    function roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    function noteAt(row, pitch) {
        const pat = curPat();
        if (!pat) return null;
        return pat.notes.find(n => n.note === pitch && row >= n.row && row < n.row + n.len) || null;
    }

    function hitIn(row, lane) {
        const pat = curPat();
        if (!pat || lane < 0 || lane >= G.lanes.length) return null;
        return pat.notes.find(n => n.row === row && n.inst === G.lanes[lane].id) || null;
    }

    function noteUnder(p) {
        return G.drum ? hitIn(p.row, p.lane) : noteAt(p.row, p.pitch);
    }

    function resolve(pat, note) {
        if (G.drum) {
            pat.notes = pat.notes.filter(n => n === note || n.row !== note.row);
            return;
        }
        const s = note.row;
        const e = note.row + note.len;
        pat.notes = pat.notes.filter(n => n === note || n.row < s || n.row >= e);
        for (const n of pat.notes) if (n !== note && n.row < s && n.row + n.len > s) n.len = s - n.row;
        pat.notes.sort((a, b) => a.row - b.row);
    }

    function resolveMany(pat, notes) {
        if (!pat) return;
        notes.slice().sort((a, b) => a.row - b.row).forEach(n => {
            if (pat.notes.includes(n)) resolve(pat, n);
        });
    }

    function liveSel() {
        const pat = curPat();
        state.sel = pat ? state.sel.filter(n => pat.notes.includes(n)) : [];
        return state.sel;
    }

    const isSel = n => state.sel.includes(n);
    const noteEnd = n => n.row + (G.drum ? 1 : n.len);
    const pitchMax = () => G.drum ? NOISE_MAX : NOTE_MAX;
    const noun = (count) => (G.drum ? "hit" : "note") + (count === 1 ? "" : "s");

    function rollPos(e) {
        const r = $("roll").getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const row = clamp(Math.floor(x / G.colW), 0, ROWS - 1);
        if (G.drum) return { x, y, row, lane: Math.floor(y / G.rowH) };
        return { x, y, row, pitch: clamp(NOTE_MAX - Math.floor(y / PITCH_H), 0, NOTE_MAX) };
    }

    function needInstrument() {
        const kind = trackKind(state.track);
        const inst = curInst();
        if (inst && inst.type === kind) return inst;
        const any = instsOf(kind)[0];
        if (any) {
            state.inst = any.id;
            return any;
        }
        toast("No " + KIND_LABEL[kind] + " instruments yet. Add one from Presets first.");
        return null;
    }

    function pickLaneInst(inst) {
        if (!inst || state.inst === inst.id) return;
        state.inst = inst.id;
        state.lastInst.noise = inst.id;
        renderInstList();
        renderEditor();
        renderHint();
        drawKeys();
    }

    function boxNotes(d) {
        const pat = curPat();
        if (!pat) return [];
        const x0 = Math.min(d.x0, d.x1);
        const x1 = Math.max(d.x0, d.x1);
        const y0 = Math.min(d.y0, d.y1);
        const y1 = Math.max(d.y0, d.y1);
        return pat.notes.filter(n => {
            const r = noteRect(n);
            if (G.drum && r.lane < 0) return false;
            return r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0;
        });
    }

    function rollDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        hideMenu();
        const cv = $("roll");
        const p = rollPos(e);
        const add = e.shiftKey || e.ctrlKey || e.metaKey;
        G.drag = null;
        cv.setPointerCapture(e.pointerId);
        if (state.tool === "erase" || e.altKey) {
            checkpoint();
            G.drag = { mode: "erase", erased: 0 };
            eraseAt(p);
            return;
        }
        if (G.slideKey && !G.drum) {
            const target = noteUnder(p);
            if (!target) return;
            checkpoint();
            if (!isSel(target)) state.sel = [target];
            G.drag = { mode: "slide", note: target, orig: target.slide || 0, origAt: target.slideAt || 0, at: clamp(p.row - target.row, 0, target.len - 1), heard: slideTo(target) };
            drawGrid();
            renderInspector();
            return;
        }
        const hit = noteUnder(p);
        if (hit) {
            if (add) {
                state.sel = isSel(hit) ? state.sel.filter(n => n !== hit) : state.sel.concat(hit);
                drawGrid();
                renderInspector();
                return;
            }
            const wasSel = isSel(hit);
            if (!wasSel) state.sel = [hit];
            checkpoint();
            const r = noteRect(hit);
            const edge = !G.drum && p.x >= r.x + r.w - 6 && r.w >= 12;
            const orig = state.sel.map(n => ({ n, row: n.row, note: n.note, len: n.len }));
            G.drag = { mode: edge ? "resize" : "move", note: hit, orig, startRow: p.row, startPitch: p.pitch, moved: false, heard: hit.note, wasSel };
            if (!edge) preview(instById(hit.inst), hit.note, state.track, effFx(hit));
            if (G.drum) pickLaneInst(G.lanes[p.lane]);
            drawGrid();
            renderInspector();
            return;
        }
        if (state.tool === "select" || add) {
            G.drag = { mode: "box", x0: p.x, y0: p.y, x1: p.x, y1: p.y, base: add ? state.sel.slice() : [] };
            if (!add) state.sel = [];
            drawGrid();
            renderInspector();
            return;
        }
        if (G.drum) {
            if (p.lane < 0 || p.lane >= G.lanes.length) return;
            const laneInst = G.lanes[p.lane];
            checkpoint();
            const pat = ensurePattern();
            const n = { row: p.row, len: 1, note: laneInst.note, inst: laneInst.id, fx: null };
            pat.notes.push(n);
            resolve(pat, n);
            state.sel = [n];
            G.drag = { mode: "paint", lane: p.lane, lastRow: p.row, painted: [n] };
            preview(laneInst, n.note, 3);
            pickLaneInst(laneInst);
            empty();
            drawKeys();
            drawGrid();
            renderInspector();
            return;
        }
        const inst = needInstrument();
        if (!inst) return;
        checkpoint();
        const pat = ensurePattern();
        const n = { row: p.row, len: Math.min(state.drawLen, ROWS - p.row), note: p.pitch, inst: inst.id, fx: null };
        pat.notes.push(n);
        state.sel = [n];
        G.drag = { mode: "create", note: n };
        preview(inst, p.pitch, state.track);
        empty();
        drawGrid();
        renderInspector();
    }

    function empty() {
        $("rollEmpty").hidden = true;
    }

    function eraseAt(p) {
        const pat = curPat();
        if (!pat) return;
        const n = noteUnder(p);
        if (!n) return;
        pat.notes = pat.notes.filter(x => x !== n);
        state.sel = state.sel.filter(x => x !== n);
        G.drag.erased++;
        drawGrid();
    }

    function rollMove(e) {
        const p = rollPos(e);
        const d = G.drag;
        if (!d) {
            const prev = G.hover;
            const mod = e.shiftKey || e.ctrlKey || e.metaKey || e.altKey;
            const modChanged = mod !== !!G.hoverMod;
            G.hoverMod = mod;
            G.hover = p;
            if (modChanged) {
                setRollCursor(p, e);
                drawGrid();
            }
            if (!prev || prev.row !== p.row || prev.pitch !== p.pitch || prev.lane !== p.lane) {
                setRollCursor(p, e);
                drawGrid();
                if (!G.drum) drawKeys();
            }
            return;
        }
        G.hover = p;
        if (d.mode === "slide") {
            const n = d.note;
            const off = clamp(p.pitch, 0, NOTE_MAX) - n.note;
            if (off) {
                n.slide = off;
                if (d.at) n.slideAt = d.at;
                else delete n.slideAt;
            } else {
                delete n.slide;
                delete n.slideAt;
                delete n.slideLen;
            }
            if (slideTo(n) !== d.heard) {
                d.heard = slideTo(n);
                preview(instById(n.inst), d.heard, state.track);
            }
            drawGrid();
            drawKeys();
            return;
        }
        if (d.mode === "erase") {
            eraseAt(p);
            return;
        }
        if (d.mode === "box") {
            d.x1 = p.x;
            d.y1 = p.y;
            const hits = boxNotes(d);
            state.sel = d.base.concat(hits.filter(n => !d.base.includes(n)));
            drawGrid();
            return;
        }
        if (d.mode === "paint") {
            if (p.row === d.lastRow) return;
            const step = p.row > d.lastRow ? 1 : -1;
            const pat = curPat();
            const inst = G.lanes[d.lane];
            for (let r = d.lastRow + step; r !== p.row + step; r += step) {
                const n = { row: r, len: 1, note: inst.note, inst: inst.id, fx: null };
                pat.notes.push(n);
                resolve(pat, n);
                d.painted.push(n);
            }
            d.lastRow = p.row;
            state.sel = d.painted.filter(n => pat.notes.includes(n));
            preview(inst, inst.note, 3);
            drawGrid();
            return;
        }
        const n = d.note;
        if (d.mode === "create") {
            n.len = clamp(p.row - n.row + 1, 1, ROWS - n.row);
        } else if (d.mode === "resize") {
            const base = d.orig.find(o => o.n === n);
            const delta = clamp(p.row - n.row + 1, 1, ROWS - n.row) - base.len;
            for (const o of d.orig) o.n.len = clamp(o.len + delta, 1, ROWS - o.n.row);
            if (delta) d.moved = true;
        } else if (d.mode === "move") {
            const minRow = Math.min(...d.orig.map(o => o.row));
            const maxEnd = Math.max(...d.orig.map(o => o.row + (G.drum ? 1 : o.len)));
            const dr = clamp(p.row - d.startRow, -minRow, ROWS - maxEnd);
            if (G.drum) {
                for (const o of d.orig) o.n.row = o.row + dr;
                if (d.orig.length === 1 && p.lane >= 0 && p.lane < G.lanes.length && G.lanes[p.lane].id !== n.inst) {
                    n.inst = G.lanes[p.lane].id;
                    n.note = G.lanes[p.lane].note;
                    preview(G.lanes[p.lane], n.note, 3);
                    d.moved = true;
                }
            } else {
                const lo = Math.min(...d.orig.map(o => o.note));
                const hi = Math.max(...d.orig.map(o => o.note));
                const dp = clamp(p.pitch - d.startPitch, -lo, NOTE_MAX - hi);
                for (const o of d.orig) {
                    o.n.row = o.row + dr;
                    o.n.note = o.note + dp;
                }
                if (n.note !== d.heard) {
                    d.heard = n.note;
                    preview(instById(n.inst), n.note, state.track, effFx(n));
                }
            }
            if (dr || d.orig.some(o => o.n.note !== o.note)) d.moved = true;
        }
        drawGrid();
        drawKeys();
        renderInspector();
    }

    function rollUp() {
        const d = G.drag;
        if (!d) return;
        G.drag = null;
        const pat = curPat();
        if (d.mode === "slide") {
            const now = d.note.slide || 0;
            if (now === d.orig && (d.note.slideAt || 0) === d.origAt) history.undo.pop();
            else status(now ? "Slides " + (now > 0 ? "up " : "down ") + Math.abs(now) + " semitone" + (Math.abs(now) === 1 ? "" : "s") + " to " + noteName(slideTo(d.note)) + "." : "Slide removed.");
            afterEdit();
            return;
        }
        if (d.mode === "box") {
            drawGrid();
            renderInspector();
            return;
        }
        if (pat) {
            if (d.mode === "create") {
                resolve(pat, d.note);
                state.drawLen = d.note.len;
            } else if (d.mode === "resize" || d.mode === "move") {
                resolveMany(pat, d.orig.map(o => o.n));
                if (d.mode === "resize" && d.moved) state.drawLen = d.note.len;
            }
        }
        if (d.mode === "erase" && !d.erased) history.undo.pop();
        if ((d.mode === "move" || d.mode === "resize") && !d.moved) {
            history.undo.pop();
            if (d.wasSel && state.sel.length > 1) state.sel = [d.note];
        }
        liveSel();
        afterEdit();
    }

    function setRollCursor(p, e) {
        const cv = $("roll");
        if (state.tool === "erase" || (e && e.altKey)) {
            cv.style.cursor = "not-allowed";
            return;
        }
        const n = noteUnder(p);
        if (!n) {
            cv.style.cursor = state.tool === "select" || (G.slideKey && !G.drum) || (e && e.shiftKey) ? "default" : G.drum ? "pointer" : "crosshair";
            return;
        }
        const r = noteRect(n);
        if (G.slideKey && !G.drum) {
            cv.style.cursor = "ns-resize";
            return;
        }
        cv.style.cursor = !G.drum && p.x >= r.x + r.w - 6 && r.w >= 12 ? "ew-resize" : "grab";
    }

    function afterEdit() {
        scheduleAutosave();
        renderTop();
        renderArrange();
        renderPatBar();
        renderRoll();
        renderInspector();
        renderEditor();
    }

    function applySel(fn, msg) {
        const sel = liveSel();
        if (!sel.length) return;
        checkpoint();
        sel.forEach(fn);
        resolveMany(curPat(), sel);
        liveSel();
        afterEdit();
        if (msg) status(msg);
    }

    function deleteSel() {
        const sel = liveSel();
        if (!sel.length) return;
        checkpoint();
        const pat = curPat();
        pat.notes = pat.notes.filter(n => !sel.includes(n));
        state.sel = [];
        afterEdit();
        status("Deleted " + sel.length + " " + noun(sel.length) + ".");
    }

    function selectAll() {
        const pat = curPat();
        state.sel = pat ? pat.notes.slice() : [];
        drawGrid();
        renderInspector();
    }

    function selectSameInst(id) {
        const pat = curPat();
        state.sel = pat ? pat.notes.filter(n => n.inst === id) : [];
        drawGrid();
        renderInspector();
    }

    function clearSel() {
        state.sel = [];
        drawGrid();
        renderInspector();
    }

    function transposeSel(delta) {
        applySel(n => {
            n.note = clamp(n.note + delta, 0, pitchMax());
        });
        const sel = liveSel();
        if (sel.length) preview(instById(sel[0].inst), sel[0].note, state.track);
    }

    function nudgeSel(delta) {
        const sel = liveSel();
        if (!sel.length) return;
        const minRow = Math.min(...sel.map(n => n.row));
        const maxEnd = Math.max(...sel.map(noteEnd));
        const d = clamp(delta, -minRow, ROWS - maxEnd);
        if (!d) {
            status("The selection is already at the " + (delta < 0 ? "start" : "end") + " of the pattern.");
            return;
        }
        checkpoint("nudge");
        sel.forEach(n => {
            n.row += d;
        });
        resolveMany(curPat(), sel);
        liveSel();
        afterEdit();
    }

    function copySel(quiet) {
        const sel = liveSel();
        if (!sel.length) return false;
        const min = Math.min(...sel.map(n => n.row));
        state.clip = {
            kind: trackKind(state.track),
            notes: sel.map(n => ({ dr: n.row - min, len: n.len, note: n.note, inst: n.inst, fx: n.fx ? { code: n.fx.code, param: n.fx.param } : null, swell: !!n.swell, slide: n.slide || 0, slideAt: n.slideAt || 0, slideLen: n.slideLen || 0 })),
            span: Math.max(...sel.map(noteEnd)) - min
        };
        if (!quiet) status("Copied " + sel.length + " " + noun(sel.length) + ".");
        return true;
    }

    function canPaste() {
        return !!state.clip && state.clip.kind === trackKind(state.track);
    }

    function pasteRow() {
        if (G.hover) return G.hover.row;
        const sel = liveSel();
        if (sel.length) return Math.min(ROWS - 1, Math.max(...sel.map(noteEnd)));
        return state.startRow;
    }

    function pasteAt(row) {
        if (!state.clip) return;
        if (!canPaste()) {
            toast("Those notes came from a " + KIND_LABEL[state.clip.kind] + " track, so they can only be pasted onto one.");
            return;
        }
        checkpoint();
        const pat = ensurePattern();
        const added = [];
        let dropped = 0;
        for (const c of state.clip.notes) {
            const r = row + c.dr;
            if (r >= ROWS || !instById(c.inst)) {
                dropped++;
                continue;
            }
            const n = { row: r, len: Math.min(c.len, ROWS - r), note: c.note, inst: c.inst, fx: c.fx ? { code: c.fx.code, param: c.fx.param } : null };
            if (c.swell) n.swell = true;
            if (c.slide) n.slide = c.slide;
            if (c.slide && c.slideAt) n.slideAt = Math.min(c.slideAt, n.len - 1);
            if (c.slide && c.slideLen) n.slideLen = c.slideLen;
            pat.notes.push(n);
            added.push(n);
        }
        resolveMany(pat, added);
        state.sel = added.filter(n => pat.notes.includes(n));
        afterEdit();
        status("Pasted " + state.sel.length + " " + noun(state.sel.length) + " at row " + pad2(row) + ".");
        if (dropped) toast(dropped + " " + noun(dropped) + " didn't fit before the end of the pattern.");
    }

    function cutSel() {
        if (copySel(true)) {
            const count = state.clip.notes.length;
            deleteSel();
            status("Cut " + count + " " + noun(count) + ".");
        }
    }

    function duplicateSel() {
        const sel = liveSel();
        if (!sel.length) return;
        const start = Math.min(...sel.map(n => n.row));
        copySel(true);
        const at = start + state.clip.span;
        if (at >= ROWS) {
            toast("There's no room after the selection in this pattern.");
            return;
        }
        pasteAt(at);
    }

    function stretchSel() {
        const pat = curPat();
        applySel(n => {
            const next = pat.notes.filter(x => x.row > n.row).reduce((m, x) => Math.min(m, x.row), ROWS);
            n.len = Math.max(1, next - n.row);
        });
    }

    function quietData(inst) {
        const q = clone(inst);
        delete q.id;
        delete q.type;
        delete q.name;
        if (inst.type === "wave") q.level = q.level ? Math.min(3, q.level + 1) : 0;
        else {
            q.vol = q.vol > 1 ? Math.round(q.vol / 2) : q.vol;
            if (inst.envDir === "up" && inst.envPace) q.fadeTo = Math.min(15, Math.max(q.vol + 1, Math.round(fadeCap(inst) / 2)));
        }
        return q;
    }

    function stable(v) {
        if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
        if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
        return JSON.stringify(v === undefined ? null : v);
    }

    function instData(inst) {
        const d = clone(inst);
        delete d.id;
        delete d.type;
        delete d.name;
        return stable(d);
    }

    function echoPlan(insts, kind) {
        const plan = insts.map(src => {
            const data = quietData(src);
            const key = stable(data);
            const found = instsOf(kind).find(i => i !== src && instData(i) === key) || null;
            return { src, data, found };
        });
        const fresh = plan.filter(p => !p.found).length;
        return instsOf(kind).length + fresh > MAX_INST ? null : plan;
    }

    function slotPat(t, o) {
        const idx = patIndex(t, o);
        if (idx >= 0) return state.song.tracks[t].patterns[idx];
        const pats = state.song.tracks[t].patterns;
        const pat = { notes: [] };
        pats.push(pat);
        state.song.order[o][t] = pats.length - 1;
        return pat;
    }

    function echoSel(other, delay) {
        const sel = liveSel().slice().sort((a, b) => a.row - b.row);
        const kind = trackKind(state.track);
        if (!sel.length || kind === "noise" || (other && kind !== "pulse")) return;
        const srcs = [...new Set(sel.map(n => n.inst))].map(instById).filter(Boolean);
        const plan = echoPlan(srcs, kind);
        if (!plan) {
            toast("There's no room for an echo instrument: hUGETracker allows 15 " + KIND_LABEL[kind] + " instruments per song.");
            return;
        }
        const dest = other ? (state.track === 0 ? 1 : 0) : state.track;
        const next = other && !isSfx() && state.ord + 1 < state.song.order.length ? state.ord + 1 : -1;
        const orig = curPat().notes.slice();
        const places = [];
        let lost = 0;
        let cut = 0;
        for (const n of sel) {
            const at = n.row + delay;
            if (other) {
                if (at < ROWS) places.push({ n, o: state.ord, row: at, len: Math.min(n.len, ROWS - at) });
                else if (next >= 0) places.push({ n, o: next, row: at - ROWS, len: n.len });
                else lost++;
                continue;
            }
            const nextRow = orig.filter(x => x !== n && x.row > n.row).reduce((m, x) => Math.min(m, x.row), ROWS);
            if (at >= nextRow) {
                lost++;
                continue;
            }
            if (n.len > delay) cut++;
            places.push({ n, o: state.ord, row: at, len: Math.min(n.len, nextRow - at) });
        }
        if (!places.length) {
            toast(other ? "None of these notes has room for an echo before the end." : "There's no gap after these notes for an echo " + delay + " row" + (delay === 1 ? "" : "s") + " later. Try a shorter delay, or echo onto the other pulse track.");
            return;
        }
        checkpoint();
        const map = new Map();
        const names = [];
        for (const p of plan) {
            const inst = p.found || addInstrument(kind, { name: (p.src.name + " echo").slice(0, 32), data: p.data }, true);
            map.set(p.src.id, inst.id);
            if (!names.includes(inst.name)) names.push(inst.name);
        }
        const groups = new Map();
        for (const p of places) {
            const pat = slotPat(dest, p.o);
            const e = { row: p.row, len: p.len, note: p.n.note, inst: map.get(p.n.inst) || p.n.inst, fx: p.n.fx ? { code: p.n.fx.code, param: p.n.fx.param } : null };
            if (p.n.swell) e.swell = true;
            if (p.n.slide) e.slide = p.n.slide;
            if (p.n.slide && p.n.slideAt) e.slideAt = Math.min(p.n.slideAt, Math.max(0, e.len - 1));
            if (p.n.slide && p.n.slideLen) e.slideLen = p.n.slideLen;
            pat.notes.push(e);
            if (!groups.has(pat)) groups.set(pat, []);
            groups.get(pat).push(e);
        }
        groups.forEach((notes, pat) => resolveMany(pat, notes));
        const added = places.length;
        liveSel();
        afterEdit();
        renderInstList();
        const where = other ? TRACKS[state.track === 0 ? 1 : 0].name : "this track";
        status("Added " + added + " echo" + (added === 1 ? "" : "es") + " on " + where + ", " + delay + " row" + (delay === 1 ? "" : "s") + " later, using " + names.join(", ") + ". Change " + (names.length === 1 ? "that instrument's" : "those instruments'") + " volume to make the echo louder or quieter." +
            (cut ? " " + cut + " longer note" + (cut === 1 ? " was" : "s were") + " shortened to make room." : "") + (lost ? " " + lost + " didn't fit." : ""));
    }

    function echoMenu(kind) {
        const rpb = state.song.rowsPerBeat;
        const delays = [1, 2, 3];
        if (rpb > 3) delays.push(rpb);
        const label = d => (d === rpb ? "1 beat later (" + d + " rows)" : d + " row" + (d === 1 ? "" : "s") + " later");
        const items = [];
        if (kind === "pulse") {
            items.push({ head: "On " + TRACKS[state.track === 0 ? 1 : 0].name });
            delays.forEach(d => items.push({ label: label(d), action: () => echoSel(true, d) }));
            items.push({ sep: true });
        }
        items.push({ head: "On this track, in the gaps" });
        delays.forEach(d => items.push({ label: label(d), action: () => echoSel(false, d) }));
        return items;
    }

    const VOLUMES = [{ label: "100%", y: 15 }, { label: "75%", y: 11 }, { label: "50%", y: 8 }, { label: "25%", y: 4 }, { label: "12%", y: 2 }];
    const FX_DEFAULT = { 0x0: 0x47, 0x4: 0x43, 0xc: 0x08, 0x3: 0x20, 0x7: 0x02, 0xe: 0x02, 0x5: 0x77, 0x8: 0xff };

    function fxDefault(code) {
        return FX_DEFAULT[code] !== undefined ? FX_DEFAULT[code] : 0x01;
    }

    function setSwell(on) {
        applySel(n => {
            if (on) n.swell = true;
            else delete n.swell;
        }, on ? "Swell on: these notes fade in and out over their length when the song plays." : "Swell off.");
    }

    const SLIDES = [[1, "a semitone"], [2, "a tone"], [3, "a minor third"], [4, "a major third"], [5, "a fourth"], [7, "a fifth"], [12, "an octave"]];

    function setSlide(off) {
        applySel(n => {
            const v = clamp(n.note + off, 0, NOTE_MAX) - n.note;
            if (off && v) n.slide = v;
            else {
                delete n.slide;
                delete n.slideAt;
                delete n.slideLen;
            }
        }, off ? "Slide set: " + (off > 0 ? "up " : "down ") + Math.abs(off) + " semitone" + (Math.abs(off) === 1 ? "" : "s") + "." : "Slide removed.");
    }

    function slideMenu(sel) {
        const item = (off, label) => ({ label, checked: sel.every(n => (n.slide || 0) === off), action: () => setSlide(off) });
        return [{ head: "Slide up" }].concat(SLIDES.map(s => item(s[0], "Up " + s[1])), [{ head: "Slide down" }], SLIDES.map(s => item(-s[0], "Down " + s[1])), [{ sep: true }, { label: "No slide", disabled: !sel.some(n => n.slide), action: () => setSlide(0) }]);
    }

    function pitchMoves(sub) {
        return !!(sub && sub.rows.some(r => typeof r.note === "number" || (r.fx && [0x0, 0x1, 0x2, 0x4].includes(r.fx.code) && (r.fx.code || r.fx.param))));
    }

    function slideIssues(sel) {
        const out = [];
        const slid = sel.filter(n => n.slide);
        if (!slid.length) return out;
        if (speedNow() < 2) out.push("Slides need a speed of 2 or more: the driver moves the pitch on every tick except a row's first, so at speed 1 nothing moves.");
        const moving = [...new Set(slid.map(n => instById(n.inst)).filter(i => i && pitchMoves(i.sub)).map(i => i.name))];
        if (moving.length) out.push(moving.join(", ") + (moving.length === 1 ? " has" : " have") + " a subpattern that moves the pitch (arpeggio or vibrato), which pulls the note back to its own pitch and fights the slide.");
        if (slid.some(n => n.fx)) out.push("The slide uses the effect column, so the note's own effect stops where the slide starts.");
        if (slid.some(n => Math.min(n.slideLen || n.len, n.len - Math.min(n.slideAt || 0, n.len - 1)) < 2)) out.push("A slide that lasts one row can't land exactly on the target; start it earlier or make the note longer.");
        return out;
    }

    function swellIssue(n) {
        const inst = instById(n.inst);
        if (!inst || UGE.swellPlan(n, inst.type, inst, speedNow(), ROWS)) return "";
        if (inst.type === "wave") return inst.level ? "Swell needs a note at least 2 rows long." : "This instrument is muted, so there's nothing to swell.";
        if (inst.envPace) return "Swell needs an instrument whose envelope is set to Hold (" + inst.name + " fades on its own).";
        return "Swell needs a note at least 3 rows long.";
    }

    function setFx(code, param) {
        applySel(n => {
            n.fx = code === null ? null : { code, param };
        }, code === null ? "Effects removed." : "Effect " + hex(code, 1) + hex(param, 2) + " set.");
    }

    function tipsHtml(kind) {
        return "<ul class=\"tips\">" +
            (kind === "noise"
                ? "<li>Each lane is one noise instrument. Click a lane to place a hit, drag to paint.</li><li>The noise channel plays one sound at a time, so a new hit replaces any other hit on that row.</li>"
                : "<li>Click to place a note with the selected instrument. Drag right to make it longer.</li><li>Drag a note to move it, or its right edge to resize.</li><li>Each channel plays one note at a time. Overlapping notes are trimmed.</li>") +
            "<li>Shift-drag, or the Select tool, draws a box to select several. Shift- or Ctrl-click adds or removes one.</li>" +
            "<li>Right-click for options. Alt-click or the Erase tool deletes.</li>" +
            "<li><span class=\"kbd\">Space</span> play · <span class=\"kbd\">1</span>–<span class=\"kbd\">4</span> tracks · <span class=\"kbd\">D</span> <span class=\"kbd\">M</span> <span class=\"kbd\">E</span> tools</li>" +
            "<li><span class=\"kbd\">`</span> keyboard piano: the letter and number rows play " + (kind === "noise" ? "the drum lanes" : "the chosen scale") + " (and take over D, M, E, S and 1–4 until you press <span class=\"kbd\">`</span> again).</li>" +
            (kind === "noise" ? "" : "<li>Select notes and pick Echo (right-click or the note panel) to add quieter repeats a few rows later.</li>") +
            (kind === "noise" ? "" : "<li>Hold <span class=\"kbd\">S</span> and drag a note up or down to make it slide to that pitch. Click partway along a note to slide just its tail.</li>") +
            "<li><span class=\"kbd\">F1</span> or <b>?</b> opens the full guide.</li>" +
            "<li><span class=\"kbd\">Ctrl</span>+<span class=\"kbd\">A</span> <span class=\"kbd\">C</span> <span class=\"kbd\">X</span> <span class=\"kbd\">V</span> <span class=\"kbd\">D</span> select, copy, cut, paste, duplicate · <span class=\"kbd\">↑↓</span> transpose · <span class=\"kbd\">←→</span> nudge</li>" +
            "</ul>";
    }

    function nibSelect(f, v, label) {
        return "<label class=\"field\"><span>" + label + "</span><select data-f=\"" + f + "\">" + (v < 0 ? "<option value=\"-1\" selected>–</option>" : "") +
            Array.from({ length: 16 }, (_, k) => "<option value=\"" + k + "\"" + (k === v ? " selected" : "") + ">" + hex(k, 1) + "</option>").join("") + "</select></label>";
    }

    function renderInspector() {
        const el = $("inspector");
        const sel = liveSel();
        const kind = trackKind(state.track);
        const title = kind === "noise" ? "Drum hit" : "Note";
        if (!sel.length) {
            el.innerHTML = "<p class=\"label\">" + title + "</p>" + tipsHtml(kind);
            return;
        }
        const one = sel.length === 1 ? sel[0] : null;
        const insts = instsOf(kind);
        const sameInst = sel.every(n => n.inst === sel[0].inst);
        const modeOf = n => n.fx ? String(n.fx.code) : "";
        const modes = new Set(sel.map(modeOf));
        const mode = modes.size === 1 ? [...modes][0] : "keep";
        const effs = sel.map(effFx);
        const effCodes = new Set(effs.map(f => f ? f.code : -1));
        const fxCode = effCodes.size === 1 ? [...effCodes][0] : -2;
        const fxDef = fxCode >= 0 ? FX.find(f => f.code === fxCode) : null;
        let h;
        if (one) {
            h = "<p class=\"label\">" + title + "</p>";
            if (kind === "noise") {
                h += "<label class=\"field\"><span>Pitch <b data-out=\"inote\">" + noteName(one.note) + "</b></span><input type=\"range\" data-f=\"note\" min=\"0\" max=\"" + NOISE_MAX + "\" value=\"" + one.note + "\"></label>";
            } else {
                let opts = "";
                for (let v = NOTE_MAX; v >= 0; v--) opts += "<option value=\"" + v + "\"" + (v === one.note ? " selected" : "") + ">" + noteName(v) + "</option>";
                h += "<label class=\"field\"><span>Pitch</span><select data-f=\"note\">" + opts + "</select></label>";
            }
        } else {
            const rows = pad2(Math.min(...sel.map(n => n.row))) + "–" + pad2(Math.max(...sel.map(n => noteEnd(n) - 1)));
            h = "<p class=\"label\">" + sel.length + " " + noun(sel.length) + " selected</p><p class=\"hint\">Rows " + rows + ". Changes apply to all of them.</p>";
            h += "<div class=\"field\"><span>" + (kind === "noise" ? "Pitch" : "Transpose") + "</span><div class=\"seg\" role=\"group\">" +
                [[-12, "−12"], [-1, "−1"], [1, "+1"], [12, "+12"]].map(t => "<button type=\"button\" data-f=\"tr\" data-v=\"" + t[0] + "\">" + t[1] + "</button>").join("") + "</div></div>";
        }
        h += "<label class=\"field\"><span>Instrument</span><select data-f=\"inst\">" + (sameInst ? "" : "<option value=\"\" selected>— mixed —</option>") +
            insts.map((i, k) => "<option value=\"" + i.id + "\"" + (sameInst && i.id === sel[0].inst ? " selected" : "") + ">" + pad2(k + 1) + " · " + esc(i.name) + "</option>").join("") + "</select></label>";
        if (one) {
            h += "<div class=\"two\"><label class=\"field\"><span>Row</span><input type=\"number\" data-f=\"row\" min=\"0\" max=\"63\" value=\"" + one.row + "\"></label>";
            if (kind !== "noise") h += "<label class=\"field\"><span>Length</span><input type=\"number\" data-f=\"len\" min=\"1\" max=\"" + (ROWS - one.row) + "\" value=\"" + one.len + "\"></label>";
            h += "</div>";
        } else if (kind !== "noise") {
            const sameLen = sel.every(n => n.len === sel[0].len);
            h += "<label class=\"field\"><span>Length</span><input type=\"number\" data-f=\"len\" min=\"1\" max=\"64\" value=\"" + (sameLen ? sel[0].len : "") + "\" placeholder=\"mixed\"></label>";
        }
        h += "<label class=\"field\"><span>Effect</span><select data-f=\"fx\">" + (mode === "keep" ? "<option value=\"keep\" selected>— mixed —</option>" : "") +
            "<option value=\"\"" + (mode === "" ? " selected" : "") + ">None</option>" +
            FX.filter(f => f.kinds.includes(kind)).map(f => "<option value=\"" + f.code + "\"" + (String(f.code) === mode ? " selected" : "") + ">" + hex(f.code, 1) + "xy · " + f.name + "</option>").join("") + "</select></label>";
        if (fxDef) {
            const xs = new Set(effs.map(f => f.param >> 4));
            const ys = new Set(effs.map(f => f.param & 15));
            const x = xs.size === 1 ? [...xs][0] : -1;
            const y = ys.size === 1 ? [...ys][0] : -1;
            h += "<div class=\"nib\">" + nibSelect("fxx", x, "x · " + fxDef.x) + nibSelect("fxy", y, "y · " + fxDef.y) + "</div>";
            h += "<p class=\"hint\">" + (x >= 0 && y >= 0 ? "<b style=\"font-family:var(--f-mono)\">" + hex(fxDef.code, 1) + hex((x << 4) | y, 2) + "</b> " : "") + fxDef.hint + "</p>";
        }
        if (kind !== "noise") {
            const offs = new Set(sel.map(n => n.slide || 0));
            const cur = offs.size === 1 ? [...offs][0] : null;
            let so = (cur === null ? "<option value=\"keep\" selected>— mixed —</option>" : "") + "<option value=\"0\"" + (cur === 0 ? " selected" : "") + ">None</option>";
            const range = new Set();
            for (let d = 24; d >= -24; d--) if (d) range.add(d);
            if (cur) range.add(cur);
            [...range].sort((a, b) => b - a).forEach(d => {
                const name = one ? " → " + noteName(clamp(one.note + d, 0, NOTE_MAX)) : "";
                so += "<option value=\"" + d + "\"" + (d === cur ? " selected" : "") + ">" + (d > 0 ? "Up " : "Down ") + Math.abs(d) + name + "</option>";
            });
            h += "<label class=\"field\"><span>Slide <b>to another pitch</b></span><select data-f=\"slide\">" + so + "</select></label>";
            if (sel.some(n => n.slide)) {
                const ats = new Set(sel.filter(n => n.slide).map(n => n.slideAt || 0));
                const at = ats.size === 1 ? [...ats][0] : null;
                const maxLen = Math.max(...sel.map(n => n.len));
                let ao = at === null ? "<option value=\"keep\" selected>— mixed —</option>" : "";
                for (let k = 0; k < maxLen; k++) ao += "<option value=\"" + k + "\"" + (k === at ? " selected" : "") + ">" + (k ? "After " + k + " row" + (k === 1 ? "" : "s") : "From the start") + "</option>";
                h += "<label class=\"field\"><span>Slide starts</span><select data-f=\"slideAt\">" + ao + "</select></label>";
                const lens = new Set(sel.filter(n => n.slide).map(n => n.slideLen || 0));
                const sl = lens.size === 1 ? [...lens][0] : null;
                let lo = (sl === null ? "<option value=\"keep\" selected>— mixed —</option>" : "") + "<option value=\"0\"" + (sl === 0 ? " selected" : "") + ">To the end of the note</option>";
                for (let k = 1; k < maxLen; k++) lo += "<option value=\"" + k + "\"" + (k === sl ? " selected" : "") + ">Over " + k + " row" + (k === 1 ? "" : "s") + ", then hold</option>";
                h += "<label class=\"field\"><span>Slide length</span><select data-f=\"slideLen\">" + lo + "</select></label>";
            }
            if (sel.some(n => n.slide)) {
                const issues = slideIssues(sel);
                h += issues.length ? issues.map(t => "<p class=\"hint warn\">" + esc(t) + "</p>").join("") : "<p class=\"hint\">Slides from the note's pitch to the target, landing on it by the end of the note, or after the slide length and then holding. Hold <span class=\"kbd\">S</span> and drag a note up or down to set a slide; where you click is where it starts.</p>";
            }
            const all = sel.every(n => n.swell);
            const any = sel.some(n => n.swell);
            h += "<div class=\"field\"><span>Swell <b>fades in and out over the note</b></span><div class=\"seg\" role=\"group\"><button type=\"button\" data-f=\"swell\" data-v=\"0\" aria-pressed=\"" + !any + "\">Off</button><button type=\"button\" data-f=\"swell\" data-v=\"1\" aria-pressed=\"" + all + "\">On</button></div></div>";
            if (any) {
                const issues = [...new Set(sel.filter(n => n.swell).map(swellIssue).filter(Boolean))];
                h += issues.length ? issues.map(t => "<p class=\"hint warn\">" + esc(t) + "</p>").join("") :
                    "<p class=\"hint\">" + (kind === "pulse" ? "Fades up to the instrument's volume by mid-note and out by the end. A fade can't take longer than about 1.6 s, so long notes hold at the peak, and notes under about 6 rows can't fade out fully. The restarts at the peak can click a little. For a swelling arp, use an arp instrument like Major Arp." : "Steps through the wave channel's four volume levels, up to mid-note and back down.") +
                    (sel.some(n => n.swell && n.fx) ? " The note's own effect pauses on the rows where the volume changes." : "") + " You'll hear it when the song plays, not in the click preview.</p>";
            }
        }
        h += "<div class=\"field\"><span>Volume <b>sets C0y</b></span><div class=\"seg\" role=\"group\">" +
            VOLUMES.map(v => "<button type=\"button\" data-f=\"vol\" data-v=\"" + v.y + "\" aria-pressed=\"" + sel.every(n => n.fx && n.fx.code === 0xc && n.fx.param === v.y) + "\">" + v.label + "</button>").join("") + "</div></div>";
        h += "<div class=\"chips\">" + (kind === "noise" ? "" : "<button type=\"button\" class=\"btn small\" data-f=\"echo\" title=\"Repeat " + (one ? "this note" : "these notes") + " a little later and quieter\">Echo ▾</button>") +
            "<button type=\"button\" class=\"btn small\" data-f=\"delete\">Delete " + (one ? (kind === "noise" ? "hit" : "note") : sel.length + " " + noun(sel.length)) + "</button></div>";
        el.innerHTML = h;
    }

    function onInspector(e) {
        const t = e.target.closest("[data-f]");
        if (!t) return;
        const f = t.dataset.f;
        const sel = liveSel();
        const pat = curPat();
        if (!sel.length || !pat) return;
        if (e.type === "click") {
            if (f === "delete") deleteSel();
            else if (f === "echo") ownMenu(t, () => showMenu(anchor(t), echoMenu(trackKind(state.track))));
            else if (f === "tr") transposeSel(parseInt(t.dataset.v, 10));
            else if (f === "vol") setFx(0xc, parseInt(t.dataset.v, 10));
            else if (f === "swell") setSwell(t.dataset.v === "1");
            return;
        }
        const v = t.value;
        const one = sel.length === 1 ? sel[0] : null;
        if (f === "note" && one) {
            checkpoint("insp:note");
            one.note = clamp(parseInt(v, 10), 0, pitchMax());
            const out = $("inspector").querySelector("[data-out=inote]");
            if (out) out.textContent = noteName(one.note);
            if (e.type === "input" && t.type === "range") {
                drawGrid();
                return;
            }
            preview(instById(one.inst), one.note, state.track, effFx(one));
            afterEdit();
            return;
        }
        if (f === "inst") {
            if (!v) return;
            const inst = instById(v);
            applySel(n => {
                n.inst = v;
                if (G.drum && inst) n.note = inst.note;
            });
            return;
        }
        if (f === "row" && one) {
            applySel(n => {
                n.row = clamp(parseInt(v, 10) || 0, 0, ROWS - (G.drum ? 1 : n.len));
            });
            return;
        }
        if (f === "len") {
            if (v === "") return;
            applySel(n => {
                n.len = clamp(parseInt(v, 10) || 1, 1, ROWS - n.row);
            });
            return;
        }
        if (f === "slide") {
            if (v === "keep") return;
            setSlide(parseInt(v, 10));
            return;
        }
        if (f === "slideLen") {
            if (v === "keep") return;
            const k = parseInt(v, 10);
            applySel(n => {
                if (!n.slide) return;
                const at = Math.min(n.slideAt || 0, n.len - 1);
                if (k && at + k < n.len) n.slideLen = k;
                else delete n.slideLen;
            });
            return;
        }
        if (f === "slideAt") {
            if (v === "keep") return;
            const k = parseInt(v, 10);
            applySel(n => {
                if (!n.slide) return;
                const at = clamp(k, 0, n.len - 1);
                if (at) n.slideAt = at;
                else delete n.slideAt;
            });
            return;
        }
        if (f === "fx") {
            if (v === "keep") return;
            if (v === "") {
                setFx(null);
                return;
            }
            const code = parseInt(v, 10);
            applySel(n => {
                const e = effFx(n);
                n.fx = { code, param: e && e.code === code ? e.param : fxDefault(code) };
            });
            return;
        }
        if ((f === "fxx" || f === "fxy") && v !== "-1") {
            const k = parseInt(v, 10);
            applySel(n => {
                const e = effFx(n);
                if (!e) return;
                n.fx = { code: e.code, param: f === "fxx" ? (k << 4) | (e.param & 15) : (e.param & 0xf0) | k };
            });
        }
    }

    let menuRoot = null;
    let menuOwner = null;
    let menuSkip = null;
    let menuOpenedAt = 0;

    function hideMenu() {
        menuOwner = null;
        document.querySelectorAll(".ctx").forEach(m => m.remove());
        menuRoot = null;
    }

    function placeMenu(m, x, y, alt, above) {
        m.style.left = "0px";
        m.style.top = "0px";
        const r = m.getBoundingClientRect();
        let left = x;
        let top = y;
        if (left + r.width > innerWidth - 8) left = alt !== undefined ? alt - r.width : innerWidth - 8 - r.width;
        if (top + r.height > innerHeight - 8) top = above !== undefined && above - r.height >= 8 ? above - r.height : Math.max(8, innerHeight - 8 - r.height);
        m.style.left = Math.max(8, left) + "px";
        m.style.top = Math.max(8, top) + "px";
    }

    function closeSub(m) {
        if (m._sub) {
            closeSub(m._sub);
            m._sub.remove();
            m._sub = null;
        }
        m.querySelectorAll(".ctx-item.open").forEach(b => b.classList.remove("open"));
    }

    function buildMenu(items, parent) {
        const m = document.createElement("div");
        m.className = "ctx";
        m.setAttribute("role", "menu");
        m._parent = parent || null;
        for (const it of items) {
            if (!it) continue;
            if (it.sep) {
                if (m.lastChild && !m.lastChild.classList.contains("ctx-sep")) m.appendChild(Object.assign(document.createElement("div"), { className: "ctx-sep" }));
                continue;
            }
            if (it.head) {
                m.appendChild(Object.assign(document.createElement("div"), { className: "ctx-head", textContent: it.head }));
                continue;
            }
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ctx-item" + (it.danger ? " danger" : "");
            b.setAttribute("role", "menuitem");
            b.disabled = !!it.disabled;
            b.innerHTML = "<span class=\"ctx-check\">" + (it.checked ? "✓" : "") + "</span><span class=\"ctx-label\">" + esc(it.label) + "</span><span class=\"ctx-kbd\">" + (it.sub ? "▸" : esc(it.kbd || "")) + "</span>";
            if (it.sub) {
                b.setAttribute("aria-haspopup", "menu");
                const open = () => {
                    if (b.disabled || (m._sub && m._sub._owner === b)) return;
                    closeSub(m);
                    const sub = buildMenu(it.sub, m);
                    sub._owner = b;
                    m._sub = sub;
                    b.classList.add("open");
                    document.body.appendChild(sub);
                    const r = b.getBoundingClientRect();
                    placeMenu(sub, r.right + 2, r.top - 5, r.left - 2);
                    return sub;
                };
                b.addEventListener("mouseenter", open);
                b.addEventListener("click", open);
                b.addEventListener("keydown", e => {
                    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        const sub = open() || m._sub;
                        const first = sub && sub.querySelector(".ctx-item:not(:disabled)");
                        if (first) first.focus();
                    }
                });
            } else {
                b.addEventListener("mouseenter", () => closeSub(m));
                b.addEventListener("click", () => {
                    hideMenu();
                    it.action();
                });
            }
            m.appendChild(b);
        }
        while (m.lastChild && m.lastChild.classList.contains("ctx-sep")) m.lastChild.remove();
        m.addEventListener("keydown", e => {
            const list = [...m.querySelectorAll(".ctx-item:not(:disabled)")];
            const i = list.indexOf(document.activeElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                const next = list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length];
                if (next) next.focus();
            } else if (e.key === "Escape" || (e.key === "ArrowLeft" && m._parent)) {
                e.preventDefault();
                e.stopPropagation();
                if (m._parent) {
                    const owner = m._owner;
                    closeSub(m._parent);
                    if (owner) owner.focus();
                } else {
                    hideMenu();
                }
            } else if (e.key === "Tab") {
                e.preventDefault();
            }
        });
        return m;
    }

    function ownMenu(btn, fn) {
        if (menuSkip === btn) {
            menuSkip = null;
            return;
        }
        fn();
        if (menuRoot) menuOwner = btn;
    }

    function showMenu(e, items) {
        hideMenu();
        const m = buildMenu(items);
        if (!m.children.length) return;
        menuRoot = m;
        menuOpenedAt = performance.now();
        document.body.appendChild(m);
        placeMenu(m, e.clientX, e.clientY, undefined, e.above);
        const first = m.querySelector(".ctx-item:not(:disabled)");
        if (first) first.focus({ preventScroll: true });
    }

    function fxMenu(kind) {
        const pitched = kind !== "noise";
        const opt = (label, code, param) => ({ label: label + "  " + hex(code, 1) + hex(param, 2), action: () => setFx(code, param) });
        return [
            { label: "None", action: () => setFx(null) },
            { sep: true },
            pitched && { label: "Arpeggio", sub: [opt("Major", 0x0, 0x47), opt("Minor", 0x0, 0x37), opt("Sus4", 0x0, 0x57), opt("Fifth", 0x0, 0x07), opt("Octave", 0x0, 0x0c)] },
            pitched && { label: "Vibrato", sub: [opt("Natural", 0x4, 0x43), opt("Subtle", 0x4, 0x42), opt("Wide", 0x4, 0x44), opt("Slow", 0x4, 0x83), opt("Shimmer", 0x4, 0x12)] },
            pitched && { label: "Slide up", sub: [opt("Slow", 0x1, 0x04), opt("Medium", 0x1, 0x10), opt("Fast", 0x1, 0x30)] },
            pitched && { label: "Slide down", sub: [opt("Slow", 0x2, 0x04), opt("Medium", 0x2, 0x10), opt("Fast", 0x2, 0x30)] },
            pitched && { label: "Glide to note", sub: [opt("Slow", 0x3, 0x08), opt("Medium", 0x3, 0x20), opt("Fast", 0x3, 0x60)] },
            { label: "Note delay", sub: [opt("1 tick", 0x7, 1), opt("2 ticks", 0x7, 2), opt("3 ticks", 0x7, 3), opt("Half a row", 0x7, Math.max(1, Math.floor(speedNow() / 2)))] },
            { label: "Note cut", sub: [opt("After 1 tick", 0xe, 1), opt("After 2 ticks", 0xe, 2), opt("After 4 ticks", 0xe, 4)] },
            { sep: true },
            { label: "Other effects…", action: () => {
                const s = $("inspector").querySelector("select[data-f=fx]");
                if (s) s.focus();
            } }
        ];
    }

    function openRollMenu(e) {
        const p = rollPos(e);
        const hit = noteUnder(p);
        if (hit && !isSel(hit)) state.sel = [hit];
        drawGrid();
        renderInspector();
        const sel = liveSel();
        const has = sel.length > 0;
        const kind = trackKind(state.track);
        const pat = curPat();
        const insts = instsOf(kind);
        const first = sel[0];
        const firstInst = first ? instById(first.inst) : null;
        const head = !has ? null : sel.length === 1 ? (G.drum && firstInst ? firstInst.name : noteName(first.note)) + " · row " + pad2(first.row) : sel.length + " " + noun(sel.length) + " selected";
        showMenu(e, [
            head && { head },
            has && { label: "Hear", action: () => preview(firstInst, first.note, state.track) },
            has && { sep: true },
            has && { label: "Cut", kbd: "Ctrl+X", action: cutSel },
            has && { label: "Copy", kbd: "Ctrl+C", action: () => copySel() },
            { label: "Paste here", kbd: "Ctrl+V", disabled: !canPaste(), action: () => pasteAt(p.row) },
            has && { label: "Duplicate", kbd: "Ctrl+D", action: duplicateSel },
            { sep: true },
            !has && { label: "Draw tool", kbd: "D", checked: state.tool === "draw", action: () => setTool("draw") },
            !has && { label: "Select tool", kbd: "M", checked: state.tool === "select", action: () => setTool("select") },
            !has && { label: "Erase tool", kbd: "E", checked: state.tool === "erase", action: () => setTool("erase") },
            has && { label: "Instrument", disabled: !insts.length, sub: insts.map(i => ({ label: pad2(instNum(i)) + "  " + i.name, checked: has && sel.every(n => n.inst === i.id), action: () => applySel(n => {
                n.inst = i.id;
                if (G.drum) n.note = i.note;
            }, "Instrument set to " + i.name + ".") })) },
            has && { label: "Effect", sub: fxMenu(kind) },
            has && !G.drum && { label: "Echo", sub: echoMenu(kind) },
            has && !G.drum && { label: "Slide", sub: slideMenu(sel) },
            has && !G.drum && { label: "Swell over the note", checked: sel.every(n => n.swell), action: () => setSwell(!sel.every(n => n.swell)) },
            has && { label: "Volume", sub: VOLUMES.map(v => ({ label: v.label + "  C0" + hex(v.y, 1), checked: has && sel.every(n => n.fx && n.fx.code === 0xc && n.fx.param === v.y), action: () => setFx(0xc, v.y) })) },
            has && { label: G.drum ? "Pitch" : "Transpose", sub: [{ label: "Up a semitone", kbd: "↑", action: () => transposeSel(1) }, { label: "Down a semitone", kbd: "↓", action: () => transposeSel(-1) }, { label: "Up an octave", kbd: "Shift+↑", action: () => transposeSel(12) }, { label: "Down an octave", kbd: "Shift+↓", action: () => transposeSel(-12) }] },
            has && !G.drum && { label: "Length", sub: [1, 2, 3, 4, 6, 8, 16].map(l => ({ label: l + (l === 1 ? " row" : " rows"), checked: has && sel.every(n => n.len === l), action: () => applySel(n => {
                n.len = clamp(l, 1, ROWS - n.row);
            }) })).concat([{ sep: true }, { label: "Stretch to the next note", action: stretchSel }]) },
            { sep: true },
            { label: "Select all", kbd: "Ctrl+A", disabled: !pat || !pat.notes.length, action: selectAll },
            has && firstInst && { label: "Select all with " + firstInst.name, action: () => selectSameInst(firstInst.id) },
            has && { label: "Clear selection", kbd: "Esc", action: clearSel },
            { sep: true },
            has && { label: sel.length === 1 ? "Delete " + noun(1) : "Delete " + sel.length + " " + noun(sel.length), kbd: "Del", danger: true, action: deleteSel },
            !has && { label: "Clear pattern", danger: true, disabled: !pat || !pat.notes.length, action: clearPattern }
        ]);
    }

    function orderItems(o) {
        const count = state.song.order.length;
        const at = fn => () => {
            state.ord = o;
            fn();
        };
        if (isSfx()) {
            const name = state.song.sfx[o].name;
            return [
                { label: "Rename…", action: () => {
                    selectSlot(state.track, o);
                    $("sfxName").focus();
                    $("sfxName").select();
                } },
                { label: "Hear it", action: () => {
                    selectSlot(state.track, o);
                    if (!state.playing) play();
                } },
                { label: "Export as .vgm", action: () => exportVgm(o) },
                { sep: true },
                { label: "New sound after this", action: at(() => orderOp("add")) },
                { label: "Duplicate", action: at(() => orderOp("dup")) },
                { label: "Move left", disabled: o === 0, action: at(() => orderOp("left")) },
                { label: "Move right", disabled: o >= count - 1, action: at(() => orderOp("right")) },
                { sep: true },
                { label: count > 1 ? "Delete " + name : "Clear " + name, danger: true, action: at(() => orderOp("del")) }
            ];
        }
        const cur = ordRows(o);
        return [
            { label: "Pattern builder…", action: () => openBuilder(o) },
            { sep: true },
            { label: "Length", sub: lengthChoices(cur).map(v => ({ label: v + " rows" + (v % (state.song.rowsPerBeat * state.song.beatsPerBar) ? "" : " · " + v / (state.song.rowsPerBeat * state.song.beatsPerBar) + " bar" + (v / (state.song.rowsPerBeat * state.song.beatsPerBar) === 1 ? "" : "s")), checked: v === cur, action: () => setOrderRows(o, v) })).concat([{ sep: true }, { label: "Use " + cur + " rows for every order", action: () => setOrderRows(o, cur, true) }]) },
            { sep: true },
            { label: "Insert order after", action: at(() => orderOp("add")) },
            { label: "Repeat order", action: at(() => orderOp("dup")) },
            { label: "Move order left", disabled: o === 0, action: at(() => orderOp("left")) },
            { label: "Move order right", disabled: o >= count - 1, action: at(() => orderOp("right")) },
            { sep: true },
            { label: count > 1 ? "Delete order " + pad2(o) : "Clear order " + pad2(o), danger: true, action: at(() => orderOp("del")) }
        ];
    }

    function openSlotMenu(e, t, o) {
        const idx = patIndex(t, o);
        const pats = state.song.tracks[t].patterns;
        const go = fn => () => {
            selectSlot(t, o);
            fn();
        };
        showMenu(e, [
            { head: TRACKS[t].name + " · " + (isSfx() ? state.song.sfx[o].name : "order " + pad2(o)) },
            { label: "Edit", action: go(() => {}) },
            { label: "New pattern", action: go(() => setPattern("new")) },
            { label: "Use pattern", sub: [{ label: "Empty", checked: idx < 0, action: go(() => setPattern("-1")) }].concat(pats.map((p, i) => ({ label: "P" + pad2(i) + " · " + p.notes.length + " " + (p.notes.length === 1 ? "note" : "notes"), checked: idx === i, action: go(() => setPattern(String(i))) }))) },
            { label: "Make unique", disabled: idx < 0 || usage(t, idx) < 2, action: go(makeUnique) },
            { label: "Clear notes", disabled: idx < 0 || !pats[idx].notes.length, action: go(clearPattern) },
            { label: "Empty this slot", disabled: idx < 0, action: go(() => setPattern("-1")) },
            { sep: true }
        ].concat(orderItems(o)));
    }

    function openTrackMenu(e, t) {
        showMenu(e, [
            { head: TRACKS[t].name },
            { label: "Edit this track", action: () => selectSlot(t, state.ord) },
            { sep: true },
            { label: "Mute", checked: state.mute[t], action: () => {
                state.mute[t] = !state.mute[t];
                renderArrange();
                sendMute();
            } },
            { label: "Solo", checked: state.solo[t], action: () => {
                state.solo[t] = !state.solo[t];
                renderArrange();
                sendMute();
            } },
            { label: "Unmute all", disabled: !state.mute.some(Boolean) && !state.solo.some(Boolean), action: () => {
                state.mute = [false, false, false, false];
                state.solo = [false, false, false, false];
                renderArrange();
                sendMute();
            } }
        ]);
    }

    function copyInstrument(inst) {
        const data = clone(inst);
        delete data.id;
        const text = JSON.stringify({ format: "fuge-instrument", version: 1, instrument: data });
        if (!storeSet(INST_CLIP_KEY, text)) {
            toast("Couldn't copy the instrument: this browser isn't letting fUGE save anything.");
            return;
        }
        status("Copied " + inst.name + ". Right-click in the instrument list to paste it, here or in another project.");
    }

    function instClip() {
        try {
            const raw = JSON.parse(storeGet(INST_CLIP_KEY) || "null");
            if (!raw || raw.format !== "fuge-instrument" || !raw.instrument) return null;
            const s = normalize({ instruments: [raw.instrument], tracks: [], order: [] });
            return s.instruments[0] || null;
        } catch (e) {
            return null;
        }
    }

    function clipData(inst) {
        const data = clone(inst);
        delete data.id;
        delete data.type;
        delete data.name;
        return data;
    }

    function pasteInstrument() {
        const clip = instClip();
        if (!clip) return;
        const taken = new Set(instsOf(clip.type).map(i => i.name));
        let name = clip.name;
        for (let k = 2; taken.has(name); k++) name = (clip.name.slice(0, 29) + " " + k).slice(0, 32);
        const inst = addInstrument(clip.type, { name, data: clipData(clip) });
        if (!inst) return;
        selectInst(inst.id);
        renderAll();
        status("Pasted " + inst.name + " as " + KIND_LABEL[inst.type] + " " + pad2(instNum(inst)) + ".");
    }

    function pasteInstrumentOver(target) {
        const clip = instClip();
        if (!clip || clip.type !== target.type) return;
        checkpoint();
        const keep = { id: target.id, type: target.type, name: target.name };
        Object.keys(target).forEach(k => delete target[k]);
        Object.assign(target, clipData(clip), keep);
        renderAll();
        preview(target);
        const uses = instUseCount(target.id);
        status("Pasted " + clip.name + "'s settings into " + target.name + (uses ? ", so its " + uses + " note" + (uses === 1 ? "" : "s") + " now use the new sound." : "."));
    }

    function pasteItems(target) {
        const clip = instClip();
        const full = clip && instsOf(clip.type).length >= MAX_INST;
        return [
            { label: clip ? "Paste instrument (" + clip.name + ")" : "Paste instrument", disabled: !clip || full, action: pasteInstrument },
            target && { label: "Paste settings into " + target.name, disabled: !clip || clip.type !== target.type, action: () => pasteInstrumentOver(target) }
        ];
    }

    function openInstMenu(e, id) {
        const inst = instById(id);
        if (!inst) return;
        const here = trackKind(state.track) === inst.type && curPat();
        showMenu(e, [
            { head: KIND_LABEL[inst.type] + " " + pad2(instNum(inst)) + " · " + inst.name },
            { label: "Hear", action: () => preview(inst) },
            { label: "Draw with it", action: () => selectInst(inst.id) },
            { label: "Select its notes in this pattern", disabled: !here, action: () => selectSameInst(inst.id) },
            { sep: true },
            { label: "Copy instrument", action: () => copyInstrument(inst) }
        ].concat(pasteItems(inst), [
            { sep: true },
            { label: "Duplicate", disabled: instsOf(inst.type).length >= MAX_INST, action: () => duplicateInstrument(inst) },
            { label: "Delete", danger: true, action: () => deleteInstrument(inst) }
        ]));
    }

    function onContextMenu(e) {
        if (e.target.closest("input[type=text], input[type=number], textarea")) return;
        e.preventDefault();
        if (e.target.closest(".ctx")) return;
        if (e.target.id === "roll") {
            G.drag = null;
            openRollMenu(e);
            return;
        }
        if (e.target.id === "waveCanvas") {
            const inst = curInst();
            if (inst && inst.type === "wave") showMenu(e, [
                { head: "Waveform" },
                { label: "Enter values…", action: () => openWaveValues(inst) },
                { label: "Copy values", action: () => copyText(waveText(inst.wave)).then(ok => status(ok ? "Copied the waveform: " + waveText(inst.wave) : "Couldn't copy. Use Enter values… and copy from there.")) }
            ]);
            return;
        }
        const slot = e.target.closest(".slot");
        if (slot) {
            openSlotMenu(e, +slot.dataset.t, +slot.dataset.o);
            return;
        }
        const on = e.target.closest(".ord-num");
        if (on) {
            showMenu(e, [{ head: isSfx() ? state.song.sfx[+on.dataset.o].name : "Order " + pad2(+on.dataset.o) }].concat(orderItems(+on.dataset.o)));
            return;
        }
        const th = e.target.closest(".track-head");
        if (th) {
            openTrackMenu(e, +th.dataset.t);
            return;
        }
        const inst = e.target.closest(".inst");
        if (inst) {
            openInstMenu(e, inst.dataset.id);
            return;
        }
        if (e.target.closest("#instList")) {
            showMenu(e, [{ head: "Instruments" }].concat(pasteItems(null), [{ sep: true }, { label: "Presets…", action: () => openPresets() }]));
            return;
        }
        hideMenu();
    }

    function renderHint() {
        const inst = curInst();
        const kind = trackKind(state.track);
        let t;
        if (kind === "noise") t = "Noise track: click a lane to place that drum.";
        else if (inst && inst.type === kind) t = "Drawing with " + KIND_LABEL[kind] + " " + pad2(instNum(inst)) + " · " + inst.name;
        else t = "Pick a " + KIND_LABEL[kind] + " instrument to draw on " + TRACKS[state.track].name + ".";
        if (state.kb) t = "⌨ Piano" + (kind === "noise" ? "" : " Z = " + noteName(kbBase())) + " · " + t;
        $("drawHint").textContent = t;
    }

    let lcdText = "";

    function updateLcd() {
        const o = state.playing ? state.playOrd : state.ord;
        const r = state.playing ? Math.floor(state.playRow) : state.startRow;
        const text = (state.playing ? "▶ " : "") + (isSfx() ? "SFX " : "ORD ") + pad2(o) + "  ROW " + pad2(r);
        if (text !== lcdText) {
            lcdText = text;
            $("lcd").textContent = text;
        }
    }

    function renderAll() {
        syncRows();
        readPalette();
        renderTop();
        renderInstList();
        renderEditor();
        renderArrange();
        renderPatBar();
        renderRoll();
        renderInspector();
        renderHint();
        updateLcd();
    }

    let toastTimer = 0;

    function toast(msg) {
        const t = $("toast");
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
    }

    function status(msg) {
        $("status").textContent = msg;
    }

    function addInstrument(type, preset, quiet) {
        const list = instsOf(type);
        if (list.length >= MAX_INST) {
            toast("hUGETracker allows 15 " + KIND_LABEL[type] + " instruments per song.");
            return null;
        }
        if (!quiet) checkpoint();
        const inst = Presets.make(type, preset || { name: KIND_LABEL[type] + " " + (list.length + 1), data: {} });
        inst.id = uid();
        const last = list[list.length - 1];
        const at = last ? state.song.instruments.indexOf(last) + 1 : state.song.instruments.length;
        state.song.instruments.splice(at, 0, inst);
        return inst;
    }

    function duplicateInstrument(inst) {
        const data = clone(inst);
        delete data.id;
        delete data.type;
        delete data.name;
        const copy = addInstrument(inst.type, { name: (inst.name + " 2").slice(0, 32), data });
        if (copy) {
            selectInst(copy.id);
            renderAll();
        }
    }

    function deleteInstrument(inst) {
        const uses = instUseCount(inst.id);
        (uses ? Desktop.ask("Delete \"" + inst.name + "\"? It's used by " + uses + " note" + (uses === 1 ? "" : "s") + ", which will be removed too.") : Promise.resolve(true)).then(ok => {
            if (ok) removeInstrument(inst);
        });
    }

    function removeInstrument(inst) {
        checkpoint();
        for (const t of state.song.tracks) for (const p of t.patterns) p.notes = p.notes.filter(n => n.inst !== inst.id);
        state.song.instruments = state.song.instruments.filter(i => i !== inst);
        state.inst = null;
        syncInstToTrack();
        state.sel = [];
        renderAll();
        status("Deleted " + inst.name + ".");
    }

    function onEditorInput(e) {
        const inst = curInst();
        const k = e.target.dataset.k;
        if (!inst || !k) return;
        if (k === "mirror") {
            state.waveMirror = e.target.checked;
            return;
        }
        if (k === "name") {
            checkpoint("inst:" + inst.id + ":name");
            inst.name = e.target.value.slice(0, 32) || KIND_LABEL[inst.type];
            const nm = document.querySelector(".inst[data-id=\"" + inst.id + "\"] .name");
            if (nm) nm.textContent = inst.name;
            drawGrid();
            if (G.drum) drawKeys();
            renderHint();
            return;
        }
        checkpoint("inst:" + inst.id + ":" + k);
        if (k === "lenOn") {
            inst.length = e.target.checked ? (inst.type === "wave" ? 128 : 32) : 0;
            renderEditor();
            refreshIcon(inst);
            return;
        }
        const was = inst[k];
        inst[k] = parseInt(e.target.value, 10);
        if (k === "note" && inst.type === "noise") followPitch(inst, was);
        const out = $("instEditor").querySelector("[data-out=\"" + k + "\"]");
        if (out) out.textContent = FMT[k](inst[k]);
        drawEditorCanvases(inst);
        refreshIcon(inst);
        if (G.drum) drawGrid();
        scheduleAutosave();
    }

    function followPitch(inst, was) {
        if (was === inst.note) return;
        let moved = 0;
        state.song.tracks.forEach((t, k) => {
            if (TRACKS[k].kind !== "noise") return;
            for (const p of t.patterns) {
                for (const n of p.notes) {
                    if (n.inst === inst.id && n.note === was) {
                        n.note = inst.note;
                        moved++;
                    }
                }
            }
        });
        if (moved) drawGrid();
    }

    function onEditorChange(e) {
        if (e.target.dataset.sp) {
            onSubChange(e.target);
            return;
        }
        const k = e.target.dataset.k;
        if (k === "sweepTime" || k === "name" || (k === "vol" && curInst() && curInst().envDir === "up")) renderEditor();
        if (k && k !== "name" && k !== "mirror") preview(curInst());
    }

    function onEditorClick(e) {
        const inst = curInst();
        if (!inst) return;
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.seg) {
            checkpoint();
            const v = b.dataset.v;
            const s = b.dataset.seg;
            if (s === "duty") inst.duty = parseInt(v, 10);
            if (s === "level") inst.level = parseInt(v, 10);
            if (s === "bits") inst.bits = parseInt(v, 10);
            if (s === "sweepDir") inst.sweepDir = v;
            if (s === "env") {
                if (v === "hold") inst.envPace = 0;
                else {
                    inst.envDir = v;
                    inst.envPace = inst.envPace || 2;
                    if (v === "up" && inst.vol === 15) inst.vol = 0;
                }
            }
            renderEditor();
            refreshIcon(inst);
            if (G.drum) drawGrid();
            preview(inst);
            return;
        }
        if (b.dataset.shape) {
            checkpoint();
            inst.wave = Presets.SHAPES[b.dataset.shape]();
            renderEditor();
            refreshIcon(inst);
            preview(inst);
            return;
        }
        if (b.dataset.act === "test") {
            preview(inst);
            return;
        }
        if (b.dataset.act === "subEdit") {
            state.subOpen = !state.subOpen;
            renderEditor();
            if (state.subOpen) {
                const g = $("instEditor").querySelector(".sub-sec");
                if (g) g.scrollIntoView({ block: "nearest" });
            }
            return;
        }
        if (b.dataset.act === "subOff") {
            setSub(inst, null, true);
            return;
        }
        if (b.dataset.act === "dup") {
            duplicateInstrument(inst);
            return;
        }
        if (b.dataset.act === "del") deleteInstrument(inst);
    }

    function bindWaveDraw() {
        let drawing = false;
        let last = -1;
        const ed = $("instEditor");
        const apply = (e, cv) => {
            const inst = curInst();
            if (!inst || inst.type !== "wave") return;
            const r = cv.getBoundingClientRect();
            const idx = clamp(Math.floor((e.clientX - r.left) / r.width * 32), 0, 31);
            const val = clamp(15 - Math.floor((e.clientY - r.top) / r.height * 16), 0, 15);
            const from = last < 0 ? idx : last;
            const step = idx >= from ? 1 : -1;
            for (let k = from; k !== idx + step; k += step) {
                inst.wave[k] = val;
                if (state.waveMirror) inst.wave[(k + 16) % 32] = val;
            }
            last = idx;
            drawWave(cv, inst);
            refreshIcon(inst);
        };
        ed.addEventListener("pointerdown", e => {
            if (e.target.id !== "waveCanvas" || e.button !== 0) return;
            drawing = true;
            last = -1;
            checkpoint();
            e.target.setPointerCapture(e.pointerId);
            apply(e, e.target);
        });
        ed.addEventListener("pointermove", e => {
            if (drawing && e.target.id === "waveCanvas") apply(e, e.target);
        });
        ed.addEventListener("pointerup", e => {
            if (!drawing) return;
            drawing = false;
            if (e.target.id === "waveCanvas") renderEditor();
            preview(curInst());
        });
    }

    let presetTab = "pulse";
    let presetGroup = "music";

    function openPresets(tab) {
        presetTab = tab || trackKind(state.track);
        presetGroup = isSfx() ? "sfx" : "music";
        renderPresets();
        $("presetModal").classList.add("open");
        $("presetClose").focus();
    }

    function closePresets() {
        $("presetModal").classList.remove("open");
    }

    function renderPresets() {
        $("presetTabs").innerHTML = KINDS.map(k => "<button type=\"button\" class=\"btn small\" data-tab=\"" + k + "\" aria-pressed=\"" + (k === presetTab) + "\"><span class=\"kind-dot\" style=\"background:var(" + KIND_COLOR[k] + ")\"></span>" + KIND_LABEL[k] + " <span style=\"opacity:.7\">" + instsOf(k).length + "/15</span></button>").join("") +
            "<div class=\"seg\" role=\"group\" aria-label=\"Preset group\" style=\"margin-left:auto\"><button type=\"button\" data-group=\"music\" aria-pressed=\"" + (presetGroup === "music") + "\">Music</button><button type=\"button\" data-group=\"sfx\" aria-pressed=\"" + (presetGroup === "sfx") + "\">Sound effects</button></div>";
        const grid = $("presetGrid");
        const full = instsOf(presetTab).length >= MAX_INST;
        grid.innerHTML = Presets.LIBRARY[presetTab].map((p, i) => !!p.sfx !== (presetGroup === "sfx") ? "" : "<div class=\"preset\" data-i=\"" + i + "\"><canvas></canvas><b>" + esc(p.name) + "</b><small>" + esc(p.desc) + "</small>" +
            "<div class=\"preset-actions\"><button type=\"button\" class=\"btn small\" data-listen=\"" + i + "\">▶ Listen</button><button type=\"button\" class=\"btn small\" data-add=\"" + i + "\"" + (full ? " disabled" : "") + ">+ Add</button></div></div>").join("");
        grid.querySelectorAll(".preset").forEach(b => drawIcon(b.querySelector("canvas"), Presets.make(presetTab, Presets.LIBRARY[presetTab][+b.dataset.i]), 44, 24));
    }

    function onPresetClick(e) {
        const group = e.target.closest("[data-group]");
        if (group) {
            presetGroup = group.dataset.group;
            renderPresets();
            return;
        }
        const tab = e.target.closest("[data-tab]");
        if (tab) {
            presetTab = tab.dataset.tab;
            renderPresets();
            return;
        }
        const listen = e.target.closest("[data-listen]");
        if (listen) {
            preview(Presets.make(presetTab, Presets.LIBRARY[presetTab][+listen.dataset.listen]));
            return;
        }
        const b = e.target.closest("[data-add]");
        if (!b) return;
        const preset = Presets.LIBRARY[presetTab][+b.dataset.add];
        const inst = addInstrument(presetTab, preset);
        if (!inst) return;
        selectInst(inst.id);
        renderAll();
        renderPresets();
        toast("Added " + inst.name + " as " + KIND_LABEL[inst.type] + " " + pad2(instNum(inst)) + ".");
    }

    function newSfxEntry() {
        const names = new Set(state.song.sfx.map(x => x.name));
        let k = state.song.sfx.length + 1;
        while (names.has("Sound " + k)) k++;
        const base = curSfx();
        return { name: "Sound " + k, rows: base ? base.rows : 16, speed: base ? base.speed : 3 };
    }

    function orderOp(op) {
        const o = state.ord;
        const order = state.song.order;
        const sfx = isSfx() ? state.song.sfx : null;
        const lens = sfx ? null : (state.song.orderRows = state.song.orderRows || order.map(() => MAX_ROWS));
        checkpoint();
        if (op === "add") {
            if (sfx) sfx.splice(o + 1, 0, newSfxEntry());
            else lens.splice(o + 1, 0, ordRows(o));
            order.splice(o + 1, 0, [-1, -1, -1, -1]);
            state.ord = o + 1;
        } else if (op === "append") {
            if (sfx) sfx.push(newSfxEntry());
            else lens.push(ordRows(order.length - 1));
            order.push([-1, -1, -1, -1]);
            state.ord = order.length - 1;
        } else if (op === "dup") {
            if (sfx) {
                const row = order[o].map((idx, c) => {
                    if (idx < 0) return -1;
                    const pats = state.song.tracks[c].patterns;
                    pats.push(clone(pats[idx]));
                    return pats.length - 1;
                });
                order.splice(o + 1, 0, row);
                sfx.splice(o + 1, 0, Object.assign({}, sfx[o], { name: (sfx[o].name + " 2").slice(0, 32) }));
            } else {
                order.splice(o + 1, 0, order[o].slice());
                lens.splice(o + 1, 0, ordRows(o));
            }
            state.ord = o + 1;
        } else if (op === "left" && o > 0) {
            [order[o - 1], order[o]] = [order[o], order[o - 1]];
            if (sfx) [sfx[o - 1], sfx[o]] = [sfx[o], sfx[o - 1]];
            else [lens[o - 1], lens[o]] = [lens[o], lens[o - 1]];
            state.ord = o - 1;
        } else if (op === "right" && o < order.length - 1) {
            [order[o + 1], order[o]] = [order[o], order[o + 1]];
            if (sfx) [sfx[o + 1], sfx[o]] = [sfx[o], sfx[o + 1]];
            else [lens[o + 1], lens[o]] = [lens[o], lens[o + 1]];
            state.ord = o + 1;
        } else if (op === "del") {
            if (order.length > 1) {
                order.splice(o, 1);
                if (sfx) sfx.splice(o, 1);
                else lens.splice(o, 1);
                state.ord = Math.min(o, order.length - 1);
            } else {
                order[0] = [-1, -1, -1, -1];
            }
        }
        state.sel = [];
        if (state.playing) {
            if (isSfx()) stop();
            else state.playOrd = state.ord;
        }
        renderAll();
        revealSlot();
    }

    function setPattern(v) {
        checkpoint();
        if (v === "new") {
            const pats = state.song.tracks[state.track].patterns;
            pats.push({ notes: [] });
            state.song.order[state.ord][state.track] = pats.length - 1;
        } else {
            state.song.order[state.ord][state.track] = parseInt(v, 10);
        }
        state.sel = [];
        renderAll();
        centerRoll(false);
    }

    function makeUnique() {
        const pat = curPat();
        if (!pat) return;
        checkpoint();
        const pats = state.song.tracks[state.track].patterns;
        pats.push(clone(pat));
        state.song.order[state.ord][state.track] = pats.length - 1;
        state.sel = [];
        renderAll();
        status("This slot now has its own copy: P" + pad2(pats.length - 1) + ".");
    }

    function clearPattern() {
        const pat = curPat();
        if (!pat || !pat.notes.length) return;
        checkpoint();
        pat.notes = [];
        state.sel = [];
        renderAll();
    }

    function play() {
        if (state.playing) {
            stop();
            return;
        }
        state.playing = true;
        state.playOrd = state.ord;
        state.playRow = state.startRow;
        renderTop();
        GBAudio.start().catch(() => {
            toast("Couldn't start audio in this browser.");
            stop();
        });
        pushSong();
        sendMute();
        GBAudio.send({ type: "loop", on: state.loop });
        GBAudio.send(playMsg(state.startRow));
        shownRow = -1;
        showPlay();
    }

    function playEnded() {
        if (!state.playing) return;
        state.playing = false;
        renderTop();
        positionPlayline();
        drawRuler();
        drawGrid();
        updateLcd();
        placeHead();
    }

    function stop() {
        state.playing = false;
        GBAudio.send({ type: "stop" });
        renderTop();
        positionPlayline();
        drawRuler();
        drawGrid();
        updateLcd();
        placeHead();
    }

    function onAudio(m) {
        if (BLD.playing) {
            if (m.type === "pos" && m.row !== BLD.row) {
                BLD.row = m.row;
                bldDraw();
            }
            return;
        }
        if (m.type === "ended") {
            playEnded();
            return;
        }
        if (m.type !== "pos" || !state.playing) return;
        state.playOrd = isSfx() ? state.ord : m.order;
        state.playRow = m.row;
        showPlay();
    }

    let shownRow = -1;
    let shownOrd = -1;

    function showPlay() {
        if (!state.playing) return;
        if (state.playOrd !== state.ord && state.playOrd < state.song.order.length) {
            state.ord = state.playOrd;
            state.sel = [];
            renderArrange();
            renderPatBar();
            renderRoll();
            renderInspector();
            revealSlot();
            shownRow = -1;
        }
        const row = Math.floor(state.playRow);
        if (row !== shownRow || state.playOrd !== shownOrd) {
            shownRow = row;
            shownOrd = state.playOrd;
            placeHead();
            positionPlayline();
            updateLcd();
        }
    }

    function slug(s) {
        return (s || "song").trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "song";
    }

    function deliver(name, data, type, msg) {
        return Desktop.save(name, data, type).then(where => {
            if (where && msg) status(msg + (Desktop.desktop ? " Saved to " + where : ""));
            return where;
        }).catch(err => toast("Couldn't save the file: " + (err && err.message ? err.message : err)));
    }

    function updateTitle() {
        const name = state.filePath ? Desktop.baseName(state.filePath) : (state.song.name || "Untitled");
        Desktop.setTitle((state.dirty ? "• " : "") + name + " — fUGE");
    }

    function saveJson(as) {
        const text = JSON.stringify(state.song, null, 2);
        const name = slug(state.song.name) + ".fuge.json";
        const done = where => {
            if (!where) return;
            state.dirty = false;
            if (Desktop.desktop) state.filePath = where;
            updateTitle();
            status("Saved " + (Desktop.desktop ? where : name) + ".");
        };
        const fail = err => toast("Couldn't save the project: " + (err && err.message ? err.message : err));
        if (Desktop.desktop && state.filePath && !as) return Desktop.write(state.filePath, text).then(done, fail);
        return Desktop.save(name, text, "application/json").then(done, fail);
    }

    function confirmDiscard() {
        return state.dirty ? Desktop.ask("You have changes since your last save. Discard them?") : Promise.resolve(true);
    }

    function openProject() {
        if (!Desktop.desktop) {
            $("fileInput").click();
            return;
        }
        confirmDiscard().then(ok => ok ? Desktop.openProject() : null).then(f => {
            if (f) loadText(f.text, f.name, f.path);
        }).catch(err => toast("Couldn't open the file: " + (err && err.message ? err.message : err)));
    }

    function loadText(text, name, path) {
        try {
            loadSong(normalize(JSON.parse(text)));
            state.filePath = path || null;
            updateTitle();
            status("Opened " + name);
        } catch (err) {
            toast(err.message.startsWith("This file") ? err.message : "Couldn't read that file. Open a .fuge.json project saved from fUGE.");
        }
    }

    function exportUge() {
        try {
            const res = UGE.exportSong(state.song);
            deliver(slug(state.song.name) + ".uge", res.bytes, "application/octet-stream", "Exported " + slug(state.song.name) + ".uge (" + Math.round(res.bytes.length / 1024) + " KB). Open it in hUGETracker or drop it in GB Studio's assets/music folder.");
            if (res.warnings.length) toast(res.warnings.join(" "));
        } catch (err) {
            toast("Export failed: " + err.message);
        }
    }

    let CORE = null;
    const core = () => CORE || (CORE = GBAudioCore());

    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(b) {
        let c = 0xffffffff;
        for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    function makeZip(files) {
        const enc = new TextEncoder();
        const parts = [];
        const central = [];
        let offset = 0;
        for (const f of files) {
            const name = enc.encode(f.name);
            const crc = crc32(f.data);
            const size = f.data.length;
            const h = new DataView(new ArrayBuffer(30));
            h.setUint32(0, 0x04034b50, true);
            h.setUint16(4, 20, true);
            h.setUint16(12, 0x21, true);
            h.setUint32(14, crc, true);
            h.setUint32(18, size, true);
            h.setUint32(22, size, true);
            h.setUint16(26, name.length, true);
            parts.push(new Uint8Array(h.buffer), name, f.data);
            const c = new DataView(new ArrayBuffer(46));
            c.setUint32(0, 0x02014b50, true);
            c.setUint16(4, 20, true);
            c.setUint16(6, 20, true);
            c.setUint16(14, 0x21, true);
            c.setUint32(16, crc, true);
            c.setUint32(20, size, true);
            c.setUint32(24, size, true);
            c.setUint16(28, name.length, true);
            c.setUint32(42, offset, true);
            central.push(new Uint8Array(c.buffer), name);
            offset += 30 + name.length + size;
        }
        const csize = central.reduce((a, b) => a + b.length, 0);
        const e = new DataView(new ArrayBuffer(22));
        e.setUint32(0, 0x06054b50, true);
        e.setUint16(8, files.length, true);
        e.setUint16(10, files.length, true);
        e.setUint32(12, csize, true);
        e.setUint32(16, offset, true);
        return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/zip" });
    }

    function fileNames(list, ext) {
        const seen = new Map();
        return list.map(n => {
            const base = slug(n);
            const c = (seen.get(base) || 0) + 1;
            seen.set(base, c);
            return (c > 1 ? base + "_" + c : base) + ext;
        });
    }

    const sfxSong = k => UGE.compile(state.song, { sfx: k }).song;
    const wavMask = () => TRACKS.map((t, k) => !muted(k));

    function busy(msg, fn) {
        status(msg);
        setTimeout(() => {
            try {
                fn();
            } catch (err) {
                toast("Export failed: " + err.message);
            }
        }, 30);
    }

    function exportVgm(k) {
        const s = state.song.sfx[k];
        const song = sfxSong(k);
        if (!song.used.some(Boolean)) {
            toast("\"" + s.name + "\" is empty, so there's nothing to export.");
            return;
        }
        const res = core().renderVgm(song);
        const name = fileNames([s.name], ".vgm")[0];
        deliver(name, res.bytes, "application/octet-stream", "Exported " + name + " (" + res.seconds.toFixed(2) + " s, " + song.used.filter(Boolean).length + " channel" + (song.used.filter(Boolean).length === 1 ? "" : "s") + "). Copy it into your GB Studio project's assets/sounds folder.");
    }

    function exportAllVgm() {
        busy("Rendering sound effects…", () => {
            const keep = state.song.sfx.map((s, k) => k).filter(k => sfxSong(k).used.some(Boolean));
            if (!keep.length) {
                toast("All the sound effects are empty.");
                return;
            }
            const names = fileNames(keep.map(k => state.song.sfx[k].name), ".vgm");
            const files = keep.map((k, i) => ({ name: names[i], data: core().renderVgm(sfxSong(k)).bytes }));
            deliver(slug(state.song.name) + "_vgm.zip", makeZip(files), "application/zip", "Exported " + files.length + " .vgm sound effects in a .zip. Unzip them into your GB Studio project's assets/sounds folder.");
        });
    }

    function clock(sec) {
        const t = Math.round(sec);
        return Math.floor(t / 60) + ":" + pad2(t % 60);
    }

    function exportWav(k, passes) {
        busy("Rendering audio…", () => {
            if (isSfx()) {
                const s = state.song.sfx[k];
                const res = core().renderWav(sfxSong(k), { cutAtEnd: true, tail: 0.03, mask: wavMask() });
                const name = fileNames([s.name], ".wav")[0];
                deliver(name, res.bytes, "audio/wav", "Exported " + name + " (" + res.seconds.toFixed(2) + " s).");
            } else {
                const twice = passes === 2;
                const res = core().renderWav(UGE.compile(state.song).song, { cutAtEnd: true, passes: twice ? 2 : 1, maxSeconds: twice ? 1200 : 600, mask: wavMask() });
                const name = slug(state.song.name) + (twice ? "_loop" : "") + ".wav";
                deliver(name, res.bytes, "audio/wav", "Exported " + name + " (" + clock(res.seconds) + (twice ? ", played twice to show the loop" : "") + ")" + (state.mute.some(Boolean) || state.solo.some(Boolean) ? ", without the muted tracks." : "."));
            }
        });
    }

    function exportAllWav() {
        busy("Rendering sound effects…", () => {
            const names = fileNames(state.song.sfx.map(s => s.name), ".wav");
            const files = state.song.sfx.map((s, k) => ({ name: names[k], data: core().renderWav(sfxSong(k), { cutAtEnd: true, tail: 0.03, mask: wavMask() }).bytes }));
            deliver(slug(state.song.name) + "_wav.zip", makeZip(files), "application/zip", "Exported " + files.length + " .wav files in a .zip.");
        });
    }

    function exportPrimary() {
        if (isSfx()) exportVgm(state.ord);
        else exportUge();
    }

    function anchor(el) {
        const r = el.getBoundingClientRect();
        return { clientX: r.left, clientY: r.bottom + 4, above: r.top - 4 };
    }

    function openExportMenu() {
        if (isSfx()) {
            const s = curSfx();
            showMenu(anchor($("btnExport")), [
                { head: s.name },
                { label: "This sound as .vgm (GB Studio)", kbd: "Ctrl+E", action: () => exportVgm(state.ord) },
                { label: "All sounds as .vgm (.zip)", action: exportAllVgm },
                { sep: true },
                { label: "This sound as .wav", action: () => exportWav(state.ord) },
                { label: "All sounds as .wav (.zip)", action: exportAllWav }
            ]);
        } else {
            showMenu(anchor($("btnExport")), [
                { label: "Song as .uge (hUGETracker, GB Studio)", kbd: "Ctrl+E", action: exportUge },
                { label: "Song as .wav", action: () => exportWav() },
                { label: "Song as .wav, looped", action: () => exportWav(undefined, 2) }
            ]);
        }
    }

    function openNewMenu() {
        showMenu(anchor($("btnNew")), [
            { label: "New song", action: () => newSong("song") },
            { sep: true },
            { label: "New sound effects (with examples)", action: () => newSong("examples") },
            { label: "New sound effects (empty)", action: () => newSong("sfx") },
            { sep: true },
            { label: "Import MIDI file…", action: () => confirmDiscard().then(ok => {
                if (ok) $("fileInput").click();
            }) },
            ...demoItems()
        ]);
    }

    function demoItems() {
        const list = Array.isArray(window.FUGE_DEMOS) ? window.FUGE_DEMOS.filter(d => d && d.song) : [];
        if (!list.length) return [];
        return [{ label: "Demos", sub: list.map(d => ({
            label: d.name + (d.artist ? " · " + d.artist : "") + (d.mode === "sfx" ? " (SFX)" : ""),
            action: () => openDemo(d)
        })) }];
    }

    function openDemo(d) {
        confirmDiscard().then(ok => {
            if (ok) loadText(JSON.stringify(d.song), "demo " + d.name, null);
        });
    }

    function openFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            const bytes = new Uint8Array(reader.result);
            const head = String.fromCharCode(...bytes.subarray(0, 4));
            if (head === "MThd" || head === "RIFF" || /\.midi?$/i.test(file.name)) importMidi(bytes, file.name);
            else loadText(new TextDecoder().decode(bytes), file.name, null);
        };
        reader.readAsArrayBuffer(file);
    }

    const BLD = { ord: 0, rows: 64, chords: [], layers: [], sel: -1, playing: false, row: -1, drag: null, saved: null, msg: "", guide: null, more: false, audition: null };
    const BLD_DEFAULT = { pulse: "rhythm/pulse07_broken_8ths", wave: "bass/bass04_driving_8ths", noise: "drums/drums01_rock" };
    const bldOpen = () => $("builderModal").classList.contains("open");
    const bldBeat = () => state.song.rowsPerBeat;
    const bldBar = () => state.song.rowsPerBeat * state.song.beatsPerBar;

    const bldSteps = () => BLD.guide && SCALES[BLD.guide.name] ? SCALES[BLD.guide.name].steps : null;
    const bldPcs = () => bldSteps() ? Builder.scaleNotes(BLD.guide.root, bldSteps()) : null;
    const bldName = c => Builder.chordName(c, bldPcs());
    const bldScaleLabel = () => bldSteps() ? Builder.spell(BLD.guide.root, bldPcs()) + " " + SCALES[BLD.guide.name].label.replace(/ \(.*\)$/, "").toLowerCase() : "";

    function bldGuideDefault() {
        const sc = state.song.scale || { root: 0, name: "Free" };
        return { root: sc.root || 0, name: SCALES[sc.name] ? sc.name : "Ionian" };
    }

    function bldPatternsFor(kind) {
        return Builder.library().filter(p => kind === "noise" ? p.drums : !p.drums);
    }

    function bldDefaultPattern(kind) {
        const list = bldPatternsFor(kind);
        const want = BLD_DEFAULT[kind];
        return (list.find(p => p.id === want) || list[0] || {}).id || "";
    }

    function bldDefaultInst(t) {
        const kind = TRACKS[t].kind;
        if (kind === "noise") return "";
        const idx = patIndex(t, BLD.ord);
        const pat = idx >= 0 ? state.song.tracks[t].patterns[idx] : null;
        const used = pat && pat.notes.length ? instById(pat.notes[0].inst) : null;
        if (used && used.type === kind) return used.id;
        const first = instsOf(kind)[0];
        return first ? first.id : "new:" + (kind === "wave" ? "Triangle Bass" : "Square Lead");
    }

    function bldSpread(list) {
        const step = Math.max(1, Math.floor(BLD.rows / list.length / bldBeat()) * bldBeat() || Math.floor(BLD.rows / list.length));
        return list.slice(0, Builder.MAX_CHORDS).map((c, k) => ({ row: Math.min(BLD.rows - 1, k * step), root: c.root, type: c.type }));
    }

    function bldDefaults() {
        BLD.guide = bldGuideDefault();
        const sc = state.song.scale || { root: 0, name: "Free" };
        const r = sc.root || 0;
        const minor = /aeolian|minor|dorian|phrygian/i.test(sc.name || "");
        const prog = minor ? [[0, "min"], [8, "maj"], [3, "maj"], [10, "maj"]] : [[0, "maj"], [9, "min"], [5, "maj"], [7, "maj"]];
        BLD.chords = bldSpread(prog.map(p => ({ root: (r + p[0]) % 12, type: p[1] })));
        BLD.layers = [2, 1].map(t => ({ ch: t, pattern: bldDefaultPattern(TRACKS[t].kind), octave: 0, inst: bldDefaultInst(t) }));
    }

    function openBuilder(o) {
        if (isSfx()) {
            toast("The pattern builder works on songs, not sound effects.");
            return;
        }
        if (!Builder.library().length) {
            toast("The pattern library isn't loaded. Run node tools/patterns.js to bundle web/patterns.");
            return;
        }
        if (state.playing) stop();
        hideMenu();
        BLD.ord = o === undefined ? state.ord : o;
        BLD.rows = ordRows(BLD.ord);
        if (BLD.saved) {
            BLD.chords = BLD.saved.chords.filter(c => c.row < BLD.rows).map(c => Object.assign({}, c));
            BLD.layers = BLD.saved.layers.map(l => Object.assign({}, l, { inst: l.inst && (l.inst.startsWith("new:") || instById(l.inst)) ? l.inst : bldDefaultInst(l.ch) }));
            BLD.guide = BLD.saved.guide || bldGuideDefault();
        } else bldDefaults();
        BLD.sel = BLD.chords.length ? 0 : -1;
        BLD.msg = "";
        BLD.audition = null;
        $("bldProg").value = BLD.chords.map(bldName).join(" ");
        BLD.lastProg = $("bldProg").value;
        $("builderModal").classList.add("open");
        bldRender();
        $("bldStrip").focus();
    }

    function closeBuilder() {
        bldStop();
        BLD.saved = { chords: BLD.chords.map(c => Object.assign({}, c)), layers: BLD.layers.map(l => Object.assign({}, l)), guide: BLD.guide };
        $("builderModal").classList.remove("open");
    }

    function bldRender() {
        $("bldWhere").textContent = "Order " + pad2(BLD.ord) + " · " + BLD.rows + " rows" + (BLD.rows % bldBar() ? "" : " · " + BLD.rows / bldBar() + " bar" + (BLD.rows / bldBar() === 1 ? "" : "s"));
        const msg = $("bldProgMsg");
        msg.textContent = BLD.msg;
        msg.classList.toggle("bad", /isn't|Up to/.test(BLD.msg));
        bldRenderGuide();
        bldRenderChord();
        bldRenderLayers();
        bldDraw();
        bldFoot();
    }

    function bldRenderGuide() {
        const pcs = bldPcs();
        $("bldKey").innerHTML = Builder.ROOTS.map((r, k) => "<option value=\"" + k + "\"" + (BLD.guide && k === BLD.guide.root ? " selected" : "") + ">" + Builder.spell(k, BLD.guide && SCALES[BLD.guide.name] ? Builder.scaleNotes(k, SCALES[BLD.guide.name].steps) : null) + "</option>").join("");
        $("bldScale").innerHTML = "<option value=\"\">No guide</option>" + Object.keys(SCALES).map(k => "<option value=\"" + k + "\"" + (BLD.guide && k === BLD.guide.name ? " selected" : "") + ">" + esc(SCALES[k].label) + "</option>").join("");
        $("bldKey").disabled = false;
        $("bldMore").checked = BLD.more;
        $("bldMore").disabled = !pcs;
        if (!pcs) {
            $("bldGuide").innerHTML = "";
            $("bldGuideHint").textContent = "Pick a scale to see the chords that fit it.";
            return;
        }
        const sel = BLD.chords[BLD.sel];
        const same = c => sel && sel.root === c.root && sel.type === c.type;
        const aud = c => BLD.audition && BLD.audition.root === c.root && BLD.audition.type === c.type;
        const btn = (c, cls) => "<button type=\"button\" class=\"btn small " + cls + (aud(c) ? " aud" : "") + "\" data-g=\"" + c.root + ":" + c.type + "\" aria-pressed=\"" + same(c) + "\" title=\"" + esc(bldName(c) + " · " + Builder.chordType(c.type).name + (c.numeral ? " · " + c.numeral : "")) + "\">" + esc(bldName(c)) + "</button>";
        $("bldGuide").innerHTML = Builder.guide(BLD.guide.root, bldSteps()).map(d => {
            const extra = BLD.more ? d.extra.map(c => btn(c, "g-alt")).join("") : "";
            if (!d.primary && !extra) return "";
            return "<div class=\"bld-deg\"><span class=\"bld-num\">" + esc(d.primary && d.primary.numeral ? d.primary.numeral : Builder.spell(d.pc, pcs)) + "</span>" + (d.primary ? btn(d.primary, "g-main") : "") + extra + "</div>";
        }).join("");
        bldGuideHint();
    }

    function bldGuideHint() {
        const sel = BLD.chords[BLD.sel];
        const a = BLD.audition;
        const full = !sel && BLD.chords.length >= Builder.MAX_CHORDS;
        $("bldUse").hidden = !a;
        if (a) {
            $("bldUse").textContent = "Use " + bldName(a);
            $("bldUse").disabled = full;
        }
        $("bldGuideHint").textContent = a ? (sel ? "replaces " + bldName(sel) + ", then selects the next chord." : full ? "Select a chord on the strip to replace it (up to " + Builder.MAX_CHORDS + " chords)." : "adds it after the last chord.") : "Click a chord to hear it, then Use (or double-click) to " + (sel ? "set " + bldName(sel) + "." : full ? "set the chord you select on the strip." : "add it.");
    }

    function bldAudition(c) {
        BLD.audition = { root: c.root, type: c.type };
        for (const b of $("bldGuide").querySelectorAll("[data-g]")) b.classList.toggle("aud", b.dataset.g === c.root + ":" + c.type);
        bldGuideHint();
        bldStrum(c, true);
    }

    function bldGuidePick(c) {
        BLD.audition = null;
        const pick = { root: c.root, type: c.type };
        if (BLD.sel >= 0 && BLD.chords[BLD.sel]) {
            const cur = BLD.chords[BLD.sel];
            cur.root = pick.root;
            cur.type = pick.type;
            const s = bldSorted();
            const i = s.findIndex(x => x.k === BLD.sel);
            BLD.sel = i + 1 < s.length ? s[i + 1].k : -1;
            BLD.msg = "";
            bldSyncProg();
            bldRender();
            bldChanged();
            bldStrum(cur);
            return;
        }
        if (BLD.chords.length >= Builder.MAX_CHORDS) {
            BLD.msg = "Up to " + Builder.MAX_CHORDS + " chords. Select one on the strip to change it.";
            bldRender();
            return;
        }
        const s = bldSorted();
        const step = Math.max(bldBeat(), Math.floor(BLD.rows / Builder.MAX_CHORDS / bldBeat()) * bldBeat());
        const row = s.length ? s[s.length - 1].c.row + step : 0;
        if (row >= BLD.rows || BLD.chords.some(x => x.row === row)) {
            BLD.msg = "No room after the last chord. Select a chord on the strip to change it, or click the strip to place one.";
            bldRender();
            return;
        }
        BLD.chords.push(Object.assign({ row }, pick));
        BLD.sel = -1;
        BLD.msg = "";
        bldSyncProg();
        bldRender();
        bldChanged();
        bldStrum(pick);
    }

    function bldFoot() {
        const chs = BLD.layers.filter(l => l.pattern).map(l => TRACKS[l.ch].name);
        $("bldApply").textContent = "Apply to order " + pad2(BLD.ord);
        $("bldApply").disabled = !chs.length;
        const melodic = BLD.layers.some(l => l.pattern && TRACKS[l.ch].kind !== "noise");
        $("bldNote").textContent = !chs.length ? "Add a layer to build something." : melodic && !BLD.chords.length ? "Place a chord: melodic layers only play under chords." : "Replaces " + chs.join(", ") + " in this order.";
        $("bldPlay").textContent = BLD.playing ? "■ Stop" : "▶ Play";
    }

    function bldRenderChord() {
        const box = $("bldChord");
        const c = BLD.chords[BLD.sel];
        if (!c) {
            box.innerHTML = "<p class=\"hint\">" + (BLD.chords.length < Builder.MAX_CHORDS ? "Click the strip to place a chord (it snaps to beats; hold Shift for any row). " : "") + "Each chord lasts until the next one. Drag a chord to move it, right-click to remove it.</p>";
            return;
        }
        const roots = Builder.ROOTS.map((r, k) => "<option value=\"" + k + "\"" + (k === c.root ? " selected" : "") + ">" + Builder.spell(k, bldPcs()) + "</option>").join("");
        const types = Builder.CHORDS.map(t => "<option value=\"" + t.id + "\"" + (t.id === c.type ? " selected" : "") + ">" + (t.label || "maj") + " · " + t.name + "</option>").join("");
        const pcs = bldPcs();
        const out = pcs && !Builder.fitsScale(c, pcs);
        box.innerHTML = "<b>" + esc(bldName(c)) + "</b>" +
            "<select data-bc=\"root\" aria-label=\"Chord root\">" + roots + "</select>" +
            "<select data-bc=\"type\" aria-label=\"Chord type\">" + types + "</select>" +
            "<label>from row <input type=\"number\" data-bc=\"row\" min=\"0\" max=\"" + (BLD.rows - 1) + "\" value=\"" + c.row + "\"></label>" +
            "<button class=\"btn small\" type=\"button\" data-bc=\"hear\">▶ Hear chord</button>" +
            "<button class=\"btn small\" type=\"button\" data-bc=\"del\">Remove</button>" +
            "<span class=\"hint\">" + (out ? "<span class=\"bld-out\">Outside " + esc(bldScaleLabel()) + ", a borrowed chord.</span> " : "") + (Builder.chordType(c.type).map && Object.keys(Builder.chordType(c.type).map).length ? "Uses the " + Builder.chordType(c.type).variant + " patterns, with the chord tones adjusted." : "") + "</span>";
    }

    function bldRenderLayers() {
        const used = BLD.layers.map(l => l.ch);
        const groupName = g => g.charAt(0).toUpperCase() + g.slice(1);
        $("bldLayers").innerHTML = BLD.layers.map((l, k) => {
            const kind = TRACKS[l.ch].kind;
            const chOpts = TRACKS.map((t, i) => "<option value=\"" + i + "\"" + (i === l.ch ? " selected" : "") + (used.includes(i) && i !== l.ch ? " disabled" : "") + ">" + t.name + "</option>").join("");
            const groups = new Map();
            const first = kind === "wave" ? "bass" : kind === "pulse" ? "rhythm" : "";
            const pats = bldPatternsFor(kind).slice().sort((a, b) => (a.group === first ? 0 : 1) - (b.group === first ? 0 : 1));
            for (const p of pats) {
                if (!groups.has(p.group)) groups.set(p.group, []);
                groups.get(p.group).push(p);
            }
            const barTs = state.song.beatsPerBar + "/4";
            const fits = p => p.ts === barTs || (state.song.beatsPerBar === 2 && p.ts === "6/8") ? 0 : 1;
            const patOpts = [...groups.entries()].map(([g, ps]) => "<optgroup label=\"" + esc(groupName(g)) + "\">" + ps.slice().sort((a, b) => fits(a) - fits(b)).map(p => "<option value=\"" + esc(p.id) + "\"" + (p.id === l.pattern ? " selected" : "") + ">" + esc(p.name) + (p.ts !== barTs ? " (" + p.ts + ")" : "") + (p.variants.maj && p.variants.min ? "" : p.variants.maj ? " · maj" : p.variants.min ? " · min" : "") + "</option>").join("") + "</optgroup>").join("");
            const octOpts = [-2, -1, 0, 1, 2].map(v => "<option value=\"" + v + "\"" + (v === (l.octave || 0) ? " selected" : "") + ">" + (v > 0 ? "+" + v : v === 0 ? "±0" : "−" + -v) + " oct</option>").join("");
            let instHtml;
            if (kind === "noise") instHtml = "<span class=\"hint\">Drums use the matching noise instruments, added if missing.</span>";
            else {
                const own = instsOf(kind).map(i => "<option value=\"" + i.id + "\"" + (i.id === l.inst ? " selected" : "") + ">" + pad2(instNum(i)) + " · " + esc(i.name) + "</option>").join("");
                const fresh = Presets.LIBRARY[kind].map(p => "<option value=\"new:" + esc(p.name) + "\"" + ("new:" + p.name === l.inst ? " selected" : "") + ">New: " + esc(p.name) + "</option>").join("");
                instHtml = "<select data-bl=\"inst\" aria-label=\"Instrument\">" + (own ? "<optgroup label=\"In this song\">" + own + "</optgroup>" : "") + "<optgroup label=\"Add a preset\">" + fresh + "</optgroup></select>";
            }
            const p = Builder.byId(l.pattern);
            return "<div class=\"bld-layer\" data-k=\"" + k + "\" style=\"--c:var(" + TRACKS[l.ch].color + ")\">" +
                "<select data-bl=\"ch\" aria-label=\"Channel\">" + chOpts + "</select>" +
                "<select data-bl=\"pattern\" aria-label=\"Pattern\">" + patOpts + "</select>" +
                (kind === "noise" ? "<span></span>" : "<select data-bl=\"octave\" aria-label=\"Octave\">" + octOpts + "</select>") +
                instHtml +
                "<button class=\"btn small icon\" type=\"button\" data-bl=\"del\" title=\"Remove this layer\" aria-label=\"Remove this layer\">×</button>" +
                "<p class=\"bld-desc\">" + esc(p ? p.desc || p.name : "") + "</p></div>";
        }).join("");
        $("bldAdd").disabled = BLD.layers.length >= 4;
    }

    function bldResolver(extra) {
        const made = [];
        const count = kind => instsOf(kind).length + made.filter(i => i.type === kind).length;
        const melodic = (kind, key) => {
            if (key && !key.startsWith("new:")) {
                const i = instById(key);
                if (i) return i;
            }
            const name = key && key.startsWith("new:") ? key.slice(4) : kind === "wave" ? "Triangle Bass" : "Square Lead";
            const have = made.find(i => i.type === kind && i.name === name);
            if (have) return have;
            if (count(kind) >= MAX_INST) {
                extra.full = true;
                return instsOf(kind)[0];
            }
            const inst = makeInst(kind, name);
            made.push(inst);
            return inst;
        };
        const drum = name => {
            const own = instsOf("noise").find(i => i.name.toLowerCase() === name.toLowerCase()) || made.find(i => i.name === name);
            if (own) return own;
            if (count("noise") >= MAX_INST) {
                extra.full = true;
                return instsOf("noise")[0] || made.find(i => i.type === "noise");
            }
            const inst = makeInst("noise", name);
            made.push(inst);
            return inst;
        };
        return { melodic, drum, made };
    }

    function bldBuild() {
        const extra = { full: false };
        const res = bldResolver(extra);
        const out = [];
        for (const l of BLD.layers) {
            const p = Builder.byId(l.pattern);
            if (!p) continue;
            const kind = TRACKS[l.ch].kind;
            const gen = Builder.generate(l, { rows: BLD.rows, rpb: state.song.rowsPerBeat, barRows: bldBar(), chords: BLD.chords });
            const notes = [];
            if (kind === "noise") {
                for (const g of gen) {
                    const inst = res.drum(g.drum);
                    if (!inst) continue;
                    notes.push({ row: g.row, len: 1, note: inst.note, inst: inst.id, fx: Builder.volumeFx(g.gain, "noise", inst.vol) });
                }
            } else {
                const inst = res.melodic(kind, l.inst);
                if (inst) for (const g of gen) notes.push({ row: g.row, len: g.len, note: g.note, inst: inst.id, fx: Builder.volumeFx(g.gain, kind, inst.vol) });
            }
            out.push({ ch: l.ch, notes });
        }
        return { layers: out, made: res.made, full: extra.full };
    }

    function bldDoc(built) {
        const doc = clone(state.song);
        doc.instruments = doc.instruments.concat(built.made.map(i => clone(i)));
        const slots = [0, 1, 2, 3].map(t => $("bldOthers").checked ? state.song.order[BLD.ord][t] : -1);
        for (const l of built.layers) {
            doc.tracks[l.ch].patterns.push({ notes: l.notes });
            slots[l.ch] = doc.tracks[l.ch].patterns.length - 1;
        }
        doc.order = [slots];
        doc.orderRows = [BLD.rows];
        return doc;
    }

    function bldSendPreview() {
        const doc = bldDoc(bldBuild());
        GBAudio.send({ type: "song", song: UGE.compile(doc).song });
    }

    function bldPlay() {
        if (BLD.playing) {
            bldStop();
            return;
        }
        if (state.playing) stop();
        BLD.playing = true;
        BLD.row = 0;
        GBAudio.start().catch(() => {
            toast("Couldn't start audio in this browser.");
            bldStop();
        });
        GBAudio.send({ type: "mute", mask: [true, true, true, true] });
        bldSendPreview();
        GBAudio.send({ type: "loop", on: true });
        GBAudio.send({ type: "play", order: 0, row: 0 });
        bldFoot();
    }

    function bldStop() {
        if (!BLD.playing) return;
        BLD.playing = false;
        BLD.row = -1;
        GBAudio.send({ type: "stop" });
        GBAudio.send({ type: "loop", on: state.loop });
        sendMute();
        pushSong();
        if (bldOpen()) {
            bldFoot();
            bldDraw();
        }
    }

    function bldChanged() {
        if (BLD.playing) bldSendPreview();
        bldDraw();
        bldFoot();
    }

    function bldStrum(c, force) {
        if (!c || (BLD.playing && !force)) return;
        if (BLD.playing) bldStop();
        const inst = makeInst("pulse", "Square Lead");
        inst.vol = 10;
        const tones = Builder.chordType(c.type).tones;
        const shift = c.root > 6 ? c.root - 12 : c.root;
        const notes = tones.map((t, k) => ({ row: k, len: tones.length - k + 5, note: 24 + shift + t, inst: inst.id, fx: null }));
        const bass = { row: 0, len: tones.length + 5, note: 12 + shift, inst: inst.id, fx: null };
        const doc = { name: "chord", speed: 4, rowsPerBeat: 4, beatsPerBar: 4, instruments: [inst], tracks: [{ patterns: [{ notes }] }, { patterns: [{ notes: [bass] }] }, { patterns: [] }, { patterns: [] }], order: [[0, 0, -1, -1]], orderRows: [tones.length + 6] };
        if (state.playing) stop();
        GBAudio.start().catch(() => {});
        GBAudio.send({ type: "mute", mask: [true, true, true, true] });
        GBAudio.send({ type: "song", song: UGE.compile(doc).song });
        GBAudio.send({ type: "loop", on: false });
        GBAudio.send({ type: "play", order: 0, row: 0, once: true, cutAtEnd: true });
        clearTimeout(bldStrum.t);
        bldStrum.t = setTimeout(() => {
            if (!BLD.playing && !state.playing) {
                GBAudio.send({ type: "loop", on: state.loop });
                sendMute();
                pushSong();
            }
        }, 900);
    }

    function bldGeom() {
        const cv = $("bldStrip");
        const w = cv.clientWidth || 600;
        return { cv, w, rowW: w / BLD.rows };
    }

    function bldSorted() {
        return BLD.chords.map((c, k) => ({ c, k })).sort((a, b) => a.c.row - b.c.row);
    }

    function bldPills(w) {
        const rowW = w / BLD.rows;
        const sorted = bldSorted();
        return sorted.map((s, i) => {
            const end = i + 1 < sorted.length ? sorted[i + 1].c.row : BLD.rows;
            const x = s.c.row * rowW;
            const pw = Math.min((end - s.c.row) * rowW - 2, Math.max(34, bldName(s.c).length * 8 + 14));
            return { k: s.k, x, w: Math.max(14, pw), end };
        });
    }

    function bldDraw() {
        if (!bldOpen()) return;
        const { cv, w, rowW } = bldGeom();
        const h = 46;
        const ctx = prep(cv, w, h, true);
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, w, h);
        const bar = bldBar();
        for (let r = 0; r <= BLD.rows; r += bldBeat()) {
            ctx.fillStyle = r % bar === 0 ? P.bar : P.beat;
            ctx.fillRect(Math.round(r * rowW), 0, 1, h);
        }
        const pills = bldPills(w);
        const sorted = bldSorted();
        pills.forEach((p, i) => {
            const c = BLD.chords[p.k];
            const sel = p.k === BLD.sel;
            ctx.globalAlpha = i % 2 ? 0.16 : 0.24;
            ctx.fillStyle = P.accent;
            ctx.fillRect(p.x, 24, (p.end - c.row) * rowW, h - 24);
            ctx.globalAlpha = 1;
            ctx.fillStyle = sel ? P.accent : P.panel2;
            roundRect(ctx, p.x + 1, 3, p.w, 19, 4);
            ctx.fill();
            const pcs = bldPcs();
            ctx.strokeStyle = sel ? P.accent : P.lineStrong;
            ctx.lineWidth = 1;
            if (pcs && !Builder.fitsScale(c, pcs)) {
                ctx.setLineDash([3, 2]);
                ctx.strokeStyle = sel ? P.ink : P.muted;
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = sel ? P.panel : P.ink;
            ctx.font = "600 12px " + P.body;
            ctx.save();
            ctx.beginPath();
            ctx.rect(p.x + 1, 3, p.w, 19);
            ctx.clip();
            ctx.fillText(bldName(c), p.x + 7, 17);
            ctx.restore();
        });
        if (!sorted.length) {
            ctx.fillStyle = P.muted;
            ctx.font = "12px " + P.body;
            ctx.fillText("Click to place a chord", 10, 28);
        }
        if (BLD.playing && BLD.row >= 0) {
            ctx.fillStyle = P.accent;
            ctx.fillRect(Math.round(BLD.row * rowW), 0, 2, h);
        }
        bldDrawRoll();
    }

    function bldDrawRoll() {
        const cv = $("bldRoll");
        const w = cv.clientWidth || 600;
        const h = 190;
        const ctx = prep(cv, w, h, true);
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, w, h);
        const rowW = w / BLD.rows;
        const bar = bldBar();
        for (let r = 0; r <= BLD.rows; r += bldBeat()) {
            ctx.fillStyle = r % bar === 0 ? P.bar : P.beat;
            ctx.fillRect(Math.round(r * rowW), 0, 1, h);
        }
        const built = bldBuild();
        const lanes = built.layers.length || 1;
        const laneH = h / lanes;
        built.layers.forEach((l, i) => {
            const y0 = i * laneH;
            if (i) {
                ctx.fillStyle = P.line;
                ctx.fillRect(0, Math.round(y0), w, 1);
            }
            const color = P.ch[l.ch];
            if (TRACKS[l.ch].kind === "noise") {
                const names = [...new Set(l.notes.map(n => n.inst))];
                const rowH = Math.max(3, Math.min(10, (laneH - 8) / Math.max(1, names.length)));
                for (const n of l.notes) {
                    const k = names.indexOf(n.inst);
                    ctx.globalAlpha = n.fx ? 0.55 : 1;
                    ctx.fillStyle = color;
                    ctx.fillRect(n.row * rowW + 1, y0 + 4 + k * rowH, Math.max(2, rowW - 2), rowH - 1);
                }
                ctx.globalAlpha = 1;
                return;
            }
            if (!l.notes.length) return;
            const lo = Math.min(...l.notes.map(n => n.note)) - 1;
            const hi = Math.max(...l.notes.map(n => n.note)) + 1;
            const span = Math.max(8, hi - lo);
            const nh = Math.max(2, Math.min(6, (laneH - 8) / span));
            for (const n of l.notes) {
                const y = y0 + 4 + (hi - n.note) / span * (laneH - 8 - nh);
                ctx.globalAlpha = n.fx ? 0.6 : 1;
                ctx.fillStyle = color;
                ctx.fillRect(n.row * rowW + 1, y, Math.max(2, n.len * rowW - 2), nh);
            }
            ctx.globalAlpha = 1;
        });
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = P.accent;
        for (const reg of Builder.regions(BLD.chords, BLD.rows)) ctx.fillRect(Math.round(reg.from * rowW), 0, 1, h);
        ctx.globalAlpha = 1;
        ctx.font = "10px " + P.mono;
        built.layers.forEach((l, i) => {
            const label = TRACKS[l.ch].short;
            const y0 = i * laneH;
            ctx.fillStyle = P.panel;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(2, y0 + 2, ctx.measureText(label).width + 6, 13);
            ctx.globalAlpha = 1;
            ctx.fillStyle = P.muted;
            ctx.fillText(label, 5, y0 + 12);
        });
        if (!built.layers.length) {
            ctx.fillStyle = P.muted;
            ctx.font = "12px " + P.body;
            ctx.fillText("Add a layer to see its notes here.", 10, 22);
        }
        if (BLD.playing && BLD.row >= 0) {
            ctx.fillStyle = P.accent;
            ctx.fillRect(Math.round(BLD.row * rowW), 0, 2, h);
        }
    }

    function bldRowAt(e, snap) {
        const { cv, rowW } = bldGeom();
        const x = e.clientX - cv.getBoundingClientRect().left;
        let r = clamp(Math.floor(x / rowW), 0, BLD.rows - 1);
        if (snap) r = Math.floor(r / bldBeat()) * bldBeat();
        return r;
    }

    function bldPillAt(e) {
        const { cv, w } = bldGeom();
        const rect = cv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const hit = bldPills(w).filter(p => x >= p.x && x <= p.x + p.w + 1 && y <= 24);
        return hit.length ? hit[hit.length - 1].k : -1;
    }

    function bldPlace(row) {
        if (BLD.chords.some(c => c.row === row)) return;
        if (BLD.chords.length >= Builder.MAX_CHORDS) {
            BLD.msg = "Up to " + Builder.MAX_CHORDS + " chords. Drag one to move it, or right-click to remove it.";
            bldRender();
            return;
        }
        const prev = bldSorted().filter(s => s.c.row < row).pop();
        const c = { row, root: prev ? prev.c.root : (state.song.scale && state.song.scale.root) || 0, type: prev ? prev.c.type : "maj" };
        BLD.chords.push(c);
        BLD.sel = BLD.chords.length - 1;
        BLD.msg = "";
        bldSyncProg();
        bldRender();
        bldChanged();
        bldStrum(c);
    }

    function bldRemove(k) {
        if (k < 0 || !BLD.chords[k]) return;
        BLD.chords.splice(k, 1);
        BLD.sel = BLD.chords.length ? Math.min(k, BLD.chords.length - 1) : -1;
        BLD.msg = "";
        bldSyncProg();
        bldRender();
        bldChanged();
    }

    function bldSyncProg() {
        $("bldProg").value = bldSorted().map(s => bldName(s.c)).join(" ");
        BLD.lastProg = $("bldProg").value;
    }

    function bldTypeProg() {
        if ($("bldProg").value === BLD.lastProg) return;
        BLD.lastProg = $("bldProg").value;
        const tokens = $("bldProg").value.split(/[\s,|]+/).filter(Boolean);
        const list = [];
        for (const t of tokens) {
            const c = Builder.parseChord(t) || Builder.parseRoman(t, BLD.guide ? BLD.guide.root : 0, bldSteps() || SCALES.Ionian.steps);
            if (!c) {
                BLD.msg = "“" + t.slice(0, 10) + "” isn't a chord name. Try C, Am, F#m7, Bb7, Gsus4, Edim, Caug, or numerals like I vi IV V7.";
                bldRender();
                return;
            }
            list.push(c);
        }
        BLD.msg = list.length > Builder.MAX_CHORDS ? "Up to " + Builder.MAX_CHORDS + " chords: kept the first " + Builder.MAX_CHORDS + "." : "";
        BLD.chords = list.length ? bldSpread(list) : [];
        BLD.sel = BLD.chords.length ? 0 : -1;
        bldSyncProg();
        bldRender();
        bldChanged();
    }

    function bldApply() {
        const built = bldBuild();
        if (!built.layers.length) return;
        bldStop();
        checkpoint();
        for (const inst of built.made) state.song.instruments.push(inst);
        const o = BLD.ord;
        for (const l of built.layers) {
            const idx = patIndex(l.ch, o);
            const pats = state.song.tracks[l.ch].patterns;
            if (idx >= 0 && usage(l.ch, idx) === 1) pats[idx].notes = l.notes;
            else {
                pats.push({ notes: l.notes });
                state.song.order[o][l.ch] = pats.length - 1;
            }
        }
        const names = built.layers.map(l => TRACKS[l.ch].name);
        const prog = bldSorted().map(s => bldName(s.c)).join(" ");
        BLD.saved = { chords: BLD.chords.map(c => Object.assign({}, c)), layers: BLD.layers.map(l => Object.assign({}, l, { inst: l.inst })), guide: BLD.guide };
        $("builderModal").classList.remove("open");
        state.ord = o;
        state.sel = [];
        renderAll();
        status("Built " + names.join(", ") + " in order " + pad2(o) + (prog ? " over " + prog : "") + (built.made.length ? ", adding " + built.made.map(i => i.name).join(", ") : "") + ". Undo to take it back.");
        if (built.full) toast("An instrument list was full (15 per type), so some layers use an existing instrument instead.");
    }

    function bldLayerEvent(e) {
        const el = e.target.closest("[data-bl]");
        const row = e.target.closest(".bld-layer");
        if (!el || !row) return;
        const k = +row.dataset.k;
        const l = BLD.layers[k];
        const f = el.dataset.bl;
        if (f === "del" && e.type === "click") {
            BLD.layers.splice(k, 1);
            bldRender();
            bldChanged();
            return;
        }
        if (e.type !== "change") return;
        if (f === "ch") {
            const t = +el.value;
            const was = TRACKS[l.ch].kind;
            l.ch = t;
            if (TRACKS[t].kind !== was) {
                l.pattern = bldDefaultPattern(TRACKS[t].kind);
                l.octave = 0;
            }
            l.inst = bldDefaultInst(t);
        } else if (f === "pattern") l.pattern = el.value;
        else if (f === "octave") l.octave = parseInt(el.value, 10) || 0;
        else if (f === "inst") l.inst = el.value;
        bldRender();
        bldChanged();
    }

    function bldChordEvent(e) {
        const el = e.target.closest("[data-bc]");
        const c = BLD.chords[BLD.sel];
        if (!el || !c) return;
        const f = el.dataset.bc;
        if (e.type === "click") {
            if (f === "del") bldRemove(BLD.sel);
            if (f === "hear") bldStrum(c);
            return;
        }
        if (e.type !== "change") return;
        if (f === "root") c.root = +el.value;
        if (f === "type") c.type = el.value;
        if (f === "row") {
            const r = clamp(parseInt(el.value, 10) || 0, 0, BLD.rows - 1);
            if (!BLD.chords.some(x => x !== c && x.row === r)) c.row = r;
        }
        bldSyncProg();
        bldRender();
        bldChanged();
        if (f !== "row") bldStrum(c);
    }

    function initBuilder() {
        const strip = $("bldStrip");
        strip.addEventListener("pointerdown", e => {
            if (e.button !== 0) return;
            const k = bldPillAt(e);
            if (k >= 0) {
                BLD.sel = k;
                BLD.drag = { k, moved: false };
                strip.setPointerCapture(e.pointerId);
                bldRender();
                return;
            }
            bldPlace(bldRowAt(e, !e.shiftKey));
        });
        strip.addEventListener("pointermove", e => {
            if (!BLD.drag) {
                strip.style.cursor = bldPillAt(e) >= 0 ? "grab" : "crosshair";
                return;
            }
            const c = BLD.chords[BLD.drag.k];
            const r = bldRowAt(e, !e.shiftKey);
            if (r !== c.row && !BLD.chords.some(x => x !== c && x.row === r)) {
                c.row = r;
                BLD.drag.moved = true;
                bldRenderChord();
                bldDraw();
            }
        });
        strip.addEventListener("pointerup", () => {
            if (!BLD.drag) return;
            const moved = BLD.drag.moved;
            const c = BLD.chords[BLD.drag.k];
            BLD.drag = null;
            bldSyncProg();
            bldRender();
            if (moved) bldChanged();
            else bldStrum(c);
        });
        strip.addEventListener("contextmenu", e => {
            e.preventDefault();
            e.stopPropagation();
            bldRemove(bldPillAt(e));
        });
        strip.addEventListener("keydown", e => {
            if ((e.key === "Delete" || e.key === "Backspace") && BLD.sel >= 0) {
                e.preventDefault();
                bldRemove(BLD.sel);
            } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                if (!BLD.chords.length) return;
                const s = bldSorted();
                const i = Math.max(0, s.findIndex(x => x.k === BLD.sel));
                BLD.sel = s[clamp(i + (e.key === "ArrowRight" ? 1 : -1), 0, s.length - 1)].k;
                bldRender();
            }
        });
        const guideChord = e => {
            const b = e.target.closest("[data-g]");
            if (!b) return null;
            const [r, t] = b.dataset.g.split(":");
            return { root: +r, type: t };
        };
        $("bldGuide").addEventListener("click", e => {
            const c = guideChord(e);
            if (c && e.detail < 2) bldAudition(c);
        });
        $("bldGuide").addEventListener("dblclick", e => {
            const c = guideChord(e);
            if (c) bldGuidePick(c);
        });
        $("bldUse").onclick = () => {
            if (BLD.audition) bldGuidePick(BLD.audition);
        };
        $("bldKey").onchange = e => {
            BLD.guide = { root: +e.target.value, name: BLD.guide ? BLD.guide.name : "Ionian" };
            BLD.audition = null;
            bldSyncProg();
            bldRender();
        };
        $("bldScale").onchange = e => {
            BLD.guide = { root: BLD.guide ? BLD.guide.root : 0, name: e.target.value };
            BLD.audition = null;
            bldSyncProg();
            bldRender();
        };
        $("bldMore").onchange = e => {
            BLD.more = e.target.checked;
            bldRenderGuide();
        };
        $("bldChord").addEventListener("change", bldChordEvent);
        $("bldChord").addEventListener("click", bldChordEvent);
        $("bldLayers").addEventListener("change", bldLayerEvent);
        $("bldLayers").addEventListener("click", bldLayerEvent);
        $("bldProg").addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                bldTypeProg();
            }
        });
        $("bldProg").addEventListener("change", bldTypeProg);
        $("bldAdd").onclick = () => {
            const free = [3, 0, 1, 2].find(t => !BLD.layers.some(l => l.ch === t));
            if (free === undefined) return;
            BLD.layers.push({ ch: free, pattern: bldDefaultPattern(TRACKS[free].kind), octave: 0, inst: bldDefaultInst(free) });
            bldRender();
            bldChanged();
        };
        $("bldOthers").onchange = () => {
            if (BLD.playing) bldSendPreview();
        };
        $("bldPlay").onclick = bldPlay;
        $("bldApply").onclick = bldApply;
        $("bldClose").onclick = closeBuilder;
        $("builderModal").addEventListener("pointerdown", e => {
            if (e.target.id === "builderModal") closeBuilder();
        });
        $("ordBuild").onclick = () => openBuilder(state.ord);
        window.addEventListener("resize", () => {
            if (bldOpen()) bldDraw();
        });
    }

    const waveText = w => w.join(" ");

    function parseWave(text) {
        const t = text.trim();
        if (/^[0-9a-f]{32}$/i.test(t)) return { vals: [...t].map(c => parseInt(c, 16)) };
        const parts = t.split(/[\s,;]+/).filter(Boolean);
        const vals = [];
        for (const p of parts) {
            let v = NaN;
            if (/^\d+$/.test(p)) v = parseInt(p, 10);
            else if (/^(0x)?[0-9a-f]$/i.test(p)) v = parseInt(p.slice(-1), 16);
            if (!(v >= 0 && v <= 15)) return { error: "“" + p.slice(0, 12) + "” isn't a value from 0 to 15." };
            vals.push(v);
        }
        if (vals.length !== 32) return { error: vals.length + " value" + (vals.length === 1 ? "" : "s") + " so far; a waveform needs exactly 32." };
        return { vals };
    }

    let waveFor = null;

    function openWaveValues(inst) {
        waveFor = inst.id;
        $("waveText").value = waveText(inst.wave);
        $("waveModal").classList.add("open");
        checkWaveText();
        $("waveText").focus();
        $("waveText").select();
    }

    function checkWaveText() {
        const res = parseWave($("waveText").value);
        const msg = $("waveMsg");
        msg.classList.toggle("bad", !!res.error);
        msg.textContent = res.error || "32 values. Apply to use this shape.";
        $("waveApply").disabled = !!res.error;
        if (res.vals) drawWave($("wavePreview"), { type: "wave", wave: res.vals });
        return res;
    }

    function closeWaveValues() {
        $("waveModal").classList.remove("open");
        waveFor = null;
    }

    function applyWaveValues() {
        const res = checkWaveText();
        const inst = instById(waveFor);
        if (res.error || !inst) return;
        checkpoint();
        inst.wave = res.vals;
        closeWaveValues();
        renderEditor();
        refreshIcon(inst);
        preview(inst);
        status("Set " + inst.name + "'s waveform.");
    }

    function copyText(text) {
        const fallback = () => {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try {
                ok = document.execCommand("copy");
            } catch (e) {
                ok = false;
            }
            ta.remove();
            return ok;
        };
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallback());
        return Promise.resolve(fallback());
    }

    function showInfo(title, html) {
        $("infoTitle").textContent = title;
        $("infoBody").innerHTML = html;
        $("infoModal").classList.add("open");
        $("infoClose").focus();
    }

    function closeInfo() {
        $("infoModal").classList.remove("open");
    }

    function importMidi(bytes, file) {
        let res;
        try {
            res = MIDI.toSong(MIDI.parse(bytes), { name: file.replace(/\.(midi?|rmi)$/i, ""), file });
        } catch (err) {
            toast("Couldn't import " + file + ": " + err.message);
            return;
        }
        const r = res.report;
        if (!r.notes) {
            toast(file + " has no notes to import.");
            return;
        }
        loadSong(normalize(res.doc));
        state.dirty = true;
        updateTitle();
        scheduleAutosave();
        const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
        let h = "<table>" + TRACKS.map((t, k) => "<tr><td>" + t.name + "</td><td>" + (r.used[k] ? esc(r.used[k]) : "<i>nothing</i>") + "</td></tr>").join("") + "</table>";
        h += "<p>" + plural(r.orders, "order") + " · " + state.song.rowsPerBeat + " rows per beat · speed " + state.song.speed + " (≈ " + bpm().toFixed(0) + " BPM; the MIDI file is " + Math.round(r.bpm) + " BPM" + (r.tempoChanges ? " to start with" : "") + ").</p>";
        const notes = [];
        if (r.ignored.length) notes.push("Left out " + plural(r.ignored.length, "more track") + ": " + r.ignored.map(esc).join(", ") + ". fUGE takes the first four.");
        if (r.chords) notes.push("Dropped " + plural(r.chords, "chord note") + ": each Game Boy channel plays one note at a time, so pulse tracks keep the top note of a chord and Wave the bottom.");
        if (r.drums) notes.push("Dropped " + plural(r.drums, "drum hit") + " that landed on the same row as another; the kick or snare wins over hats and cymbals.");
        r.shifted.forEach(s => notes.push("Moved " + esc(s.track) + " " + (s.octaves > 0 ? "up " : "down ") + plural(Math.abs(s.octaves), "octave") + " to fit the Game Boy's range."));
        if (r.folded) notes.push(plural(r.folded, "note") + " still out of range " + (r.folded === 1 ? "was" : "were") + " moved by an octave.");
        if (r.melodicNoise) notes.push(esc(r.melodicNoise) + " went to the noise track but isn't a drum track, so its notes became drum hits by pitch.");
        if (r.drumsOnPitched) notes.push(r.drumsOnPitched.map(esc).join(", ") + " looks like drums but landed on a pitched channel.");
        if (r.quantised) notes.push(plural(r.quantised, "note") + " didn't sit on the grid and " + (r.quantised === 1 ? "was" : "were") + " moved to the nearest row.");
        if (r.volumes) notes.push(plural(r.volumes, "note") + " got a volume (C0y) from " + (r.volumes === 1 ? "its" : "their") + " velocity" + (r.volSplit ? " and volume changes" : "") + "; the loudest notes use the instrument's own volume.");
        if (r.volSplit) notes.push(plural(r.volSplit, "held note") + " with expression (CC11) or volume (CC7) changes " + (r.volSplit === 1 ? "was" : "were") + " split into " + r.volSteps + " volume steps, a new note wherever the level changes, since the Game Boy can only change a note's volume by restarting it.");
        if (r.volKept) notes.push(plural(r.volKept, "note") + " on Wave or with a pitch bend kept only " + (r.volKept === 1 ? "its" : "their") + " starting volume; expression changes inside " + (r.volKept === 1 ? "it were" : "them were") + " left out.");
        if (r.slides) notes.push("Turned " + plural(r.slides, "pitch bend") + " into slides.");
        if (r.bendsSimplified) notes.push(plural(r.bendsSimplified, "bend") + " went up and back down or wobbled, which a single slide can't follow, so " + (r.bendsSimplified === 1 ? "it was" : "they were") + " simplified to where the bend ends.");
        if (r.tempoChanges) notes.push("The file changes tempo partway through; fUGE used the first tempo. Add a Set speed effect (Fxx) where it changes.");
        if (notes.length) h += "<ul>" + notes.map(t => "<li>" + t + "</li>").join("") + "</ul>";
        showInfo("Imported " + file, h);
        status("Imported " + file + ". Save it as a project to keep it.");
    }

    function loadSong(song) {
        if (state.playing) stop();
        state.song = song;
        state.ord = 0;
        state.track = 0;
        state.sel = [];
        state.inst = null;
        state.startRow = 0;
        state.lastInst = { pulse: null, wave: null, noise: null };
        history.undo = [];
        history.redo = [];
        state.dirty = false;
        state.filePath = null;
        syncInstToTrack();
        scheduleAutosave();
        renderAll();
        centerRoll(true);
        updateTitle();
    }

    function newSong(kind) {
        confirmDiscard().then(ok => {
            if (ok) startNew(kind);
        });
    }

    function startNew(kind) {
        if (kind === "song") {
            loadSong(blankSong());
            status("New song. Draw on any track to begin.");
            return;
        }
        loadSong(sfxSet(kind === "examples"));
        state.drawLen = 2;
        status(kind === "examples" ? "Sound effects: each column is one sound. Pick one and press Space to hear it, then make it your own." : "Sound effects: each column is one sound. Draw a few notes and press Space.");
    }

    function applyTheme(t) {
        if (t) document.documentElement.dataset.theme = t;
        else delete document.documentElement.dataset.theme;
        readPalette();
        renderAll();
    }

    function toggleTheme() {
        const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
        const next = dark ? "light" : "dark";
        storeSet(THEME_KEY, next);
        applyTheme(next);
    }

    const TEXT_TYPES = ["text", "number", "search", "email", "url", "password", "tel"];

    function isTextEntry(t) {
        return !!t && (t.tagName === "TEXTAREA" || t.isContentEditable || (t.tagName === "INPUT" && TEXT_TYPES.includes(t.type)));
    }

    function typing(e) {
        return isTextEntry(e.target);
    }

    function controlKey(e) {
        const t = e.target;
        if (!t || !["SELECT", "INPUT", "BUTTON"].includes(t.tagName)) return false;
        return ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Home", "End", "PageUp", "PageDown"].includes(e.key);
    }

    function onKey(e) {
        if (e.key === "F1") {
            e.preventDefault();
            Desktop.openDocs();
            return;
        }
        if (document.querySelector(".ctx")) {
            if (e.key === "Escape") hideMenu();
            return;
        }
        const mod = e.ctrlKey || e.metaKey;
        const k = e.key.toLowerCase();
        if (mod && k === "s") {
            e.preventDefault();
            saveJson(e.shiftKey);
            return;
        }
        if (mod && k === "e") {
            e.preventDefault();
            exportPrimary();
            return;
        }
        if (mod && k === "o") {
            e.preventDefault();
            openProject();
            return;
        }
        if (bldOpen()) {
            const typing = e.target.closest("input, select, textarea");
            if (e.key === "Escape") {
                e.preventDefault();
                closeBuilder();
            } else if (!typing && (e.key === " " || e.code === "Space")) {
                e.preventDefault();
                bldPlay();
            }
            return;
        }
        if ($("waveModal").classList.contains("open")) {
            if (e.key === "Escape") {
                e.preventDefault();
                closeWaveValues();
            } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                applyWaveValues();
            }
            return;
        }
        if ($("infoModal").classList.contains("open")) {
            if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                closeInfo();
            }
            return;
        }
        if ($("presetModal").classList.contains("open")) {
            if (e.key === "Escape") closePresets();
            return;
        }
        if (typing(e)) return;
        if (!e.ctrlKey && !e.metaKey && controlKey(e)) return;
        if (!mod && !e.altKey && e.code === "Backquote") {
            e.preventDefault();
            if (!e.repeat) setKb(!state.kb);
            return;
        }
        if (state.kb && !mod && !e.altKey && KB_CODES.has(e.code)) {
            e.preventDefault();
            kbDown(e);
            return;
        }
        if (mod) {
            if (k === "z") {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            } else if (k === "y") {
                e.preventDefault();
                redo();
            } else if (k === "a") {
                e.preventDefault();
                selectAll();
            } else if (k === "c") {
                e.preventDefault();
                copySel();
            } else if (k === "x") {
                e.preventDefault();
                cutSel();
            } else if (k === "v") {
                e.preventDefault();
                pasteAt(pasteRow());
            } else if (k === "d") {
                e.preventDefault();
                duplicateSel();
            }
            return;
        }
        if (e.key === " ") {
            e.preventDefault();
            if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
            play();
            return;
        }
        const has = liveSel().length > 0;
        if (k === "d") setTool("draw");
        else if (k === "m") setTool("select");
        else if (k === "s") {
            if (!e.repeat && !G.slideKey) {
                G.slideKey = true;
                if (G.hover) setRollCursor(G.hover);
            }
        }
        else if (k === "e") setTool("erase");
        else if (["1", "2", "3", "4"].includes(k)) selectSlot(parseInt(k, 10) - 1, state.ord);
        else if (e.key === "Escape") clearSel();
        else if ((e.key === "Delete" || e.key === "Backspace") && has) {
            e.preventDefault();
            deleteSel();
        } else if (e.key.startsWith("Arrow")) {
            if (has) {
                e.preventDefault();
                if (e.key === "ArrowUp") transposeSel(e.shiftKey ? 12 : 1);
                else if (e.key === "ArrowDown") transposeSel(e.shiftKey ? -12 : -1);
                else nudgeSel((e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? state.song.rowsPerBeat : 1));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                selectSlot(state.track, state.ord + (e.key === "ArrowLeft" ? -1 : 1));
            }
        }
    }

    function kbBase() {
        const sc = state.song.scale;
        return 12 * state.kbOct + (SCALES[sc.name] && trackKind(state.track) !== "noise" ? sc.root : 0);
    }

    function kbValue(code) {
        if (G.drum) {
            const i = KB_FLAT.indexOf(code);
            return i >= 0 && i < G.lanes.length ? i : -1;
        }
        const sc = state.song.scale;
        let n = -1;
        if (!SCALES[sc.name]) {
            if (KB_FREE[code] !== undefined) n = kbBase() + KB_FREE[code];
        } else {
            const steps = SCALES[sc.name].steps;
            KB_ROWS.forEach((row, r) => {
                const k = row.indexOf(code);
                if (k < 0) return;
                n = kbBase() + 12 * r;
                for (let i = 0; i < k; i++) n += steps[i % steps.length];
            });
        }
        return n >= 0 && n <= NOTE_MAX ? n : -1;
    }

    function kbSound(v) {
        if (state.playing) return;
        let inst = null;
        let note = v;
        let ch = state.track;
        if (G.drum) {
            inst = G.lanes[v];
            note = inst.note;
            ch = 3;
        } else {
            inst = curInst();
            if (!inst || inst.type !== trackKind(state.track)) {
                if (!KB.warned) toast("Pick a " + KIND_LABEL[trackKind(state.track)] + " instrument to play it from the keyboard.");
                KB.warned = true;
                return;
            }
        }
        GBAudio.start().then(sendMute).catch(() => toast("Couldn't start audio in this browser."));
        GBAudio.send({ type: "preview", ch, inst: audioSpec(inst), note, fx: null, dur: G.drum ? 0.9 : 12 });
        KB.ch = ch;
    }

    function kbRelease() {
        if (KB.ch >= 0 && KB.ch !== 3) GBAudio.send({ type: "release", ch: KB.ch });
        KB.ch = -1;
    }

    function kbReveal(v) {
        if (G.drum) return;
        const sc = $("rollScroll");
        const view = sc.clientHeight - RULER_H;
        const y = (NOTE_MAX - v) * PITCH_H;
        if (y < sc.scrollTop || y + PITCH_H > sc.scrollTop + view) sc.scrollTop = Math.max(0, y - view / 2);
    }

    function kbDraw() {
        drawGrid();
        drawKeys();
    }

    function kbDown(e) {
        if (e.repeat) return;
        const v = kbValue(e.code);
        if (v < 0) return;
        KB.held.delete(e.code);
        KB.held.set(e.code, v);
        KB.sound = e.code;
        kbSound(v);
        kbReveal(v);
        kbDraw();
    }

    function kbUp(e) {
        if (!KB.held.has(e.code)) return;
        KB.held.delete(e.code);
        if (KB.sound === e.code) {
            const rest = [...KB.held.entries()].pop();
            if (rest) {
                KB.sound = rest[0];
                kbSound(rest[1]);
            } else {
                KB.sound = null;
                kbRelease();
            }
        }
        kbDraw();
    }

    function kbStopAll() {
        if (!KB.held.size && KB.ch < 0) return;
        KB.held.clear();
        KB.sound = null;
        kbRelease();
        kbDraw();
    }

    function kbHeld(v) {
        for (const x of KB.held.values()) if (x === v) return true;
        return false;
    }

    function kbSummary() {
        const sc = state.song.scale;
        if (trackKind(state.track) === "noise") return "Z, X, C… play the drum lanes from the top";
        const base = kbBase();
        return SCALES[sc.name] ? "the Z, A, Q and 1 rows play " + ROOT_NAMES[sc.root] + " " + SCALES[sc.name].label + " an octave apart, from " + noteName(base) + " on Z" : "no scale chosen, so it's a tracker layout (Z and Q rows white keys, S and 2 rows black) from " + noteName(base) + " on Z";
    }

    function setKb(on) {
        state.kb = on;
        kbStopAll();
        KB.warned = false;
        renderPatBar();
        renderHint();
        status(on ? "Keyboard piano on: " + kbSummary() + ". Press ` to turn it off." : "Keyboard piano off. D, S, E and 1–4 are shortcuts again.");
    }

    function shiftKbOct(d) {
        const v = clamp(state.kbOct + d, 0, KB_OCT_MAX);
        if (v === state.kbOct) return;
        kbStopAll();
        state.kbOct = v;
        renderPatBar();
        renderHint();
        status("Keyboard piano: " + kbSummary() + ".");
    }

    function setTool(t) {
        state.tool = t;
        renderPatBar();
        drawGrid();
    }

    function bindSplitter() {
        const sp = $("splitter");
        const main = $("main");
        let startY = 0;
        let startH = 0;
        sp.addEventListener("pointerdown", e => {
            startY = e.clientY;
            startH = main.querySelector(".arrange").getBoundingClientRect().height;
            sp.setPointerCapture(e.pointerId);
            sp.classList.add("drag");
        });
        sp.addEventListener("pointermove", e => {
            if (!sp.classList.contains("drag")) return;
            const max = main.getBoundingClientRect().height - 180;
            const h = clamp(startH + e.clientY - startY, 110, Math.max(110, max));
            main.style.setProperty("--arr-h", h + "px");
        });
        sp.addEventListener("pointerup", () => {
            sp.classList.remove("drag");
            renderRoll();
        });
    }

    function bind() {
        $("btnNew").onclick = () => ownMenu($("btnNew"), openNewMenu);
        $("btnOpen").onclick = openProject;
        $("fileInput").onchange = e => {
            const f = e.target.files[0];
            if (f) openFile(f);
            e.target.value = "";
        };
        $("btnSave").onclick = e => saveJson(e.shiftKey);
        Desktop.onClose(() => {
            storeSet(STORE_KEY, JSON.stringify(state.song));
            return state.dirty ? Desktop.ask("You have unsaved changes. Quit anyway? fUGE will restore them the next time you open it.") : true;
        });
        $("btnExport").onclick = () => ownMenu($("btnExport"), openExportMenu);
        $("sfxName").oninput = e => {
            const sx = curSfx();
            if (!sx) return;
            checkpoint("sfxname:" + state.ord);
            sx.name = e.target.value.slice(0, 32) || "Untitled";
            const b = document.querySelector(".ord-num[data-o=\"" + state.ord + "\"]");
            if (b) b.textContent = sx.name;
        };
        $("sfxName").onchange = () => renderArrange();
        $("ordRows").onchange = e => setOrderRows(state.ord, parseInt(e.target.value, 10));
        $("sfxRows").onchange = e => {
            const sx = curSfx();
            if (!sx) return;
            checkpoint();
            sx.rows = parseInt(e.target.value, 10);
            state.startRow = Math.min(state.startRow, sx.rows - 1);
            if (state.playing) stop();
            renderAll();
        };
        $("btnUndo").onclick = undo;
        $("btnRedo").onclick = redo;
        $("btnPlay").onclick = play;
        $("btnStop").onclick = () => {
            if (state.playing) stop();
            else {
                state.startRow = 0;
                drawRuler();
                updateLcd();
            }
        };
        $("btnLoop").onclick = () => {
            state.loop = !state.loop;
            GBAudio.send({ type: "loop", on: state.loop, once: isSfx() });
            renderTop();
        };
        const vol = parseInt(storeGet(VOL_KEY), 10);
        if (Number.isFinite(vol)) $("volume").value = String(clamp(vol, 0, 100));
        GBAudio.setVolume($("volume").value / 100);
        $("volume").oninput = e => {
            GBAudio.setVolume(e.target.value / 100);
            storeSet(VOL_KEY, e.target.value);
        };
        GBAudio.on(onAudio);
        $("btnTheme").onclick = toggleTheme;
        $("btnHelp").onclick = () => Desktop.openDocs();
        $("speed").onchange = e => {
            checkpoint();
            const v = parseInt(e.target.value, 10);
            if (isSfx()) curSfx().speed = v;
            else state.song.speed = v;
            renderTop();
            renderArrange();
            renderPatBar();
        };
        $("rpb").onchange = e => {
            checkpoint();
            state.song.rowsPerBeat = parseInt(e.target.value, 10);
            renderTop();
            renderRoll();
            renderPatBar();
            const bar = state.song.rowsPerBeat * state.song.beatsPerBar;
            if (!isSfx() && state.song.order.some((r, k) => ordRows(k) % bar)) {
                let fit = Math.min(bar, MAX_ROWS);
                while (fit * 2 <= MAX_ROWS) fit *= 2;
                status("A bar is now " + bar + " rows, so some orders end partway through a bar. Set them to a whole number of bars (" + fit + " rows is " + fit / bar + " bar" + (fit / bar === 1 ? "" : "s") + ") with the length menu in the arrangement bar, or right-click an order number → Length → Use for every order.");
            }
        };
        $("songName").oninput = e => {
            checkpoint("name");
            state.song.name = e.target.value;
        };
        $("songArtist").oninput = e => {
            checkpoint("artist");
            state.song.artist = e.target.value;
        };
        $("btnPresets").onclick = () => openPresets();
        $("presetClose").onclick = closePresets;
        $("infoClose").onclick = closeInfo;
        initBuilder();
        $("waveCancel").onclick = closeWaveValues;
        $("waveApply").onclick = applyWaveValues;
        $("waveText").addEventListener("input", checkWaveText);
        $("waveModal").addEventListener("pointerdown", e => {
            if (e.target.id === "waveModal") closeWaveValues();
        });
        $("infoModal").addEventListener("click", e => {
            if (e.target.id === "infoModal") closeInfo();
        });
        $("presetModal").addEventListener("click", e => {
            if (e.target.id === "presetModal") closePresets();
            else onPresetClick(e);
        });
        $("instList").addEventListener("click", e => {
            const nb = e.target.closest("[data-new]");
            if (nb) {
                const inst = addInstrument(nb.dataset.new);
                if (inst) {
                    selectInst(inst.id);
                    renderAll();
                }
                return;
            }
            const b = e.target.closest(".inst");
            if (b) selectInst(b.dataset.id);
        });
        const ed = $("instEditor");
        ed.addEventListener("input", onEditorInput);
        ed.addEventListener("change", onEditorChange);
        ed.addEventListener("click", onEditorClick);
        bindWaveDraw();
        $("trackHeads").addEventListener("click", e => {
            const m = e.target.closest("[data-mute]");
            const s = e.target.closest("[data-solo]");
            if (m) {
                state.mute[+m.dataset.mute] = !state.mute[+m.dataset.mute];
                renderArrange();
                sendMute();
                return;
            }
            if (s) {
                state.solo[+s.dataset.solo] = !state.solo[+s.dataset.solo];
                renderArrange();
                sendMute();
                return;
            }
            const h = e.target.closest(".track-head");
            if (h) selectSlot(+h.dataset.t, state.ord);
        });
        const lanes = $("lanes");
        lanes.addEventListener("click", e => {
            const slot = e.target.closest(".slot");
            if (slot) {
                selectSlot(+slot.dataset.t, +slot.dataset.o);
                return;
            }
            const on = e.target.closest(".ord-num");
            if (on) {
                selectSlot(state.track, +on.dataset.o);
                return;
            }
            if (e.target.closest("[data-add]")) orderOp("append");
        });
        lanes.addEventListener("dblclick", e => {
            const slot = e.target.closest(".slot");
            if (!slot) return;
            if (patIndex(+slot.dataset.t, +slot.dataset.o) < 0) setPattern("new");
        });
        $("ordAdd").onclick = () => orderOp("add");
        $("ordDup").onclick = () => orderOp("dup");
        $("ordLeft").onclick = () => orderOp("left");
        $("ordRight").onclick = () => orderOp("right");
        $("ordDel").onclick = () => orderOp("del");
        $("patSelect").onchange = e => setPattern(e.target.value);
        $("patUnique").onclick = makeUnique;
        $("patClear").onclick = clearPattern;
        const setScale = e => {
            const name = e && e.target.id === "scaleRoot" && $("scaleName").value === "Free" ? "Ionian" : $("scaleName").value;
            state.song.scale = { root: parseInt($("scaleRoot").value, 10), name };
            state.dirty = true;
            updateTitle();
            scheduleAutosave();
            renderPatBar();
            drawGrid();
            drawKeys();
            const sc = state.song.scale;
            status(sc.name === "Free" ? "Scale highlighting off." : "Showing " + ROOT_NAMES[sc.root] + " " + SCALES[sc.name].label + ". Darkened rows are outside the scale.");
        };
        $("scaleRoot").onchange = setScale;
        $("scaleName").onchange = setScale;
        $("toolDraw").onclick = () => setTool("draw");
        $("toolErase").onclick = () => setTool("erase");
        $("toolSelect").onclick = () => setTool("select");
        $("btnGhost").onclick = () => {
            state.ghost = !state.ghost;
            renderPatBar();
            drawGrid();
        };
        const roll = $("roll");
        roll.addEventListener("pointerdown", rollDown);
        roll.addEventListener("pointermove", rollMove);
        roll.addEventListener("pointerup", rollUp);
        roll.addEventListener("pointercancel", rollUp);
        roll.addEventListener("pointerleave", () => {
            if (G.drag) return;
            G.hover = null;
            drawGrid();
            if (!G.drum) drawKeys();
        });
        document.addEventListener("contextmenu", onContextMenu);
        document.addEventListener("pointerdown", e => {
            if (e.target.closest(".ctx")) return;
            menuSkip = menuOwner && menuOwner.contains(e.target) ? menuOwner : null;
            hideMenu();
        }, true);
        window.addEventListener("blur", hideMenu);
        window.addEventListener("resize", hideMenu);
        document.addEventListener("scroll", e => {
            if (menuRoot && (menuRoot.contains(e.target) || performance.now() - menuOpenedAt < 250)) return;
            hideMenu();
        }, true);
        $("keys").addEventListener("pointerdown", e => {
            const r = $("keys").getBoundingClientRect();
            const y = e.clientY - r.top;
            if (G.drum) {
                const inst = G.lanes[Math.floor(y / G.rowH)];
                if (!inst) return;
                selectInst(inst.id);
                preview(inst, inst.note, 3);
                return;
            }
            const inst = curInst();
            if (!inst || inst.type !== trackKind(state.track)) return;
            preview(inst, clamp(NOTE_MAX - Math.floor(y / PITCH_H), 0, NOTE_MAX), state.track);
        });
        $("ruler").addEventListener("click", e => {
            const r = $("ruler").getBoundingClientRect();
            const row = clamp(Math.floor((e.clientX - r.left) / G.colW), 0, ROWS - 1);
            if (state.playing) {
                state.playOrd = state.ord;
                state.playRow = row;
                GBAudio.send(playMsg(row));
            } else {
                state.startRow = row;
            }
            drawRuler();
            updateLcd();
        });
        const insp = $("inspector");
        insp.addEventListener("input", e => {
            if (e.target.type === "range") onInspector(e);
        });
        insp.addEventListener("change", e => {
            if (e.target.type !== "range") onInspector(e);
            else afterEdit();
        });
        insp.addEventListener("click", onInspector);
        document.addEventListener("keydown", onKey);
        document.addEventListener("keyup", kbUp);
        document.addEventListener("keyup", e => {
            if (e.key.toLowerCase() !== "s" || !G.slideKey) return;
            G.slideKey = false;
            if (G.hover) setRollCursor(G.hover);
        });
        window.addEventListener("blur", () => {
            G.slideKey = false;
        });
        window.addEventListener("blur", kbStopAll);
        $("btnKb").onclick = () => setKb(!state.kb);
        $("kbDown").onclick = () => shiftKbOct(-1);
        $("kbUp").onclick = () => shiftKbOct(1);
        document.addEventListener("change", e => {
            const t = e.target;
            if (t.tagName === "SELECT" || (t.tagName === "INPUT" && !isTextEntry(t))) t.blur();
        });
        document.addEventListener("click", e => {
            const b = e.target.closest("button");
            if (b && e.detail > 0 && !b.closest(".ctx")) b.blur();
        });
        bindSplitter();
        new ResizeObserver(() => {
            renderRoll();
            const inst = curInst();
            if (inst) drawEditorCanvases(inst);
        }).observe($("rollScroll"));
        matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
            if (!document.documentElement.dataset.theme) applyTheme(null);
        });
        window.addEventListener("dragover", e => e.preventDefault());
        window.addEventListener("drop", e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) openFile(f);
        });
        window.addEventListener("beforeunload", e => {
            storeSet(STORE_KEY, JSON.stringify(state.song));
            if (state.dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        });
    }

    function init() {
        const theme = storeGet(THEME_KEY);
        if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
        let song = null;
        const saved = storeGet(STORE_KEY);
        if (saved) {
            try {
                song = normalize(JSON.parse(saved));
            } catch (e) {
                song = null;
            }
        }
        state.song = song || demoSong();
        if (song && Desktop.desktop) state.filePath = storeGet(PATH_KEY) || null;
        syncInstToTrack();
        bind();
        readPalette();
        renderAll();
        centerRoll(true);
        status(song ? "Restored your last session." : "Welcome! This demo song, Sprout Village by Polter, shows off each channel, slides and instrument subpatterns. Click a slot in the arrangement to edit it.");
        updateTitle();
        if (document.fonts) document.fonts.ready.then(() => renderAll());
    }

    init();
})();
