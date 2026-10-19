(function (root) {
    "use strict";

    const BASE = 36;
    const NOTE_MAX = 71;
    const MAX_CHORDS = 4;
    const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    const CHORDS = [
        { id: "maj", label: "", name: "major", variant: "maj", map: {}, tones: [0, 4, 7] },
        { id: "min", label: "m", name: "minor", variant: "min", map: {}, tones: [0, 3, 7] },
        { id: "7", label: "7", name: "dominant 7th", variant: "maj", map: { 11: 10 }, tones: [0, 4, 7, 10] },
        { id: "maj7", label: "maj7", name: "major 7th", variant: "maj", map: { 10: 11 }, tones: [0, 4, 7, 11] },
        { id: "m7", label: "m7", name: "minor 7th", variant: "min", map: { 11: 10 }, tones: [0, 3, 7, 10] },
        { id: "dim", label: "dim", name: "diminished", variant: "min", map: { 7: 6 }, tones: [0, 3, 6] },
        { id: "sus2", label: "sus2", name: "suspended 2nd", variant: "maj", map: { 3: 2, 4: 2 }, tones: [0, 2, 7] },
        { id: "sus4", label: "sus4", name: "suspended 4th", variant: "maj", map: { 3: 5, 4: 5 }, tones: [0, 5, 7] },
        { id: "aug", label: "aug", name: "augmented", variant: "maj", map: { 7: 8 }, tones: [0, 4, 8] }
    ];
    const DRUM_OVERRIDES = { 57: "Riser" };
    const GROUP_ORDER = ["rhythm", "bass", "drums"];

    const chordType = id => CHORDS.find(c => c.id === id) || CHORDS[0];
    const SHARP = { 1: "C#", 3: "D#", 6: "F#", 8: "G#", 10: "A#" };
    const FLAT = { 1: "Db", 3: "Eb", 6: "Gb", 8: "Ab", 10: "Bb" };

    function spell(pc, pcs) {
        if (!SHARP[pc] || !pcs) return ROOTS[pc];
        const has = new Set(pcs);
        if (has.has((pc + 11) % 12)) return FLAT[pc];
        if (has.has((pc + 1) % 12)) return SHARP[pc];
        return ROOTS[pc];
    }

    const chordName = (c, pcs) => spell(c.root, pcs) + chordType(c.type).label;

    function library() {
        const list = Array.isArray(root.FUGE_PATTERNS) ? root.FUGE_PATTERNS.filter(p => p && p.variants && Object.keys(p.variants).length) : [];
        return list.slice().sort((a, b) => {
            const ga = GROUP_ORDER.indexOf(a.group);
            const gb = GROUP_ORDER.indexOf(b.group);
            return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb) || a.group.localeCompare(b.group) || a.id.localeCompare(b.id, undefined, { numeric: true });
        });
    }

    const byId = id => library().find(p => p.id === id) || null;

    function variantFor(pattern, chord) {
        const v = pattern.variants;
        const want = chord ? chordType(chord.type).variant : "maj";
        return v[want] || v.any || v.maj || v.min || Object.values(v)[0];
    }

    function regions(chords, rows) {
        const list = chords.filter(c => c.row >= 0 && c.row < rows).sort((a, b) => a.row - b.row).slice(0, MAX_CHORDS);
        return list.map((c, k) => ({ chord: c, from: c.row, to: k + 1 < list.length ? list[k + 1].row : rows })).filter(r => r.to > r.from);
    }

    function tile(variant, rows, per) {
        const out = [];
        for (let k = 0; ; k++) {
            const off = k * variant.len;
            if (Math.round(off * per) >= rows) break;
            for (const n of variant.notes) {
                const r0 = Math.round((off + n.s) * per);
                if (r0 >= rows) continue;
                const r1 = Math.max(r0 + 1, Math.round((off + n.s + n.l) * per));
                out.push({ r0, r1, p: n.p, v: n.v });
            }
            if (k > 512) break;
        }
        return out;
    }

    function voice(p, chord) {
        const ct = chordType(chord.type);
        const pc = ((p % 12) + 12) % 12;
        const to = ct.map[pc];
        const q = to === undefined ? p : p - pc + to;
        const shift = chord.root > 6 ? chord.root - 12 : chord.root;
        return q + shift;
    }

    function fit(n) {
        while (n < 0) n += 12;
        while (n > NOTE_MAX) n -= 12;
        return n;
    }

    function generate(layer, opts) {
        const pattern = typeof layer.pattern === "string" ? byId(layer.pattern) : layer.pattern;
        if (!pattern) return [];
        const rows = opts.rows;
        const per = opts.barRows ? opts.barRows / pattern.bar : (opts.rpb || 4) / 4;
        if (pattern.drums) {
            const variant = variantFor(pattern, null);
            const top = new Map();
            for (const n of variant.notes) {
                const d = drumOf(n.p).name;
                top.set(d, Math.max(top.get(d) || 1, n.v));
            }
            const byRow = new Map();
            for (const t of tile(variant, rows, per)) {
                const d = drumOf(t.p);
                const cur = byRow.get(t.r0);
                if (!cur || d.rank < cur.rank) byRow.set(t.r0, { row: t.r0, len: 1, drum: d.name, rank: d.rank, gain: t.v / top.get(d.name) });
            }
            return [...byRow.values()].sort((a, b) => a.row - b.row).map(n => ({ row: n.row, len: 1, drum: n.drum, gain: n.gain }));
        }
        const out = [];
        for (const reg of regions(opts.chords || [], rows)) {
            const variant = variantFor(pattern, reg.chord);
            const top = Math.max(1, ...variant.notes.map(n => n.v));
            for (const t of tile(variant, rows, per)) {
                if (t.r1 <= reg.from || t.r0 >= reg.to) continue;
                const row = Math.max(t.r0, reg.from);
                const end = Math.min(t.r1, reg.to);
                const note = fit(voice(t.p, reg.chord) + 12 * (layer.octave || 0) - BASE);
                out.push({ row, len: end - row, note, gain: t.v / top });
            }
        }
        out.sort((a, b) => a.row - b.row || b.note - a.note);
        const mono = [];
        for (const n of out) {
            const prev = mono[mono.length - 1];
            if (prev && prev.row === n.row) continue;
            if (prev && prev.row + prev.len > n.row) prev.len = n.row - prev.row;
            mono.push(n);
        }
        return mono;
    }

    function drumOf(p) {
        if (DRUM_OVERRIDES[p]) return { name: DRUM_OVERRIDES[p], rank: 5 };
        return root.MIDI ? root.MIDI.drumFor(p) : { name: "Snare", rank: 1 };
    }

    function level(gain, base) {
        return Math.max(1, Math.min(15, Math.round(base * gain)));
    }

    function volumeFx(gain, kind, base) {
        const y = level(gain, kind === "wave" ? 15 : base);
        if (kind === "wave" ? y < 10 : y !== base) return { code: 0xC, param: y };
        return null;
    }

    function parseChord(text) {
        const m = String(text || "").trim().match(/^([A-Ga-g])([#b♯♭]?)(.*)$/);
        if (!m) return null;
        const names = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
        let r = names[m[1].toLowerCase()];
        if (m[2] === "#" || m[2] === "♯") r++;
        if (m[2] === "b" || m[2] === "♭") r--;
        const rest = m[3].trim().toLowerCase();
        const alias = { "": "maj", "maj": "maj", "M": "maj", "m": "min", "min": "min", "-": "min", "7": "7", "dom7": "7", "maj7": "maj7", "m7": "m7", "min7": "m7", "-7": "m7", "dim": "dim", "o": "dim", "°": "dim", "sus2": "sus2", "sus4": "sus4", "sus": "sus4", "aug": "aug", "+": "aug" };
        const type = alias[rest] || alias[m[3].trim()];
        if (!type) return null;
        return { root: (r + 12) % 12, type };
    }

    const PRIMARY = ["maj", "min", "dim", "aug", "sus4", "sus2"];
    const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
    const MAJOR = [0, 2, 4, 5, 7, 9, 11];

    function scaleNotes(key, steps) {
        const out = [0];
        for (let k = 0; k < steps.length - 1; k++) out.push(out[k] + steps[k]);
        return out.map(x => (key + x) % 12);
    }

    function fitsScale(chord, pcs) {
        const set = new Set(pcs);
        return chordType(chord.type).tones.every(t => set.has((chord.root + t) % 12));
    }

    function numeral(chord, degree) {
        if (degree < 0 || degree > 6) return "";
        const t = chord.type;
        const lower = t === "min" || t === "m7" || t === "dim";
        let n = NUMERALS[degree];
        if (lower) n = n.toLowerCase();
        if (t === "dim") n += "°";
        else if (t === "aug") n += "+";
        else if (t === "7" || t === "m7") n += "7";
        else if (t === "maj7") n += "maj7";
        else if (t === "sus2" || t === "sus4") n += t;
        return n;
    }

    function guide(key, steps) {
        const pcs = scaleNotes(key, steps);
        const seven = pcs.length === 7;
        return pcs.map((pc, i) => {
            const fits = CHORDS.filter(c => fitsScale({ root: pc, type: c.id }, pcs)).map(c => ({ root: pc, type: c.id }));
            const primary = PRIMARY.map(id => fits.find(f => f.type === id)).find(Boolean) || null;
            const extra = fits.filter(f => f !== primary);
            const deg = seven ? i : -1;
            const tag = c => seven ? numeral(c, i) : "";
            return { pc, degree: deg, primary: primary && Object.assign(primary, { numeral: tag(primary) }), extra: extra.map(c => Object.assign(c, { numeral: tag(c) })) };
        });
    }

    function parseRoman(text, key, steps) {
        const m = String(text || "").trim().match(/^([b#♭♯]?)(vii|vi|v|iv|iii|ii|i)(°|o|\+|maj7|m7|7|dim|aug|sus2|sus4|sus)?$/i);
        if (!m) return null;
        const word = m[2];
        const idx = ["i", "ii", "iii", "iv", "v", "vi", "vii"].indexOf(word.toLowerCase());
        const upper = word === word.toUpperCase();
        if (!upper && word !== word.toLowerCase()) return null;
        const pcs = scaleNotes(key, steps);
        let r = pcs.length === 7 ? pcs[idx] : (key + MAJOR[idx]) % 12;
        if (m[1] === "b" || m[1] === "♭") r = (r + 11) % 12;
        if (m[1] === "#" || m[1] === "♯") r = (r + 1) % 12;
        const suf = (m[3] || "").toLowerCase();
        let type = upper ? "maj" : "min";
        if (suf === "°" || suf === "o" || suf === "dim") type = "dim";
        else if (suf === "+" || suf === "aug") type = "aug";
        else if (suf === "7") type = upper ? "7" : "m7";
        else if (suf === "maj7") type = "maj7";
        else if (suf === "m7") type = "m7";
        else if (suf === "sus2") type = "sus2";
        else if (suf === "sus4" || suf === "sus") type = "sus4";
        return { root: r, type };
    }

    root.Builder = { ROOTS, CHORDS, MAX_CHORDS, library, byId, generate, regions, chordName, chordType, spell, parseChord, volumeFx, drumOf, scaleNotes, fitsScale, guide, parseRoman };
})(typeof window !== "undefined" ? window : globalThis);
