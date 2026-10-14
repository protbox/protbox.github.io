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

    const TABLE_ROWS = 32;

    function compileSub(sub) {
        if (!sub || !sub.rows || !sub.rows.length) return null;
        const loop = sub.loop >= 0 && sub.loop < sub.rows.length ? Math.min(sub.loop, TABLE_ROWS - 2) : -1;
        const len = Math.max(1, Math.min(loop >= 0 ? TABLE_ROWS : TABLE_ROWS - 2, sub.rows.length));
        const cells = [];
        for (let r = 0; r < TABLE_ROWS; r++) cells.push({ note: NO_NOTE, jump: 0, fx: 0, fp: 0 });
        let active = false;
        for (let r = 0; r < len; r++) {
            const row = sub.rows[r] || {};
            const c = cells[r];
            if (typeof row.note === "number") {
                c.note = Math.max(0, Math.min(71, 36 + row.note));
                active = true;
            }
            if (row.fx) {
                c.fx = row.fx.code & 15;
                c.fp = row.fx.param & 255;
                if (c.fx || c.fp) active = true;
            }
        }
        if (!active) return null;
        if (loop >= 0) cells[len - 1].jump = Math.min(loop, len - 1) + 1;
        else cells[len].jump = len + 1;
        return cells;
    }

    const PERIODS = [44, 156, 262, 363, 457, 547, 631, 710, 786, 854, 923, 986, 1046, 1102, 1155, 1205, 1253, 1297, 1339, 1379, 1417, 1452, 1486, 1517, 1546, 1575, 1602, 1627, 1650, 1673, 1694, 1714, 1732, 1750, 1767, 1783, 1798, 1812, 1825, 1837, 1849, 1860, 1871, 1881, 1890, 1899, 1907, 1915, 1923, 1930, 1936, 1943, 1949, 1954, 1959, 1964, 1969, 1974, 1978, 1982, 1985, 1988, 1992, 1995, 1998, 2001, 2004, 2006, 2009, 2011, 2013, 2015];
    const periodOf = n => PERIODS[Math.max(0, Math.min(71, n))];

    function slidePlan(n, kind, speed, len, taken, steady) {
        if (kind === "noise" || !n.slide || speed < 2) return null;
        const L = Math.min(n.len, len - n.row);
        const target = Math.max(0, Math.min(71, n.note + n.slide));
        if (target === n.note || L < 1) return null;
        const start = n.row + Math.max(0, Math.min(L - 1, n.slideAt || 0));
        const stop = n.slideLen > 0 ? Math.min(n.row + L, start + n.slideLen) : n.row + L;
        const dist = Math.abs(periodOf(target) - periodOf(n.note));
        const fx = target > n.note ? 0x1 : 0x2;
        if (steady) {
            const free = [];
            for (let r = start; r < stop; r++) if (!taken.has(r)) free.push(r);
            if (!free.length) return null;
            const units = Math.round(dist / (speed - 1));
            const base = Math.floor(units / free.length);
            const extra = units - base * free.length;
            return free.map((r, k) => ({ row: r, fx, fp: Math.min(255, base + (k < extra ? 1 : 0)) })).filter(s => s.fp > 0);
        }
        const first = !taken.has(start);
        const glide = [];
        for (let r = start + 1; r < stop; r++) if (!taken.has(r)) glide.push(r);
        if (!glide.length) {
            if (!first) return null;
            return [{ row: start, fx, fp: Math.max(1, Math.min(255, Math.round(dist / (speed - 1)))) }];
        }
        const steps = ((first ? 1 : 0) + glide.length) * (speed - 1);
        const xy = Math.max(1, Math.min(255, Math.ceil(dist / steps)));
        const out = [];
        if (first) out.push({ row: start, fx, fp: xy });
        glide.forEach((r, k) => out.push({ row: r, fx: 0x3, fp: xy, note: k === 0 ? target : undefined }));
        return out;
    }

    const ENV_TICKS = 59.7275 / 64;
    const WAVE_STEPS = [[0, 0], [3.75, 3], [7.5, 7], [15, 15]];

    function swellPlan(n, kind, inst, speed, len) {
        const L = Math.min(n.len, len - n.row);
        if (!inst || kind === "noise") return null;
        const out = [];
        if (kind === "wave") {
            if (L < 2 || !inst.level) return null;
            const top = [0, 15, 7.5, 3.75][inst.level];
            let last = -1;
            for (let r = 0; r < L; r++) {
                const tri = 1 - Math.abs(2 * (r + 0.5) / L - 1);
                const want = tri * top;
                const step = WAVE_STEPS.filter(s => s[0] <= top).reduce((a, s) => Math.abs(s[0] - want) < Math.abs(a[0] - want) ? s : a);
                if (step[1] !== last) out.push({ row: n.row + r, fx: 0xC, fp: step[1] });
                last = step[1];
            }
            return out;
        }
        if (L < 3 || inst.envPace) return null;
        const peakWant = inst.vol || 15;
        const mid = Math.max(1, Math.min(L - 2, Math.round((L - 1) / 2)));
        const up = Math.max(1, Math.min(7, Math.round(mid * speed / (peakWant * ENV_TICKS))));
        const slow = peakWant * up * ENV_TICKS;
        const ra = slow < mid * speed ? Math.max(1, Math.min(mid, Math.round(slow / speed))) : mid;
        const peak = Math.max(1, Math.min(15, Math.round(ra * speed / (up * ENV_TICKS))));
        const fallAvail = (L - ra - 1) * speed;
        const down = Math.max(1, Math.min(7, Math.round(fallAvail / (peak * ENV_TICKS))));
        const rc = Math.max(ra + 1, L - Math.ceil(peak * down * ENV_TICKS / speed));
        out.push({ row: n.row, fx: 0xC, fp: (8 | up) << 4 });
        out.push({ row: n.row + ra, fx: 0xA, fp: peak << 4 });
        out.push({ row: n.row + rc, fx: 0xC, fp: (down << 4) | peak });
        return out;
    }

    function buildCells(pattern, kind, instIndex, rows, sfx, speed, insts) {
        const fxOf = n => n.fx || null;
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
                const stop = n.slide ? n.row + Math.max(0, Math.min(n.len - 1, n.slideAt || 0)) : n.row + n.len;
                for (let r = n.row + 1; r < Math.min(len, stop); r++) {
                    if (starts.has(r)) break;
                    if (cells[r].fx === 0 && cells[r].fp === 0) {
                        cells[r].fx = fx.code;
                        cells[r].fp = fx.param & 0xff;
                    }
                }
            }
            for (const n of notes) {
                const taken = new Set();
                const plan = n.swell && insts ? swellPlan(n, kind, insts.get(n.inst), speed || 6, len) : null;
                if (plan) for (const s of plan) {
                    cells[s.row].fx = s.fx;
                    cells[s.row].fp = s.fp;
                    taken.add(s.row);
                }
                const slide = n.slide ? slidePlan(n, kind, speed || 6, len, taken, kind === "pulse" && !!plan) : null;
                if (slide) for (const s of slide) {
                    const c = cells[s.row];
                    c.fx = s.fx;
                    c.fp = s.fp;
                    if (s.note !== undefined) {
                        c.note = s.note;
                        c.inst = 0;
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
        const subpattern = s => {
            const t = s && s.table;
            u8(t ? 1 : 0);
            for (let n = 0; n < 64; n++) {
                const c = t && n < t.length ? t[n] : null;
                u32(c ? c.note : NO_NOTE);
                u32(0);
                u32(c ? c.jump : 0);
                u32(c ? c.fx : 0);
                u8(c ? c.fp : 0);
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
            subpattern(s);
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
            subpattern(s);
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
            subpattern(s);
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
        const instById = new Map(doc.instruments.map(i => [i.id, i]));
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
            return Object.assign({}, inst, { waveIndex: waveKeys.get(key), table: compileSub(inst.sub) });
        });
        const withTable = inst => Object.assign({}, inst, { table: compileSub(inst.sub) });

        const patterns = [];
        const orders = [[], [], [], []];
        const cache = new Map();
        const lens = orderRows.map((r, k) => {
            if (sfx) return rows;
            const v = doc.orderRows && doc.orderRows[k];
            return v > 0 && v < ROWS ? Math.floor(v) : ROWS;
        });
        const built = new Map();
        const cellsFor = (c, idx, len) => {
            const key = c + ":" + idx + ":" + len;
            if (!built.has(key)) built.set(key, buildCells(idx >= 0 ? doc.tracks[c].patterns[idx] : null, KINDS[c], instIndex, len, !!sfx, sfx ? sfx.speed : doc.speed, instById));
            return built.get(key);
        };
        const intern = (key, cells) => {
            if (!cache.has(key)) {
                cache.set(key, patterns.length);
                patterns.push({ id: patterns.length, cells });
            }
            return cache.get(key);
        };
        let crowded = 0;
        orderRows.forEach((row, k) => {
            const len = lens[k];
            const cells = [0, 1, 2, 3].map(c => cellsFor(c, row[c], len));
            let holder = -1;
            if (len < ROWS) {
                holder = [3, 2, 1, 0].find(c => !cells[c][len - 1].fx && !cells[c][len - 1].fp);
                if (holder === undefined) {
                    holder = 3;
                    crowded++;
                }
            }
            for (let c = 0; c < 4; c++) {
                if (c !== holder) {
                    orders[c].push(intern(c + ":" + row[c] + ":" + len, cells[c]));
                    continue;
                }
                const copy = cells[c].map(x => Object.assign({}, x));
                copy[len - 1].fx = 0xD;
                copy[len - 1].fp = 1;
                orders[c].push(intern(c + ":" + row[c] + ":" + len + ":D", copy));
            }
        });
        if (crowded) warnings.push(crowded + " order" + (crowded === 1 ? "" : "s") + " had an effect on every channel's last row, so the noise channel's effect there was replaced by the pattern break that ends the order early.");

        const song = {
            name: (doc.name || "Untitled").slice(0, 255),
            artist: (doc.artist || "").slice(0, 255),
            comment: (doc.comment || "").slice(0, 255),
            speed: sfx ? sfx.speed : doc.speed,
            rows,
            used: [0, 1, 2, 3].map(c => orderRows.some((r, k) => r[c] >= 0 && doc.tracks[c].patterns[r[c]] && doc.tracks[c].patterns[r[c]].notes.some(n => n.row < lens[k]))),
            duty: byType.pulse.map(withTable),
            wave: waveSpecs,
            noise: byType.noise.map(withTable),
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

    root.UGE = { compile, compileSub, exportSong, swellPlan, slidePlan, NO_NOTE, TABLE_ROWS };
})(typeof window !== "undefined" ? window : globalThis);
