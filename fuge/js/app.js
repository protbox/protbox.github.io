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
    const ROWS = 64;
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
        { code: 0x4, name: "Vibrato", kinds: ["pulse", "wave"], x: "speed", y: "depth", hint: "Flicks the pitch up by y. x sets the rate: 0 fastest, then 1, 3, 7, F slowest." },
        { code: 0x7, name: "Note delay", kinds: ["pulse", "wave", "noise"], x: "ticks", y: "ticks", hint: "Starts the note xy ticks into the row. Must be less than the song speed, and 00 never plays." },
        { code: 0x9, name: "Set duty", kinds: ["pulse"], x: "duty", y: "-", hint: "Changes the pulse width: 00 = 12.5%, 40 = 25%, 80 = 50%, C0 = 75%." },
        { code: 0xA, name: "Volume step", kinds: ["pulse", "wave", "noise"], x: "up", y: "down", hint: "Restarts the note x louder or y quieter. It happens once, at the start of the row." },
        { code: 0xC, name: "Set volume", kinds: ["pulse", "wave", "noise"], x: "0", y: "volume", hint: "Restarts the note at volume y (0–F). Keep x at 0." },
        { code: 0xE, name: "Note cut", kinds: ["pulse", "wave", "noise"], x: "ticks", y: "ticks", hint: "Silences the channel xy ticks into the row (00 = straight away)." },
        { code: 0x8, name: "Panning", kinds: ["pulse", "wave", "noise"], x: "left", y: "right", hint: "Sets the speaker mix for every channel (NR51). Bits in x are left, bits in y right: 8 = noise, 4 = wave, 2 = pulse 2, 1 = pulse 1." },
        { code: 0x5, name: "Master volume", kinds: ["pulse", "wave", "noise"], x: "left", y: "right", hint: "Sets the overall left/right volume, 0–7 each." },
        { code: 0xF, name: "Set speed", kinds: ["pulse", "wave", "noise"], x: "ticks", y: "ticks", hint: "Changes the song speed (ticks per row) from here on." }
    ];
    const STORE_KEY = "fuge.autosave";
    const THEME_KEY = "fuge.theme";
    const VOL_KEY = "fuge.volume";
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
        const s = blankSong();
        s.name = "First Steps";
        const id = name => s.instruments.find(i => i.name === name).id;
        const note = (row, len, n, inst, fx) => ({ row, len, note: n, inst, fx: fx || null });
        const melody = [[0, 4, 40], [4, 4, 43], [8, 6, 48], [14, 2, 47], [16, 6, 45], [22, 2, 43], [24, 8, 40], [32, 4, 41], [36, 4, 45], [40, 4, 48], [44, 4, 45], [48, 6, 47], [54, 2, 45], [56, 8, 43]];
        const lead = { notes: melody.map(m => note(m[0], m[1], m[2], id("Square Lead"))) };
        lead.notes[lead.notes.length - 1].fx = { code: 0x4, param: 0x34 };
        const chords = [[36, 0x47], [33, 0x37], [29, 0x47], [31, 0x47]];
        const harmony = { notes: [] };
        chords.forEach((c, bar) => {
            for (let k = 0; k < 4; k++) harmony.notes.push(note(bar * 16 + k * 4, 3, c[0], id("Pluck"), { code: 0x0, param: c[1] }));
        });
        const roots = [12, 9, 5, 7];
        const bass = { notes: [] };
        roots.forEach((r, bar) => {
            bass.notes.push(note(bar * 16, 3, r, id("Triangle Bass")));
            bass.notes.push(note(bar * 16 + 4, 2, r + 12, id("Triangle Bass")));
            bass.notes.push(note(bar * 16 + 8, 3, r, id("Triangle Bass")));
            bass.notes.push(note(bar * 16 + 12, 2, r + 12, id("Triangle Bass")));
        });
        const drums = { notes: [] };
        const hit = (row, name) => drums.notes.push(note(row, 1, s.instruments.find(i => i.name === name).note, id(name)));
        for (let bar = 0; bar < 4; bar++) {
            const b = bar * 16;
            hit(b, "Kick");
            hit(b + 8, "Kick");
            hit(b + 4, "Snare");
            hit(b + 12, "Snare");
            hit(b + 2, "Closed Hat");
            hit(b + 6, "Closed Hat");
            hit(b + 10, "Closed Hat");
            hit(b + 14, bar === 3 ? "Open Hat" : "Closed Hat");
        }
        s.tracks[0].patterns.push(lead);
        s.tracks[1].patterns.push(harmony);
        s.tracks[2].patterns.push(bass);
        s.tracks[3].patterns.push(drums);
        s.order = [[0, -1, 0, 0], [0, 0, 0, 0]];
        return s;
    }

    function num(v, lo, hi, d) {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? clamp(n, lo, hi) : d;
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
            ids.add(inst.id);
            s.instruments.push(inst);
        }
        const kindOf = new Map(s.instruments.map(i => [i.id, i.type]));
        TRACKS.forEach((t, k) => {
            const rt = raw.tracks[k] || {};
            const pats = (Array.isArray(rt.patterns) ? rt.patterns : []).map(p => {
                const notes = (p && Array.isArray(p.notes) ? p.notes : []).filter(n => n && kindOf.get(n.inst) === t.kind).map(n => {
                    const row = num(n.row, 0, ROWS - 1, 0);
                    const fx = n.fx && Number.isFinite(Number(n.fx.code)) ? { code: num(n.fx.code, 0, 15, 0), param: num(n.fx.param, 0, 255, 0) } : null;
                    return { row, len: num(n.len, 1, ROWS - row, 1), note: num(n.note, 0, t.kind === "noise" ? NOISE_MAX : NOTE_MAX, 24), inst: n.inst, fx };
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
        mute: [false, false, false, false],
        solo: [false, false, false, false],
        playing: false,
        loop: false,
        playOrd: 0,
        playRow: 0,
        startRow: 0,
        dirty: false
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
        autosaveTimer = setTimeout(() => storeSet(STORE_KEY, JSON.stringify(state.song)), 400);
        schedulePush();
    }

    let pushTimer = 0;

    function pushSong() {
        clearTimeout(pushTimer);
        if (!GBAudio.started) return;
        GBAudio.send({ type: "song", song: UGE.compile(state.song).song });
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
        if (inst.type === "wave") spec.waveIndex = -2;
        return spec;
    }

    function previewChannel(inst) {
        if (inst.type === "wave") return 2;
        if (inst.type === "noise") return 3;
        if (inst.sweepTime) return 0;
        return trackKind(state.track) === "pulse" ? state.track : 0;
    }

    function preview(inst, note, ch) {
        if (!inst || state.playing) return;
        const c = ch === undefined ? previewChannel(inst) : ch;
        const n = note === undefined ? (inst.type === "noise" ? inst.note : inst.type === "wave" ? 24 : 36) : note;
        GBAudio.start().then(sendMute).catch(() => toast("Couldn't start audio in this browser."));
        GBAudio.send({ type: "preview", ch: c, inst: audioSpec(inst), note: n, dur: inst.type === "noise" ? 0.9 : 0.45 });
    }

    const trackKind = t => TRACKS[t].kind;
    const instById = id => state.song.instruments.find(i => i.id === id) || null;
    const instsOf = kind => state.song.instruments.filter(i => i.type === kind);
    const instNum = inst => instsOf(inst.type).indexOf(inst) + 1;
    const patIndex = (t, o) => state.song.order[o] ? state.song.order[o][t] : -1;
    const usage = (t, idx) => state.song.order.filter(r => r[t] === idx).length;
    const curInst = () => instById(state.inst);
    const muted = k => state.mute[k] || (state.solo.some(Boolean) && !state.solo[k]);

    function patAt(t, o) {
        const i = patIndex(t, o);
        return i >= 0 ? state.song.tracks[t].patterns[i] : null;
    }

    const curPat = () => patAt(state.track, state.ord);

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
        state.track = clamp(t, 0, 3);
        state.ord = clamp(o, 0, state.song.order.length - 1);
        state.sel = [];
        if (trackKind(state.track) === "pulse") state.lastPulseTrack = state.track;
        syncInstToTrack();
        if (state.playing) {
            state.playOrd = state.ord;
            state.playRow = 0;
            GBAudio.send({ type: "play", order: state.ord, row: 0 });
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
            kind: { pulse: g("--ch1"), wave: g("--ch3"), noise: g("--ch4") }
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
        return inst.envDir === "down" ? Math.max(0, inst.vol - steps) : Math.min(15, inst.vol + steps);
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
        for (let v = 1; v <= 20; v++) speeds.push(v);
        if (!speeds.includes(s.speed)) speeds.push(s.speed);
        sp.innerHTML = speeds.map(v => "<option value=\"" + v + "\">" + v + "</option>").join("");
        sp.value = String(s.speed);
        const rp = $("rpb");
        const rpbs = [2, 3, 4, 6, 8];
        if (!rpbs.includes(s.rowsPerBeat)) rpbs.push(s.rowsPerBeat);
        rp.innerHTML = rpbs.map(v => "<option value=\"" + v + "\">" + v + "</option>").join("");
        rp.value = String(s.rowsPerBeat);
        $("bpm").textContent = "≈ " + bpm().toFixed(1) + " BPM";
        if (document.activeElement !== $("songName")) $("songName").value = s.name;
        if (document.activeElement !== $("songArtist")) $("songArtist").value = s.artist;
        $("btnUndo").disabled = !history.undo.length;
        $("btnRedo").disabled = !history.redo.length;
        $("btnLoop").setAttribute("aria-pressed", String(state.loop));
        $("btnPlay").setAttribute("aria-pressed", String(state.playing));
    }

    const bpm = () => 60 * VBLANK_HZ / (state.song.speed * state.song.rowsPerBeat);

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
                b.innerHTML = "<span class=\"num\">" + pad2(k + 1) + "</span><canvas></canvas><span class=\"name\">" + esc(inst.name) + "</span>";
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
            h += "<div class=\"field\"><span>Waveform <b>drag to draw</b></span><canvas class=\"wave-canvas\" id=\"waveCanvas\" aria-label=\"Waveform editor\"></canvas></div>";
            h += "<div class=\"chips\">" + Object.keys(Presets.SHAPE_LABELS).map(k => "<button type=\"button\" class=\"btn small\" data-shape=\"" + k + "\">" + Presets.SHAPE_LABELS[k] + "</button>").join("") + "</div>";
            h += "<label class=\"field\" style=\"grid-template-columns:auto 1fr;align-items:center;gap:8px\"><input type=\"checkbox\" data-k=\"mirror\"" + (state.waveMirror ? " checked" : "") + "><span>Draw both halves together (keeps the pitch)</span></label>";
            if (!isMirrored(inst.wave)) h += "<p class=\"hint warn\">This wave holds one cycle, so it sounds an octave lower than the notes you write.</p>";
            h += lengthFields(inst, 256);
        } else {
            h += "<canvas class=\"preview-canvas\" id=\"envCanvas\" aria-label=\"Volume over one second\"></canvas>";
            h += envFields(inst);
            h += "<div class=\"field\"><span>Noise type</span>" + seg("bits", [{ v: 15, label: "Smooth" }, { v: 7, label: "Metallic" }], inst.bits) + "</div>";
            h += range("note", "Default pitch", 0, NOISE_MAX, inst.note);
            h += "<p class=\"hint\">New hits use this pitch. Change a single hit in the note panel.</p>";
            h += lengthFields(inst, 64);
        }
        h += "<div class=\"chips\" style=\"align-items:center\"><button class=\"btn small\" type=\"button\" data-act=\"dup\"" + (instsOf(inst.type).length >= MAX_INST ? " disabled" : "") + ">Duplicate</button><button class=\"btn small\" type=\"button\" data-act=\"del\">Delete</button><span class=\"hint\" style=\"margin-left:auto\">" + (uses ? "Used by " + uses + " note" + (uses === 1 ? "" : "s") : "Not used yet") + "</span></div>";
        el.innerHTML = h;
        drawEditorCanvases(inst);
    }

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
        ctx.font = "10px " + getComputedStyle(document.body).getPropertyValue("--f-mono");
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
        let h = "<div class=\"ord-head\">" + order.map((r, o) => "<button type=\"button\" class=\"ord-num" + (o === state.ord ? " active" : "") + "\" data-o=\"" + o + "\" title=\"Order " + pad2(o) + "\">" + pad2(o) + "</button>").join("") +
            "<button type=\"button\" class=\"ord-add\" data-add=\"1\" title=\"Add an order at the end\">+</button></div>";
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
                        (u > 1 ? "<span class=\"reuse\" title=\"Used " + u + " times\">×" + u + "</span>" : "") + "<canvas data-t=\"" + k + "\" data-p=\"" + idx + "\"></canvas></div></button>";
                }
            });
            h += "</div>";
        });
        h += "<div class=\"playline\" id=\"playline\"></div>";
        $("lanes").innerHTML = h;
        $("lanes").querySelectorAll("canvas[data-p]").forEach(cv => drawClip(cv, +cv.dataset.t, +cv.dataset.p));
        const secs = order.length * ROWS * state.song.speed / VBLANK_HZ;
        $("arrInfo").textContent = order.length + " order" + (order.length === 1 ? "" : "s") + " · " + Math.floor(secs / 60) + ":" + pad2(Math.round(secs % 60)) + " long";
        $("ordLeft").disabled = state.ord === 0;
        $("ordRight").disabled = state.ord >= order.length - 1;
        positionPlayline();
    }

    function drawClip(cv, t, idx) {
        const w = SLOT_W - 8;
        const h = 36;
        const ctx = prep(cv, w, h);
        const pat = state.song.tracks[t].patterns[idx];
        if (!pat || !pat.notes.length) return;
        ctx.fillStyle = P.ch[t];
        const top = 14;
        const bh = h - top - 4;
        const sx = w / ROWS;
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
        pl.style.left = (state.playOrd * SLOT_W + state.playRow / ROWS * SLOT_W) + "px";
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
        $("patTitle").innerHTML = "<span class=\"chip\" style=\"--c:var(" + t.color + ")\">" + t.short + "</span><span class=\"where\">" + t.name + " · Order " + pad2(state.ord) + "</span>" +
            (u > 1 ? "<span class=\"shared\" title=\"Edits change every slot that uses this pattern. Use Make unique to edit just this one.\">Shared by " + u + " slots</span>" : "");
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
        $("toolDraw").setAttribute("aria-pressed", String(state.tool === "draw"));
        $("toolSelect").setAttribute("aria-pressed", String(state.tool === "select"));
        $("toolErase").setAttribute("aria-pressed", String(state.tool === "erase"));
        $("btnGhost").setAttribute("aria-pressed", String(state.ghost));
        $("btnGhost").disabled = t.kind === "noise";
    }

    const G = { colW: 16, rowH: PITCH_H, lanes: [], drum: false, w: 0, h: 0, hover: null };

    function renderRoll() {
        const scroll = $("rollScroll");
        const kind = trackKind(state.track);
        G.drum = kind === "noise";
        G.lanes = G.drum ? instsOf("noise") : [];
        G.colW = Math.max(12, Math.floor((scroll.clientWidth - KEY_W) / ROWS));
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
        ctx.font = "600 10px " + getComputedStyle(document.body).getPropertyValue("--f-mono");
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
        if (state.playing && state.playOrd === state.ord) {
            ctx.fillStyle = P.accent;
            ctx.fillRect(Math.floor(state.playRow) * G.colW, RULER_H - 3, G.colW, 3);
        }
        ctx.fillStyle = P.lineStrong;
        ctx.fillRect(0, RULER_H - 1, G.w, 1);
    }

    function drawKeys() {
        const cv = $("keys");
        const ctx = prep(cv, KEY_W, G.h);
        const mono = getComputedStyle(document.body).getPropertyValue("--f-mono");
        if (G.drum) {
            ctx.fillStyle = P.panel;
            ctx.fillRect(0, 0, KEY_W, G.h);
            ctx.font = "11px " + getComputedStyle(document.body).getPropertyValue("--f-body");
            G.lanes.forEach((inst, k) => {
                const y = k * G.rowH;
                if (inst.id === state.inst) {
                    ctx.fillStyle = P.accentSoft;
                    ctx.fillRect(0, y, KEY_W, G.rowH);
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
                const hover = G.hover && G.hover.pitch === n;
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
                if (n % 12 === 0 || hover) {
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
            for (let n = 0; n <= NOTE_MAX; n++) {
                const y = (NOTE_MAX - n) * PITCH_H;
                if (isBlack(n)) {
                    ctx.fillStyle = P.alt;
                    ctx.fillRect(0, y, G.w, PITCH_H);
                }
                ctx.fillStyle = n % 12 === 0 ? P.beat : P.line;
                ctx.globalAlpha = n % 12 === 0 ? 1 : 0.45;
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
                }
            });
            ctx.globalAlpha = 1;
        }
        const pat = curPat();
        if (pat) {
            const color = P.ch[state.track];
            ctx.font = "600 10px " + getComputedStyle(document.body).getPropertyValue("--f-mono");
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
                    if (r.w >= 10) {
                        ctx.fillStyle = P.panel;
                        ctx.globalAlpha = 0.5;
                        ctx.fillRect(r.x + r.w - 4, r.y + 3, 1, r.h - 6);
                        ctx.globalAlpha = 1;
                    }
                }
                if (n.fx) {
                    ctx.fillStyle = P.accent;
                    ctx.beginPath();
                    ctx.moveTo(r.x + 1, r.y + 1);
                    ctx.lineTo(r.x + 7, r.y + 1);
                    ctx.lineTo(r.x + 1, r.y + 7);
                    ctx.fill();
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
        if (state.playing && state.playOrd === state.ord) {
            ctx.fillStyle = P.accent;
            ctx.fillRect(Math.floor(state.playRow * G.colW), 0, 2, G.h);
        }
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
            if (!edge) preview(instById(hit.inst), hit.note, state.track);
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
                    preview(instById(n.inst), n.note, state.track);
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
            cv.style.cursor = state.tool === "select" || (e && e.shiftKey) ? "default" : G.drum ? "pointer" : "crosshair";
            return;
        }
        const r = noteRect(n);
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
            notes: sel.map(n => ({ dr: n.row - min, len: n.len, note: n.note, inst: n.inst, fx: n.fx ? { code: n.fx.code, param: n.fx.param } : null })),
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

    const VOLUMES = [{ label: "100%", y: 15 }, { label: "75%", y: 11 }, { label: "50%", y: 8 }, { label: "25%", y: 4 }, { label: "12%", y: 2 }];
    const FX_DEFAULT = { 0x0: 0x47, 0x4: 0x32, 0xc: 0x08, 0x3: 0x20, 0x7: 0x02, 0xe: 0x02, 0x5: 0x77, 0x8: 0xff };

    function fxDefault(code) {
        return FX_DEFAULT[code] !== undefined ? FX_DEFAULT[code] : 0x01;
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
            "<li><span class=\"kbd\">Space</span> play · <span class=\"kbd\">1</span>–<span class=\"kbd\">4</span> tracks · <span class=\"kbd\">D</span> <span class=\"kbd\">S</span> <span class=\"kbd\">E</span> tools</li>" +
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
        const codes = new Set(sel.map(n => n.fx ? n.fx.code : -1));
        const fxCode = codes.size === 1 ? [...codes][0] : -2;
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
        h += "<label class=\"field\"><span>Effect</span><select data-f=\"fx\">" + (fxCode === -2 ? "<option value=\"keep\" selected>— mixed —</option>" : "") +
            "<option value=\"\"" + (fxCode === -1 ? " selected" : "") + ">None</option>" +
            FX.filter(f => f.kinds.includes(kind)).map(f => "<option value=\"" + f.code + "\"" + (f.code === fxCode ? " selected" : "") + ">" + hex(f.code, 1) + "xy · " + f.name + "</option>").join("") + "</select></label>";
        if (fxDef) {
            const xs = new Set(sel.map(n => n.fx.param >> 4));
            const ys = new Set(sel.map(n => n.fx.param & 15));
            const x = xs.size === 1 ? [...xs][0] : -1;
            const y = ys.size === 1 ? [...ys][0] : -1;
            h += "<div class=\"nib\">" + nibSelect("fxx", x, "x · " + fxDef.x) + nibSelect("fxy", y, "y · " + fxDef.y) + "</div>";
            h += "<p class=\"hint\">" + (x >= 0 && y >= 0 ? "<b style=\"font-family:var(--f-mono)\">" + hex(fxDef.code, 1) + hex((x << 4) | y, 2) + "</b> " : "") + fxDef.hint + "</p>";
        }
        h += "<div class=\"field\"><span>Volume <b>sets C0y</b></span><div class=\"seg\" role=\"group\">" +
            VOLUMES.map(v => "<button type=\"button\" data-f=\"vol\" data-v=\"" + v.y + "\" aria-pressed=\"" + sel.every(n => n.fx && n.fx.code === 0xc && n.fx.param === v.y) + "\">" + v.label + "</button>").join("") + "</div></div>";
        h += "<div><button type=\"button\" class=\"btn small\" data-f=\"delete\">Delete " + (one ? (kind === "noise" ? "hit" : "note") : sel.length + " " + noun(sel.length)) + "</button></div>";
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
            else if (f === "tr") transposeSel(parseInt(t.dataset.v, 10));
            else if (f === "vol") setFx(0xc, parseInt(t.dataset.v, 10));
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
            preview(instById(one.inst), one.note, state.track);
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
        if (f === "fx") {
            if (v === "keep") return;
            if (v === "") {
                setFx(null);
                return;
            }
            const code = parseInt(v, 10);
            applySel(n => {
                n.fx = { code, param: n.fx && n.fx.code === code ? n.fx.param : fxDefault(code) };
            });
            return;
        }
        if ((f === "fxx" || f === "fxy") && v !== "-1") {
            const k = parseInt(v, 10);
            applySel(n => {
                if (!n.fx) return;
                n.fx.param = f === "fxx" ? (k << 4) | (n.fx.param & 15) : (n.fx.param & 0xf0) | k;
            });
        }
    }

    let menuRoot = null;

    function hideMenu() {
        document.querySelectorAll(".ctx").forEach(m => m.remove());
        menuRoot = null;
    }

    function placeMenu(m, x, y, alt) {
        m.style.left = "0px";
        m.style.top = "0px";
        const r = m.getBoundingClientRect();
        let left = x;
        let top = y;
        if (left + r.width > innerWidth - 8) left = alt !== undefined ? alt - r.width : innerWidth - 8 - r.width;
        if (top + r.height > innerHeight - 8) top = Math.max(8, innerHeight - 8 - r.height);
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

    function showMenu(e, items) {
        hideMenu();
        const m = buildMenu(items);
        if (!m.children.length) return;
        menuRoot = m;
        document.body.appendChild(m);
        placeMenu(m, e.clientX, e.clientY);
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
            pitched && { label: "Vibrato", sub: [opt("Gentle", 0x4, 0x32), opt("Wide", 0x4, 0x34), opt("Fast", 0x4, 0x02), opt("Slow", 0x4, 0x72)] },
            pitched && { label: "Slide up", sub: [opt("Slow", 0x1, 0x04), opt("Medium", 0x1, 0x10), opt("Fast", 0x1, 0x30)] },
            pitched && { label: "Slide down", sub: [opt("Slow", 0x2, 0x04), opt("Medium", 0x2, 0x10), opt("Fast", 0x2, 0x30)] },
            pitched && { label: "Glide to note", sub: [opt("Slow", 0x3, 0x08), opt("Medium", 0x3, 0x20), opt("Fast", 0x3, 0x60)] },
            { label: "Note delay", sub: [opt("1 tick", 0x7, 1), opt("2 ticks", 0x7, 2), opt("3 ticks", 0x7, 3), opt("Half a row", 0x7, Math.max(1, Math.floor(state.song.speed / 2)))] },
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
            !has && { label: "Select tool", kbd: "S", checked: state.tool === "select", action: () => setTool("select") },
            !has && { label: "Erase tool", kbd: "E", checked: state.tool === "erase", action: () => setTool("erase") },
            has && { label: "Instrument", disabled: !insts.length, sub: insts.map(i => ({ label: pad2(instNum(i)) + "  " + i.name, checked: has && sel.every(n => n.inst === i.id), action: () => applySel(n => {
                n.inst = i.id;
                if (G.drum) n.note = i.note;
            }, "Instrument set to " + i.name + ".") })) },
            has && { label: "Effect", sub: fxMenu(kind) },
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
        return [
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
            { head: TRACKS[t].name + " · order " + pad2(o) },
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
            { label: "Duplicate", disabled: instsOf(inst.type).length >= MAX_INST, action: () => duplicateInstrument(inst) },
            { label: "Delete", danger: true, action: () => deleteInstrument(inst) }
        ]);
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
        const slot = e.target.closest(".slot");
        if (slot) {
            openSlotMenu(e, +slot.dataset.t, +slot.dataset.o);
            return;
        }
        const on = e.target.closest(".ord-num");
        if (on) {
            showMenu(e, [{ head: "Order " + pad2(+on.dataset.o) }].concat(orderItems(+on.dataset.o)));
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
        hideMenu();
    }

    function renderHint() {
        const inst = curInst();
        const kind = trackKind(state.track);
        let t;
        if (kind === "noise") t = "Noise track: click a lane to place that drum.";
        else if (inst && inst.type === kind) t = "Drawing with " + KIND_LABEL[kind] + " " + pad2(instNum(inst)) + " · " + inst.name;
        else t = "Pick a " + KIND_LABEL[kind] + " instrument to draw on " + TRACKS[state.track].name + ".";
        $("drawHint").textContent = t;
    }

    function updateLcd() {
        const o = state.playing ? state.playOrd : state.ord;
        const r = state.playing ? Math.floor(state.playRow) : state.startRow;
        $("lcd").textContent = (state.playing ? "▶ " : "") + "ORD " + pad2(o) + "  ROW " + pad2(r);
    }

    function renderAll() {
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

    function addInstrument(type, preset) {
        const list = instsOf(type);
        if (list.length >= MAX_INST) {
            toast("hUGETracker allows 15 " + KIND_LABEL[type] + " instruments per song.");
            return null;
        }
        checkpoint();
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
        if (uses && !confirm("Delete \"" + inst.name + "\"? It's used by " + uses + " note" + (uses === 1 ? "" : "s") + ", which will be removed too.")) return;
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
        inst[k] = parseInt(e.target.value, 10);
        const out = $("instEditor").querySelector("[data-out=\"" + k + "\"]");
        if (out) out.textContent = FMT[k](inst[k]);
        drawEditorCanvases(inst);
        refreshIcon(inst);
        if (G.drum) drawGrid();
    }

    function onEditorChange(e) {
        const k = e.target.dataset.k;
        if (k === "sweepTime" || k === "name") renderEditor();
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
            if (e.target.id !== "waveCanvas") return;
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

    function openPresets(tab) {
        presetTab = tab || trackKind(state.track);
        renderPresets();
        $("presetModal").classList.add("open");
        $("presetClose").focus();
    }

    function closePresets() {
        $("presetModal").classList.remove("open");
    }

    function renderPresets() {
        $("presetTabs").innerHTML = KINDS.map(k => "<button type=\"button\" class=\"btn small\" data-tab=\"" + k + "\" aria-pressed=\"" + (k === presetTab) + "\"><span class=\"kind-dot\" style=\"background:var(" + KIND_COLOR[k] + ")\"></span>" + KIND_LABEL[k] + " <span style=\"opacity:.7\">" + instsOf(k).length + "/15</span></button>").join("") +
            "<span class=\"hint\" style=\"margin-left:auto\">Listen first, then add the ones you like to your song.</span>";
        const grid = $("presetGrid");
        const full = instsOf(presetTab).length >= MAX_INST;
        grid.innerHTML = Presets.LIBRARY[presetTab].map((p, i) => "<div class=\"preset\" data-i=\"" + i + "\"><canvas></canvas><b>" + esc(p.name) + "</b><small>" + esc(p.desc) + "</small>" +
            "<div class=\"preset-actions\"><button type=\"button\" class=\"btn small\" data-listen=\"" + i + "\">▶ Listen</button><button type=\"button\" class=\"btn small\" data-add=\"" + i + "\"" + (full ? " disabled" : "") + ">+ Add</button></div></div>").join("");
        grid.querySelectorAll(".preset").forEach(b => drawIcon(b.querySelector("canvas"), Presets.make(presetTab, Presets.LIBRARY[presetTab][+b.dataset.i]), 44, 24));
    }

    function onPresetClick(e) {
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

    function orderOp(op) {
        const o = state.ord;
        const order = state.song.order;
        checkpoint();
        if (op === "add") {
            order.splice(o + 1, 0, [-1, -1, -1, -1]);
            state.ord = o + 1;
        } else if (op === "append") {
            order.push([-1, -1, -1, -1]);
            state.ord = order.length - 1;
        } else if (op === "dup") {
            order.splice(o + 1, 0, order[o].slice());
            state.ord = o + 1;
        } else if (op === "left" && o > 0) {
            [order[o - 1], order[o]] = [order[o], order[o - 1]];
            state.ord = o - 1;
        } else if (op === "right" && o < order.length - 1) {
            [order[o + 1], order[o]] = [order[o], order[o + 1]];
            state.ord = o + 1;
        } else if (op === "del") {
            if (order.length > 1) {
                order.splice(o, 1);
                state.ord = Math.min(o, order.length - 1);
            } else {
                order[0] = [-1, -1, -1, -1];
            }
        }
        state.sel = [];
        if (state.playing) state.playOrd = state.ord;
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
        GBAudio.send({ type: "play", order: state.ord, row: state.startRow });
        requestAnimationFrame(frame);
    }

    function stop() {
        state.playing = false;
        GBAudio.send({ type: "stop" });
        renderTop();
        positionPlayline();
        drawRuler();
        drawGrid();
        updateLcd();
    }

    function onAudio(m) {
        if (m.type !== "pos" || !state.playing) return;
        state.playOrd = m.order;
        state.playRow = m.row + m.tick / Math.max(1, m.speed);
    }

    function frame() {
        if (!state.playing) return;
        if (state.playOrd !== state.ord && state.playOrd < state.song.order.length) {
            state.ord = state.playOrd;
            state.sel = [];
            renderArrange();
            renderPatBar();
            renderRoll();
            renderInspector();
            revealSlot();
        } else {
            drawGrid();
            drawRuler();
        }
        positionPlayline();
        updateLcd();
        requestAnimationFrame(frame);
    }

    function slug(s) {
        return (s || "song").trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "song";
    }

    function download(name, data, type) {
        const blob = new Blob([data], { type });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 1000);
    }

    function saveJson() {
        download(slug(state.song.name) + ".fuge.json", JSON.stringify(state.song, null, 2), "application/json");
        state.dirty = false;
        status("Saved " + slug(state.song.name) + ".fuge.json");
    }

    function exportUge() {
        try {
            const res = UGE.exportSong(state.song);
            download(slug(state.song.name) + ".uge", res.bytes, "application/octet-stream");
            status("Exported " + slug(state.song.name) + ".uge (" + Math.round(res.bytes.length / 1024) + " KB). Open it in hUGETracker or drop it in GB Studio's assets/music folder.");
            if (res.warnings.length) toast(res.warnings.join(" "));
        } catch (err) {
            toast("Export failed: " + err.message);
        }
    }

    function openFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const song = normalize(JSON.parse(reader.result));
                loadSong(song);
                status("Opened " + file.name);
            } catch (err) {
                toast(err.message.startsWith("This file") ? err.message : "Couldn't read that file. Open a .fuge.json project saved from fUGE.");
            }
        };
        reader.readAsText(file);
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
        syncInstToTrack();
        scheduleAutosave();
        renderAll();
        centerRoll(true);
    }

    function newSong() {
        if (state.dirty && !confirm("Start a new song? Changes since your last save will be lost.")) return;
        loadSong(blankSong());
        status("New song. Draw on any track to begin.");
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

    function typing(e) {
        const t = e.target;
        return t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
    }

    function onKey(e) {
        if (document.querySelector(".ctx")) {
            if (e.key === "Escape") hideMenu();
            return;
        }
        const mod = e.ctrlKey || e.metaKey;
        const k = e.key.toLowerCase();
        if (mod && k === "s") {
            e.preventDefault();
            saveJson();
            return;
        }
        if (mod && k === "e") {
            e.preventDefault();
            exportUge();
            return;
        }
        if (mod && k === "o") {
            e.preventDefault();
            $("fileInput").click();
            return;
        }
        if ($("presetModal").classList.contains("open")) {
            if (e.key === "Escape") closePresets();
            return;
        }
        if (typing(e)) return;
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
            play();
            return;
        }
        const has = liveSel().length > 0;
        if (k === "d") setTool("draw");
        else if (k === "s") setTool("select");
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
        $("btnNew").onclick = newSong;
        $("btnOpen").onclick = () => $("fileInput").click();
        $("fileInput").onchange = e => {
            const f = e.target.files[0];
            if (f) openFile(f);
            e.target.value = "";
        };
        $("btnSave").onclick = saveJson;
        $("btnExport").onclick = exportUge;
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
            GBAudio.send({ type: "loop", on: state.loop });
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
        $("speed").onchange = e => {
            checkpoint();
            state.song.speed = parseInt(e.target.value, 10);
            renderTop();
            renderArrange();
        };
        $("rpb").onchange = e => {
            checkpoint();
            state.song.rowsPerBeat = parseInt(e.target.value, 10);
            renderTop();
            renderRoll();
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
            if (!e.target.closest(".ctx")) hideMenu();
        }, true);
        window.addEventListener("blur", hideMenu);
        window.addEventListener("resize", hideMenu);
        document.addEventListener("scroll", hideMenu, true);
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
                GBAudio.send({ type: "play", order: state.ord, row });
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
        syncInstToTrack();
        bind();
        readPalette();
        renderAll();
        centerRoll(true);
        status(song ? "Restored your last session." : "Welcome! This demo song shows each channel. Click a slot in the arrangement to edit it.");
        if (document.fonts) document.fonts.ready.then(() => renderAll());
    }

    init();
})();
