(function (root) {
    "use strict";

    const ROWS = 64;
    const NOTE_MAX = 71;
    const BASE = 36;
    const VBLANK_HZ = 59.7275;
    const GRIDS = [4, 3, 6, 8, 2];
    const SLOTS = ["pulse1", "pulse2", "wave", "noise"];
    const KINDS = ["pulse", "pulse", "wave", "noise"];

    const DRUMS = [
        { name: "Kick", rank: 0, notes: [35, 36] },
        { name: "Snare", rank: 1, notes: [38, 40] },
        { name: "Clap", rank: 2, notes: [39] },
        { name: "Rimshot", rank: 3, notes: [37, 56, 76, 77] },
        { name: "Low Tom", rank: 4, notes: [41, 43, 45] },
        { name: "High Tom", rank: 4, notes: [47, 48, 50] },
        { name: "Crash", rank: 5, notes: [49, 52, 55, 57] },
        { name: "Open Hat", rank: 6, notes: [46] },
        { name: "Closed Hat", rank: 7, notes: [42, 44, 51, 53, 59] },
        { name: "Shaker", rank: 8, notes: [54, 58, 69, 70, 82] }
    ];

    function drumFor(pitch) {
        const hit = DRUMS.find(d => d.notes.includes(pitch));
        if (hit) return hit;
        if (pitch < 41) return DRUMS[0];
        if (pitch < 47) return DRUMS[1];
        if (pitch < 60) return DRUMS[8];
        return DRUMS[9];
    }

    function parse(input) {
        const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
        const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        const tag = at => String.fromCharCode(u8[at], u8[at + 1], u8[at + 2], u8[at + 3]);
        let p = -1;
        for (let i = 0; i + 14 <= u8.length && i < 4096; i++) {
            if (tag(i) === "MThd") {
                p = i;
                break;
            }
        }
        if (p < 0) throw new Error("This isn't a MIDI file.");
        const hlen = dv.getUint32(p + 4);
        const format = dv.getUint16(p + 8);
        const count = dv.getUint16(p + 10);
        const division = dv.getUint16(p + 12);
        if (division & 0x8000) throw new Error("This MIDI file uses SMPTE timing, which fUGE can't read. Re-export it with beat-based timing.");
        if (!division) throw new Error("This MIDI file has no timing information.");
        p += 8 + hlen;
        const tracks = [];
        while (tracks.length < count && p + 8 <= u8.length) {
            const id = tag(p);
            const len = dv.getUint32(p + 4);
            p += 8;
            const end = Math.min(u8.length, p + len);
            if (id === "MTrk") tracks.push(readTrack(u8, p, end));
            p = end;
        }
        if (!tracks.length) throw new Error("This MIDI file has no tracks.");
        return { format, division, tracks };
    }

    function readTrack(u8, start, end) {
        let p = start;
        let tick = 0;
        let status = 0;
        const out = { name: "", notes: [], tempos: [], keys: [], times: [], bends: [], ccs: [], end: 0 };
        const open = new Map();
        const range = new Array(16).fill(2);
        const rpn = Array.from({ length: 16 }, () => [127, 127]);
        const vlq = () => {
            let v = 0;
            for (let k = 0; k < 4 && p < end; k++) {
                const b = u8[p++];
                v = (v << 7) | (b & 0x7f);
                if (!(b & 0x80)) break;
            }
            return v;
        };
        const close = (ch, note, t) => {
            const key = ch * 128 + note;
            const q = open.get(key);
            if (!q || !q.length) return;
            const n = q.shift();
            n.off = Math.max(t, n.on);
        };
        while (p < end) {
            tick += vlq();
            if (p >= end) break;
            let b = u8[p];
            if (b & 0x80) {
                p++;
                if (b < 0xf0) status = b;
            } else if (status) {
                b = status;
            } else {
                p++;
                continue;
            }
            if (b === 0xff) {
                const type = u8[p++];
                const len = vlq();
                const d = u8.subarray(p, Math.min(end, p + len));
                p += len;
                if (type === 0x2f) break;
                if (type === 0x03 && !out.name) out.name = String.fromCharCode(...d).replace(/[^\x20-\x7e]/g, "").trim();
                if (type === 0x51 && d.length >= 3) out.tempos.push({ tick, mpqn: (d[0] << 16) | (d[1] << 8) | d[2] });
                if (type === 0x59 && d.length >= 2) out.keys.push({ tick, sf: d[0] > 127 ? d[0] - 256 : d[0], minor: d[1] === 1 });
                if (type === 0x58 && d.length >= 2) out.times.push({ tick, num: d[0], den: 1 << d[1] });
                continue;
            }
            if (b === 0xf0 || b === 0xf7) {
                p += vlq();
                continue;
            }
            const hi = b & 0xf0;
            const ch = b & 15;
            const size = hi === 0xc0 || hi === 0xd0 ? 1 : 2;
            const d1 = u8[p];
            const d2 = u8[p + 1];
            p += size;
            if (hi === 0x90 && d2 > 0) {
                const n = { ch, note: d1 & 127, vel: d2, on: tick, off: -1 };
                out.notes.push(n);
                const key = ch * 128 + n.note;
                if (!open.has(key)) open.set(key, []);
                open.get(key).push(n);
            } else if (hi === 0x80 || hi === 0x90) {
                close(ch, d1 & 127, tick);
            } else if (hi === 0xe0) {
                const v = (d1 & 127) | ((d2 & 127) << 7);
                out.bends.push({ tick, ch, semis: (v - 8192) / 8192 * range[ch] });
            } else if (hi === 0xb0) {
                if (d1 === 7 || d1 === 11) out.ccs.push({ tick, ch, cc: d1, v: d2 & 127 });
                if (d1 === 101) rpn[ch][0] = d2;
                else if (d1 === 100) rpn[ch][1] = d2;
                else if ((d1 === 6 || d1 === 38) && rpn[ch][0] === 0 && rpn[ch][1] === 0) {
                    if (d1 === 6) range[ch] = d2;
                    else range[ch] = Math.floor(range[ch]) + d2 / 100;
                }
            }
        }
        out.end = tick;
        for (const n of out.notes) if (n.off < 0) n.off = Math.max(n.on + 1, tick);
        return out;
    }

    function chooseGrid(notes, division) {
        if (!notes.length) return 4;
        const err = rpb => {
            const tpr = division / rpb;
            let e = 0;
            for (const n of notes) {
                const r = n.on / tpr;
                e += Math.abs(r - Math.round(r));
            }
            return e / notes.length / rpb;
        };
        const scores = GRIDS.map(rpb => ({ rpb, e: err(rpb) }));
        const good = scores.find(s => s.e <= 0.015);
        return good ? good.rpb : scores.reduce((a, s) => s.e < a.e - 0.005 ? s : a).rpb;
    }

    function groupsOf(mid) {
        if (mid.format === 0 || mid.tracks.length === 1) {
            const notes = mid.tracks.flatMap(t => t.notes);
            const chans = [...new Set(notes.map(n => n.ch))].sort((a, b) => a - b);
            const bends = mid.tracks.flatMap(t => t.bends);
            const ccs = mid.tracks.flatMap(t => t.ccs || []);
            return chans.map(ch => ({ name: "Channel " + (ch + 1), notes: notes.filter(n => n.ch === ch), bends, ccs, drums: ch === 9 }));
        }
        return mid.tracks.map((t, k) => ({ name: t.name || "Track " + (k + 1), notes: t.notes, bends: t.bends, ccs: t.ccs || [], drums: t.notes.every(n => n.ch === 9) })).filter(g => g.notes.length);
    }

    function fitOctave(pitches) {
        let best = { shift: 0, fit: -1 };
        for (let o = 0; o <= 4; o++) {
            for (const shift of o ? [o * 12, -o * 12] : [0]) {
                const fit = pitches.filter(p => p + shift >= 0 && p + shift <= NOTE_MAX).length;
                if (fit > best.fit) best = { shift, fit };
            }
        }
        return best.shift;
    }

    function bender(list) {
        const byCh = new Map();
        for (const b of list) {
            if (!byCh.has(b.ch)) byCh.set(b.ch, []);
            byCh.get(b.ch).push(b);
        }
        byCh.forEach(v => v.sort((a, b) => a.tick - b.tick));
        const last = (evs, t) => {
            let lo = 0;
            let hi = evs.length - 1;
            let at = -1;
            while (lo <= hi) {
                const m = (lo + hi) >> 1;
                if (evs[m].tick <= t) {
                    at = m;
                    lo = m + 1;
                } else hi = m - 1;
            }
            return at;
        };
        return n => {
            const evs = byCh.get(n.ch);
            if (!evs) return null;
            const i0 = last(evs, n.on);
            const b0 = i0 >= 0 ? evs[i0].semis : 0;
            const inside = [];
            for (let k = i0 + 1; k < evs.length && evs[k].tick < n.off; k++) inside.push(evs[k]);
            const bEnd = inside.length ? inside[inside.length - 1].semis : b0;
            const base = Math.round(b0);
            const slide = Math.round(bEnd) - base;
            const lo = Math.min(b0, bEnd) - 0.75;
            const hi = Math.max(b0, bEnd) + 0.75;
            const wobble = inside.some(b => b.semis < lo || b.semis > hi);
            if (!slide) return { base, slide: 0, simplified: wobble };
            const start = inside.find(b => Math.abs(b.semis - b0) >= 0.25);
            const tStart = start ? start.tick : n.on;
            const done = inside.find(b => b.tick >= tStart && Math.abs(b.semis - bEnd) < 0.25);
            return { base, slide, tStart, tEnd: done ? done.tick : n.off, simplified: wobble };
        };
    }

    function mixer(list) {
        const byKey = new Map();
        for (const c of list) {
            const k = c.ch * 128 + c.cc;
            if (!byKey.has(k)) byKey.set(k, []);
            byKey.get(k).push(c);
        }
        byKey.forEach(v => v.sort((a, b) => a.tick - b.tick));
        const at = (ch, cc, t, dflt) => {
            const evs = byKey.get(ch * 128 + cc);
            if (!evs) return dflt;
            let v = dflt;
            let lo = 0;
            let hi = evs.length - 1;
            while (lo <= hi) {
                const m = (lo + hi) >> 1;
                if (evs[m].tick <= t) {
                    v = evs[m].v;
                    lo = m + 1;
                } else hi = m - 1;
            }
            return v;
        };
        return (ch, t) => at(ch, 7, t, 100) / 127 * at(ch, 11, t, 127) / 127;
    }

    function fold(n) {
        while (n < 0) n += 12;
        while (n > NOTE_MAX) n -= 12;
        return n;
    }

    function toSong(mid, opts) {
        const o = opts || {};
        const make = (type, name) => {
            const preset = Presets.LIBRARY[type].find(p => p.name === name);
            const inst = Presets.make(type, preset);
            inst.id = "mid" + type[0] + name.replace(/\W/g, "").toLowerCase();
            return inst;
        };
        const groups = groupsOf(mid);
        const drumGroup = groups.find(g => g.drums);
        const melodic = groups.filter(g => g !== drumGroup);
        const used = drumGroup ? melodic.slice(0, 3).concat([null, null, null]).slice(0, 3).concat([drumGroup]) : groups.slice(0, 4);
        const ignored = groups.filter(g => !used.includes(g));
        const all = used.filter(Boolean).flatMap(g => g.notes);
        const conductor = mid.tracks.flatMap(t => t.tempos).sort((a, b) => a.tick - b.tick);
        const mpqn = conductor.length ? conductor[0].mpqn : 500000;
        const tempoChanges = new Set(conductor.map(t => t.mpqn)).size > 1;
        const bpm = 60000000 / mpqn;
        const rpb = chooseGrid(all, mid.division);
        const speed = Math.max(1, Math.min(255, Math.round(60 * VBLANK_HZ / (bpm * rpb))));
        const tpr = mid.division / rpb;
        const rowOf = t => Math.round(t / tpr);
        const report = { groups: groups.length, used: used.map(g => g ? g.name : null), ignored: ignored.map(g => g.name), chords: 0, drums: 0, shifted: [], folded: 0, rpb, speed, bpm, tempoChanges, quantised: 0, volumes: 0, slides: 0, bendsSimplified: 0, volSplit: 0, volSteps: 0, volKept: 0 };
        const level = (vel, top, base) => Math.max(1, Math.min(15, Math.round(base * vel / Math.max(1, top))));
        for (const n of all) if (Math.abs(n.on / tpr - Math.round(n.on / tpr)) > 0.2) report.quantised++;

        const instruments = [];
        const tracks = SLOTS.map(key => ({ key, patterns: [] }));
        const lines = [[], [], [], []];
        const pitchedInst = ["Square Lead", "Bright Lead", "Triangle Bass"];

        used.forEach((g, slot) => {
            if (!g) return;
            const kind = KINDS[slot];
            if (kind === "noise") {
                if (!g.drums) report.melodicNoise = g.name;
                const byRow = new Map();
                for (const n of g.notes) {
                    const d = drumFor(n.note);
                    const row = rowOf(n.on);
                    const cur = byRow.get(row);
                    if (!cur || d.rank < cur.d.rank) {
                        if (cur) report.drums++;
                        byRow.set(row, { d, vel: n.vel });
                    } else report.drums++;
                }
                const insts = new Map();
                const top = new Map();
                byRow.forEach(h => top.set(h.d.name, Math.max(top.get(h.d.name) || 0, h.vel)));
                for (const [row, h] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
                    if (!insts.has(h.d.name)) {
                        const inst = make("noise", h.d.name);
                        insts.set(h.d.name, inst);
                        instruments.push(inst);
                    }
                    const inst = insts.get(h.d.name);
                    const y = level(h.vel, top.get(h.d.name), inst.vol);
                    const fx = y !== inst.vol ? { code: 0xC, param: y } : null;
                    if (fx) report.volumes++;
                    lines[slot].push({ row, len: 1, note: inst.note, inst: inst.id, fx });
                }
                return;
            }
            if (g.drums) report.drumsOnPitched = (report.drumsOnPitched || []).concat(g.name);
            const inst = make(kind, pitchedInst[slot]);
            instruments.push(inst);
            const shift = fitOctave(g.notes.map(n => n.note - BASE));
            if (shift) report.shifted.push({ track: g.name, slot, octaves: shift / 12 });
            const keepHigh = kind === "pulse";
            const bend = bender(g.bends || []);
            const gain = mixer(g.ccs || []);
            const notes = g.notes.map(n => {
                const b = bend(n);
                return { row: rowOf(n.on), end: Math.max(rowOf(n.on) + 1, rowOf(n.off)), pitch: n.note - BASE + shift + (b ? b.base : 0), vel: n.vel, bend: b, ch: n.ch, on: n.on };
            })
                .sort((a, b) => a.row - b.row || (keepHigh ? b.pitch - a.pitch : a.pitch - b.pitch));
            const mono = [];
            for (const n of notes) {
                const prev = mono[mono.length - 1];
                if (prev && prev.row === n.row) {
                    report.chords++;
                    continue;
                }
                if (prev && prev.end > n.row) prev.end = n.row;
                mono.push(n);
            }
            for (const n of mono) n.loud = Array.from({ length: n.end - n.row }, (_, k) => n.vel * gain(n.ch, k ? (n.row + k) * tpr : n.on));
            const top = Math.max(...mono.flatMap(n => n.loud));
            const base = kind === "wave" ? 15 : inst.vol;
            for (const n of mono) {
                const pitch = fold(n.pitch);
                if (pitch !== n.pitch) report.folded++;
                const len = n.end - n.row;
                const ys = n.loud.map(v => level(v, top, base));
                const steps = [];
                ys.forEach((y, k) => {
                    if (!k || y !== ys[k - 1]) steps.push({ at: k, y });
                });
                if (steps.length > 1) {
                    if (kind === "pulse" && !(n.bend && n.bend.slide)) {
                        report.volSplit++;
                        report.volSteps += steps.length;
                        steps.forEach((s, k) => {
                            const end = k + 1 < steps.length ? steps[k + 1].at : len;
                            lines[slot].push({ row: n.row + s.at, len: end - s.at, note: pitch, inst: inst.id, fx: s.y !== base ? { code: 0xC, param: s.y } : null });
                            if (s.y !== base) report.volumes++;
                        });
                        continue;
                    }
                    report.volKept++;
                }
                const line = { row: n.row, len, note: pitch, inst: inst.id, fx: null };
                const y = ys[0];
                if (kind === "wave" ? y < 10 : y !== base) {
                    line.fx = { code: 0xC, param: y };
                    report.volumes++;
                }
                const b = n.bend;
                if (b && b.simplified) report.bendsSimplified++;
                if (b && b.slide) {
                    const target = Math.max(0, Math.min(NOTE_MAX, pitch + b.slide));
                    if (target !== pitch) {
                        line.slide = target - pitch;
                        let at = Math.max(0, Math.min(len - 1, rowOf(b.tStart) - n.row));
                        let stop = Math.max(at + 1, Math.min(len, rowOf(b.tEnd) - n.row));
                        if (line.fx && at === 0 && len > 1) {
                            at = 1;
                            stop = Math.max(stop, 2);
                        }
                        if (at) line.slideAt = at;
                        if (stop < len) line.slideLen = stop - at;
                        report.slides++;
                    }
                }
                lines[slot].push(line);
            }
        });

        const ts = mid.tracks.flatMap(t => t.times).sort((a, b) => a.tick - b.tick)[0];
        let beatsPerBar = 4;
        if (ts) {
            const b = ts.num * 4 / ts.den;
            if (Number.isInteger(b) && b >= 1 && b <= 16) beatsPerBar = b;
            else if (ts.den === 8 && ts.num % 3 === 0) beatsPerBar = ts.num / 3;
        }
        const bar = rpb * beatsPerBar;
        let span = bar > ROWS ? ROWS : bar;
        while (span * 2 <= ROWS) span *= 2;
        const last = Math.max(1, ...lines.flatMap(l => l.map(n => n.row + n.len)));
        const orders = Math.max(1, Math.ceil(last / span));
        const tail = last - (orders - 1) * span;
        const orderRows = Array.from({ length: orders }, (_, k) => k < orders - 1 ? span : Math.min(span, Math.max(bar, Math.ceil(tail / bar) * bar)));
        const order = Array.from({ length: orders }, () => [-1, -1, -1, -1]);
        lines.forEach((line, slot) => {
            const seen = new Map();
            for (let k = 0; k < orders; k++) {
                const from = k * span;
                const notes = line.filter(n => n.row >= from && n.row < from + span).map(n => {
                    const len = Math.max(1, Math.min(n.len, orderRows[k] - (n.row - from)));
                    const out = { row: n.row - from, len, note: n.note, inst: n.inst, fx: n.fx || null };
                    if (n.slide) {
                        out.slide = n.slide;
                        const at = Math.min(n.slideAt || 0, len - 1);
                        if (at) out.slideAt = at;
                        if (n.slideLen && at + n.slideLen < len) out.slideLen = n.slideLen;
                    }
                    return out;
                });
                if (!notes.length) continue;
                const key = JSON.stringify(notes);
                if (!seen.has(key)) {
                    seen.set(key, tracks[slot].patterns.length);
                    tracks[slot].patterns.push({ notes });
                }
                order[k][slot] = seen.get(key);
            }
        });

        let scale = { root: 0, name: "Free" };
        const key = mid.tracks.flatMap(t => t.keys).sort((a, b) => a.tick - b.tick)[0];
        if (key && key.sf >= -7 && key.sf <= 7) {
            const major = ((key.sf * 7) % 12 + 12) % 12;
            scale = key.minor ? { root: (major + 9) % 12, name: "Aeolian" } : { root: major, name: "Ionian" };
        }
        const title = (mid.format === 1 && mid.tracks[0] && !mid.tracks[0].notes.length && mid.tracks[0].name) || o.name || "Imported MIDI";
        const doc = {
            format: "fuge",
            version: 1,
            name: title.slice(0, 60),
            artist: "",
            comment: ("Imported from " + (o.file || "a MIDI file")).slice(0, 255),
            mode: "song",
            scale,
            speed: Math.min(255, speed),
            rowsPerBeat: rpb,
            beatsPerBar,
            instruments,
            tracks,
            order,
            orderRows
        };
        report.orders = orders;
        report.span = span;
        report.endRows = orderRows[orders - 1];
        report.notes = lines.reduce((a, l) => a + l.length, 0);
        return { doc, report };
    }

    root.MIDI = { parse, toSong, drumFor };
})(typeof window !== "undefined" ? window : globalThis);
