(function (root) {
    "use strict";

    const NO_NOTE = 90;
    const ROWS = 64;
    const KINDS = ["pulse", "pulse", "wave", "noise"];
    const SUSTAIN = new Set([0x0, 0x1, 0x2, 0x3, 0x4]);

    function emptyCells() {
        const cells = [];
        for (let r = 0; r < ROWS; r++) cells.push({ note: NO_NOTE, inst: 0, fx: 0, fp: 0 });
        return cells;
    }

    function buildCells(pattern, kind, instIndex, rows, sfx, instFx) {
        const fxOf = n => n.fx === false ? null : n.fx || (instFx && instFx.get(n.inst)) || null;
        const len = rows || ROWS;
        const cells = emptyCells();
        if (!pattern) {
            if (!sfx) {
                cells[0].fx = 0xE;
                cells[0].fp = 0;
            }
            return cells;
        }
        const notes = pattern.notes.filter(n => n.row < len).sort((a, b) => a.row - b.row);
        const starts = new Set(notes.map(n => n.row));
        for (const n of notes) {
            if (n.row < 0 || n.row >= ROWS) continue;
            const c = cells[n.row];
            c.note = n.note;
            c.inst = instIndex.get(n.inst) || 0;
            const fx = fxOf(n);
            if (fx) {
                c.fx = fx.code;
                c.fp = fx.param & 0xff;
            }
        }
        if (kind !== "noise") {
            for (const n of notes) {
                const fx = fxOf(n);
                if (!fx || !SUSTAIN.has(fx.code)) continue;
                for (let r = n.row + 1; r < Math.min(len, n.row + n.len); r++) {
                    if (starts.has(r)) break;
                    if (cells[r].fx === 0 && cells[r].fp === 0) {
                        cells[r].fx = fx.code;
                        cells[r].fp = fx.param & 0xff;
                    }
                }
            }
            for (const n of notes) {
                const end = n.row + n.len;
                if (end >= len || starts.has(end)) continue;
                const c = cells[end];
                if (c.fx === 0 && c.fp === 0 && c.note === NO_NOTE) {
                    c.fx = 0xE;
                    c.fp = 0;
                }
            }
        }
        return cells;
    }

    function lengthValue(inst, max) {
        return inst && inst.length ? Math.max(0, max - inst.length) : 0;
    }

    function writeBytes(song) {
        const buf = new ArrayBuffer(4 * 1024 * 1024);
        const view = new DataView(buf);
        let i = 0;
        const u8 = v => {
            view.setUint8(i, v & 0xff);
            i += 1;
        };
        const u32 = v => {
            view.setUint32(i, v >>> 0, true);
            i += 4;
        };
        const sstr = s => {
            const enc = Array.from(s || "").map(c => {
                const k = c.charCodeAt(0);
                return k < 128 ? k : 63;
            }).slice(0, 255);
            u8(enc.length);
            for (let k = 0; k < 255; k++) u8(k < enc.length ? enc[k] : 0);
        };
        const subpattern = () => {
            u8(0);
            for (let n = 0; n < 64; n++) {
                u32(NO_NOTE);
                u32(0);
                u32(0);
                u32(0);
                u8(0);
            }
        };
        const env = s => {
            u8(s ? s.vol : 15);
            u32(s && s.envDir === "down" ? 1 : 0);
            u8(s ? s.envPace : 0);
        };
        const duty = s => {
            u32(0);
            sstr(s ? s.name.slice(0, 32) : "");
            u32(lengthValue(s, 64));
            u8(s && s.length ? 1 : 0);
            env(s);
            u32(s ? s.sweepTime : 0);
            u32(s && s.sweepDir === "down" ? 1 : 0);
            u32(s ? s.sweepShift : 0);
            u8(s ? s.duty : 2);
            u32(0);
            u32(0);
            u32(0);
            subpattern();
        };
        const wave = s => {
            u32(1);
            sstr(s ? s.name.slice(0, 32) : "");
            u32(lengthValue(s, 256));
            u8(s && s.length ? 1 : 0);
            u8(0);
            u32(0);
            u8(0);
            u32(0);
            u32(0);
            u32(0);
            u8(0);
            u32(s ? s.level : 1);
            u32(s ? s.waveIndex : 0);
            u32(0);
            subpattern();
        };
        const noise = s => {
            u32(2);
            sstr(s ? s.name.slice(0, 32) : "");
            u32(lengthValue(s, 64));
            u8(s && s.length ? 1 : 0);
            env(s);
            u32(0);
            u32(0);
            u32(0);
            u8(0);
            u32(0);
            u32(0);
            u32(s && s.bits === 7 ? 1 : 0);
            subpattern();
        };

        u32(6);
        sstr(song.name);
        sstr(song.artist);
        sstr(song.comment);
        for (let n = 0; n < 15; n++) duty(song.duty[n]);
        for (let n = 0; n < 15; n++) wave(song.wave[n]);
        for (let n = 0; n < 15; n++) noise(song.noise[n]);
        for (let n = 0; n < 16; n++) {
            for (let m = 0; m < 32; m++) u8(song.waves[n] ? song.waves[n][m] : (m < 16 ? m : 31 - m));
        }
        u32(song.speed);
        u8(0);
        u32(0);
        u32(song.patterns.length);
        for (const p of song.patterns) {
            u32(p.id);
            for (const c of p.cells) {
                u32(c.note);
                u32(c.inst);
                u32(0);
                u32(c.fx);
                u8(c.fp);
            }
        }
        for (let c = 0; c < 4; c++) {
            u32(song.orders[c].length + 1);
            for (const id of song.orders[c]) u32(id);
            u32(0);
        }
        for (let n = 0; n < 16; n++) u32(0);
        return new Uint8Array(buf.slice(0, i));
    }

    function compile(doc, opts) {
        const warnings = [];
        const sfxIndex = opts && opts.sfx !== undefined && doc.mode === "sfx" && doc.sfx ? opts.sfx : -1;
        const sfx = sfxIndex >= 0 ? doc.sfx[sfxIndex] : null;
        const rows = sfx ? sfx.rows : ROWS;
        const orderRows = sfx ? [doc.order[sfxIndex]] : doc.order;
        const byType = { pulse: [], wave: [], noise: [] };
        for (const inst of doc.instruments) byType[inst.type].push(inst);
        for (const t of Object.keys(byType)) {
            if (byType[t].length > 15) {
                warnings.push("Only the first 15 " + t + " instruments are exported.");
                byType[t] = byType[t].slice(0, 15);
            }
        }
        const instIndex = new Map();
        for (const t of Object.keys(byType)) byType[t].forEach((inst, k) => instIndex.set(inst.id, k + 1));

        const waves = [];
        const waveKeys = new Map();
        const waveSpecs = byType.wave.map(inst => {
            const key = inst.wave.join(",");
            if (!waveKeys.has(key)) {
                waveKeys.set(key, waves.length);
                waves.push(inst.wave.slice());
            }
            return Object.assign({}, inst, { waveIndex: waveKeys.get(key) });
        });

        const instFx = new Map(doc.instruments.map(i => [i.id, i.fx || null]));
        const patterns = [];
        const orders = [[], [], [], []];
        const cache = new Map();
        for (let c = 0; c < 4; c++) {
            for (const row of orderRows) {
                const idx = row[c];
                const key = c + ":" + idx;
                if (!cache.has(key)) {
                    const pat = idx >= 0 ? doc.tracks[c].patterns[idx] : null;
                    cache.set(key, patterns.length);
                    patterns.push({ id: patterns.length, cells: buildCells(pat, KINDS[c], instIndex, rows, !!sfx, instFx) });
                }
                orders[c].push(cache.get(key));
            }
        }

        const song = {
            name: (doc.name || "Untitled").slice(0, 255),
            artist: (doc.artist || "").slice(0, 255),
            comment: (doc.comment || "").slice(0, 255),
            speed: sfx ? sfx.speed : doc.speed,
            rows,
            used: [0, 1, 2, 3].map(c => orderRows.some(r => r[c] >= 0 && doc.tracks[c].patterns[r[c]] && doc.tracks[c].patterns[r[c]].notes.some(n => n.row < rows))),
            duty: byType.pulse,
            wave: waveSpecs,
            noise: byType.noise,
            waves,
            patterns,
            orders
        };
        return { song, warnings };
    }

    function exportSong(doc) {
        const res = compile(doc);
        return { bytes: writeBytes(res.song), warnings: res.warnings };
    }

    root.UGE = { compile, exportSong, NO_NOTE };
})(typeof window !== "undefined" ? window : globalThis);
