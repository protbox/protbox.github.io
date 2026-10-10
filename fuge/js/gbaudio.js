function GBAudioCore() {
    "use strict";

    const CPU_HZ = 4194304;
    const FRAME_CYCLES = 70224;
    const FS_CYCLES = 8192;
    const ROWS = 64;
    const LAST_NOTE = 72;
    const PERIODS = [44, 156, 262, 363, 457, 547, 631, 710, 786, 854, 923, 986, 1046, 1102, 1155, 1205, 1253, 1297, 1339, 1379, 1417, 1452, 1486, 1517, 1546, 1575, 1602, 1627, 1650, 1673, 1694, 1714, 1732, 1750, 1767, 1783, 1798, 1812, 1825, 1837, 1849, 1860, 1871, 1881, 1890, 1899, 1907, 1915, 1923, 1930, 1936, 1943, 1949, 1954, 1959, 1964, 1969, 1974, 1978, 1982, 1985, 1988, 1992, 1995, 1998, 2001, 2004, 2006, 2009, 2011, 2013, 2015];
    const DUTY = [[0, 0, 0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 1, 1, 1], [0, 1, 1, 1, 1, 1, 1, 0]];
    const NOISE_DIV = [8, 16, 32, 48, 64, 80, 96, 112];
    const WAVE_SHIFT = [4, 0, 1, 2];
    const ENV_REG = [0x12, 0x17, 0x1c, 0x21];
    const LO_REG = [0x13, 0x18, 0x1d];

    const periodOf = n => PERIODS[Math.max(0, Math.min(LAST_NOTE - 1, n))];

    function notePoly(note) {
        const a = ~((note + 192) & 0xff) & 0xff;
        if (a < 7) return a;
        const b = ((a >> 2) - 1) & 0x0f;
        const c = (a & 3) + 4;
        return (c | (b << 4)) & 0xff;
    }

    function envByte(s) {
        return ((s.vol & 15) << 4) | (s.envDir === "up" ? 8 : 0) | (s.envPace & 7);
    }

    class APU {
        constructor(rate) {
            this.rate = rate;
            this.cps = CPU_HZ / rate;
            this.charge = Math.pow(0.999958, this.cps);
            this.mask = [true, true, true, true];
            this.log = null;
            this.reset();
        }

        reset() {
            this.regs = new Uint8Array(0x40);
            this.waveRam = new Uint8Array(32);
            this.ch = [0, 1, 2, 3].map(() => ({ on: false, dac: false, timer: 1, pos: 0, freq: 0, vol: 0, envDir: 0, envPace: 0, envTimer: 0, len: 0, lenEn: false, duty: 0, shift: 0, lfsr: 0x7fff, width: 0, div: 0 }));
            this.ch[2].shift = 4;
            this.sw = { time: 0, dir: 0, shift: 0, timer: 0, shadow: 0, en: false };
            this.nr50 = 0x77;
            this.nr51 = 0xff;
            this.fs = 0;
            this.fsStep = 0;
            this.frac = 0;
            this.capL = 0;
            this.capR = 0;
        }

        write(a, v) {
            v &= 0xff;
            this.regs[a] = v;
            if (this.log) this.log.push(a, v);
            if (a >= 0x30) {
                this.waveRam[(a - 0x30) * 2] = v >> 4;
                this.waveRam[(a - 0x30) * 2 + 1] = v & 15;
                return;
            }
            const ch = this.ch;
            switch (a) {
                case 0x10:
                    this.sw.time = (v >> 4) & 7;
                    this.sw.dir = (v >> 3) & 1;
                    this.sw.shift = v & 7;
                    break;
                case 0x11:
                case 0x16: {
                    const c = ch[a === 0x11 ? 0 : 1];
                    c.duty = v >> 6;
                    c.len = 64 - (v & 63);
                    break;
                }
                case 0x12:
                case 0x17:
                case 0x21: {
                    const c = ch[a === 0x12 ? 0 : a === 0x17 ? 1 : 3];
                    c.dac = (v & 0xf8) !== 0;
                    if (!c.dac) c.on = false;
                    break;
                }
                case 0x13:
                case 0x18:
                case 0x1d: {
                    const c = ch[a === 0x13 ? 0 : a === 0x18 ? 1 : 2];
                    c.freq = (c.freq & 0x700) | v;
                    break;
                }
                case 0x14:
                case 0x19:
                case 0x1e: {
                    const k = a === 0x14 ? 0 : a === 0x19 ? 1 : 2;
                    const c = ch[k];
                    c.freq = (c.freq & 0xff) | ((v & 7) << 8);
                    c.lenEn = (v & 0x40) !== 0;
                    if (v & 0x80) this.trigger(k);
                    break;
                }
                case 0x1a:
                    ch[2].dac = (v & 0x80) !== 0;
                    if (!ch[2].dac) ch[2].on = false;
                    break;
                case 0x1b:
                    ch[2].len = 256 - v;
                    break;
                case 0x1c:
                    ch[2].shift = WAVE_SHIFT[(v >> 5) & 3];
                    break;
                case 0x20:
                    ch[3].len = 64 - (v & 63);
                    break;
                case 0x22:
                    ch[3].shift = v >> 4;
                    ch[3].width = (v >> 3) & 1;
                    ch[3].div = v & 7;
                    break;
                case 0x23:
                    ch[3].lenEn = (v & 0x40) !== 0;
                    if (v & 0x80) this.trigger(3);
                    break;
                case 0x24:
                    this.nr50 = v;
                    break;
                case 0x25:
                    this.nr51 = v;
                    break;
            }
        }

        noisePeriod() {
            const n = this.ch[3];
            return n.shift >= 14 ? 0 : NOISE_DIV[n.div] << n.shift;
        }

        sweepCalc() {
            const s = this.sw;
            const d = s.shadow >> s.shift;
            return s.dir ? s.shadow - d : s.shadow + d;
        }

        trigger(k) {
            const c = this.ch[k];
            c.on = c.dac;
            if (c.len === 0) c.len = k === 2 ? 256 : 64;
            if (k === 2) {
                c.timer = (2048 - c.freq) * 2;
                c.pos = 0;
                return;
            }
            const env = this.regs[ENV_REG[k]];
            c.vol = env >> 4;
            c.envDir = (env >> 3) & 1;
            c.envPace = env & 7;
            c.envTimer = c.envPace || 8;
            if (k === 3) {
                c.lfsr = 0x7fff;
                c.timer = this.noisePeriod() || 1;
                return;
            }
            c.timer = (2048 - c.freq) * 4;
            if (k === 0) {
                const s = this.sw;
                s.shadow = c.freq;
                s.timer = s.time || 8;
                s.en = s.time > 0 || s.shift > 0;
                if (s.shift && this.sweepCalc() > 2047) c.on = false;
            }
        }

        frameStep() {
            const st = this.fsStep;
            this.fsStep = (st + 1) & 7;
            if ((st & 1) === 0) {
                for (const c of this.ch) {
                    if (c.lenEn && c.len > 0) {
                        c.len--;
                        if (c.len === 0) c.on = false;
                    }
                }
            }
            if (st === 2 || st === 6) {
                const s = this.sw;
                if (s.timer > 0) s.timer--;
                if (s.timer === 0) {
                    s.timer = s.time || 8;
                    if (s.en && s.time) {
                        const nf = this.sweepCalc();
                        if (nf > 2047) this.ch[0].on = false;
                        else if (s.shift) {
                            s.shadow = nf;
                            this.ch[0].freq = nf;
                            if (this.sweepCalc() > 2047) this.ch[0].on = false;
                        }
                    }
                }
            }
            if (st === 7) {
                for (const k of [0, 1, 3]) {
                    const c = this.ch[k];
                    if (!c.envPace) continue;
                    c.envTimer--;
                    if (c.envTimer <= 0) {
                        c.envTimer = c.envPace;
                        if (c.envDir && c.vol < 15) c.vol++;
                        else if (!c.envDir && c.vol > 0) c.vol--;
                    }
                }
            }
        }

        runPulse(c, cycles) {
            if (!c.on) return 0;
            let acc = 0;
            let rem = cycles;
            const pattern = DUTY[c.duty];
            while (rem > 0) {
                const step = rem < c.timer ? rem : c.timer;
                if (pattern[c.pos]) acc += c.vol * step;
                c.timer -= step;
                rem -= step;
                if (c.timer <= 0) {
                    c.timer += (2048 - c.freq) * 4;
                    c.pos = (c.pos + 1) & 7;
                }
            }
            return acc;
        }

        runWave(c, cycles) {
            if (!c.on) return 0;
            let acc = 0;
            let rem = cycles;
            while (rem > 0) {
                const step = rem < c.timer ? rem : c.timer;
                acc += (this.waveRam[c.pos] >> c.shift) * step;
                c.timer -= step;
                rem -= step;
                if (c.timer <= 0) {
                    c.timer += (2048 - c.freq) * 2;
                    c.pos = (c.pos + 1) & 31;
                }
            }
            return acc;
        }

        runNoise(c, cycles) {
            if (!c.on) return 0;
            const period = this.noisePeriod();
            if (!period) return (~c.lfsr & 1) ? c.vol * cycles : 0;
            let acc = 0;
            let rem = cycles;
            while (rem > 0) {
                const step = rem < c.timer ? rem : c.timer;
                if (~c.lfsr & 1) acc += c.vol * step;
                c.timer -= step;
                rem -= step;
                if (c.timer <= 0) {
                    c.timer += period;
                    const x = (c.lfsr ^ (c.lfsr >> 1)) & 1;
                    c.lfsr = (c.lfsr >> 1) | (x << 14);
                    if (c.width) c.lfsr = (c.lfsr & ~0x40) | (x << 6);
                }
            }
            return acc;
        }

        sample(cycles, L, R, i, gain) {
            this.fs += cycles;
            while (this.fs >= FS_CYCLES) {
                this.fs -= FS_CYCLES;
                this.frameStep();
            }
            const ch = this.ch;
            const d = [
                this.runPulse(ch[0], cycles),
                this.runPulse(ch[1], cycles),
                this.runWave(ch[2], cycles),
                this.runNoise(ch[3], cycles)
            ];
            let l = 0;
            let r = 0;
            for (let k = 0; k < 4; k++) {
                if (!ch[k].dac || !this.mask[k]) continue;
                const a = 1 - d[k] / cycles / 7.5;
                if (this.nr51 & (16 << k)) l += a;
                if (this.nr51 & (1 << k)) r += a;
            }
            l *= (((this.nr50 >> 4) & 7) + 1) / 32;
            r *= ((this.nr50 & 7) + 1) / 32;
            const ol = l - this.capL;
            this.capL = l - ol * this.charge;
            const or = r - this.capR;
            this.capR = r - or * this.charge;
            L[i] = ol * gain;
            R[i] = or * gain;
        }
    }

    const BLANK = {
        pulse: { duty: 2, vol: 15, envDir: "down", envPace: 0, length: 0, sweepTime: 0, sweepDir: "down", sweepShift: 0 },
        wave: { level: 1, length: 0, waveIndex: 0 },
        noise: { vol: 15, envDir: "down", envPace: 0, length: 0, bits: 15 }
    };

    class Driver {
        constructor(apu) {
            this.apu = apu;
            this.song = null;
            this.playing = false;
            this.loop = false;
            this.resetState();
        }

        resetState() {
            this.order = 0;
            this.row = 0;
            this.tick = 0;
            this.counter = 0;
            this.rowBreak = 0;
            this.nextOrder = 0;
            this.speed = this.song ? this.song.speed : 6;
            this.curWave = -1;
            this.stepWidth = 0;
            this.ch = [0, 1, 2, 3].map(() => ({ period: 0, target: 0, note: 0, highmask: 0 }));
        }

        setSong(song) {
            this.song = song;
            this.speed = song.speed;
            this.curWave = -1;
            const count = song.orders[0].length;
            if (this.order >= count) {
                this.order = 0;
                this.row = 0;
            }
        }

        powerOn() {
            this.apu.reset();
            this.apu.write(0x24, 0x77);
            this.apu.write(0x25, 0xff);
        }

        start(order, row) {
            this.resetState();
            this.powerOn();
            const count = this.song.orders[0].length;
            this.order = Math.max(0, Math.min(count - 1, order | 0));
            this.row = Math.max(0, Math.min((this.song.rows || ROWS) - 1, row | 0));
            this.playing = true;
        }

        finish() {
            this.playing = false;
            if (!this.cutAtEnd) return;
            for (let c = 0; c < 4; c++) if (!this.song.used || this.song.used[c]) this.cut(c);
        }

        stop() {
            this.playing = false;
            this.powerOn();
            this.curWave = -1;
        }

        cell(c) {
            const pid = this.song.orders[c][this.order];
            return this.song.patterns[pid].cells[this.row];
        }

        instrument(c, idx) {
            const table = c < 2 ? this.song.duty : c === 2 ? this.song.wave : this.song.noise;
            return table[idx - 1] || BLANK[c < 2 ? "pulse" : c === 2 ? "wave" : "noise"];
        }

        loadWave(idx, data) {
            const a = this.apu;
            const w = data || (this.song && this.song.waves[idx]) || null;
            this.curWave = idx;
            a.write(0x1a, 0);
            for (let k = 0; k < 16; k++) {
                const hi = w ? w[k * 2] : k;
                const lo = w ? w[k * 2 + 1] : k;
                a.write(0x30 + k, ((hi & 15) << 4) | (lo & 15));
            }
            a.write(0x1a, 0x80);
        }

        loadInstrument(c, s) {
            const a = this.apu;
            const ch = this.ch[c];
            const len = s.length || 0;
            if (c < 2) {
                if (c === 0) a.write(0x10, ((s.sweepTime & 7) << 4) | (s.sweepDir === "down" ? 8 : 0) | (s.sweepShift & 7));
                a.write(c === 0 ? 0x11 : 0x16, ((s.duty & 3) << 6) | (len ? (64 - len) & 63 : 0));
                a.write(c === 0 ? 0x12 : 0x17, envByte(s));
                ch.highmask = 0x80 | (len ? 0x40 : 0);
            } else if (c === 2) {
                a.write(0x1b, len ? (256 - len) & 255 : 0);
                a.write(0x1c, (s.level & 3) << 5);
                if (s.waveIndex !== this.curWave || s.waveIndex < 0) this.loadWave(s.waveIndex, s.waveIndex < 0 ? s.wave : null);
                ch.highmask = 0x80 | (len ? 0x40 : 0);
            } else {
                a.write(0x21, envByte(s));
                const b = (s.bits === 7 ? 0x80 : 0) | (len ? 0x40 : 0) | (len ? (64 - len) & 63 : 0);
                a.write(0x20, b & 63);
                this.stepWidth = (b & 0x80) >> 4;
                ch.period = ch.period | this.stepWidth;
                ch.highmask = (b & 0x40) | 0x80;
            }
        }

        playNote(c) {
            const a = this.apu;
            const ch = this.ch[c];
            if (c < 2) {
                const lo = LO_REG[c];
                a.write(lo, ch.period & 255);
                a.write(lo + 1, (ch.highmask | (ch.period >> 8)) & 255);
            } else if (c === 2) {
                a.write(0x1a, 0);
                a.write(0x1a, 0xff);
                a.write(0x1d, ch.period & 255);
                a.write(0x1e, (ch.highmask | (ch.period >> 8)) & 255);
            } else {
                a.write(0x22, ch.period & 255);
                a.write(0x23, ch.highmask);
            }
        }

        updateFreq(c, value, h) {
            const a = this.apu;
            const hm = h || 0;
            if (c < 3) {
                const v = value & 0xffff;
                this.ch[c].period = v;
                a.write(LO_REG[c], v & 255);
                a.write(LO_REG[c] + 1, ((v >> 8) | hm) & 255);
            } else {
                a.write(0x22, notePoly(value) | this.stepWidth);
                a.write(0x23, hm);
            }
        }

        cut(c) {
            const reg = ENV_REG[c];
            this.apu.write(reg, 0);
            if (c !== 2) this.apu.write(reg + 2, 0xff);
        }

        effect(c, fx, p) {
            const t = this.tick;
            if (t === 0 && fx === 0 && p === 0) return true;
            const a = this.apu;
            const ch = this.ch[c];
            switch (fx) {
                case 0x0: {
                    const idx = ((this.counter - 1) & 255) % 3;
                    const off = idx === 0 ? p & 15 : idx === 1 ? p >> 4 : 0;
                    this.updateFreq(c, c < 3 ? periodOf(ch.note + off) : ch.note + off);
                    break;
                }
                case 0x1:
                    if (t && c < 3) this.updateFreq(c, ch.period + p);
                    break;
                case 0x2:
                    if (t && c < 3) this.updateFreq(c, ch.period - p);
                    break;
                case 0x3: {
                    if (c === 3) break;
                    if (t === 0) {
                        ch.target = periodOf(ch.note);
                        return false;
                    }
                    let cur = ch.period;
                    const tg = ch.target;
                    if (cur < tg) {
                        cur += p;
                        if (cur > tg) cur = tg;
                    } else if (cur > tg) {
                        cur -= p;
                        if (cur < tg) cur = tg;
                    }
                    const h = ch.highmask;
                    ch.highmask &= 0x7f;
                    this.updateFreq(c, cur, h);
                    break;
                }
                case 0x4: {
                    if (!t || c === 3) break;
                    const base = periodOf(ch.note);
                    this.updateFreq(c, (this.counter & (p >> 4)) === 0 ? base + (p & 15) : base);
                    break;
                }
                case 0x5:
                    if (!t) a.write(0x24, p);
                    break;
                case 0x7:
                    if (t === 0) return false;
                    if (t === p) this.playNote(c);
                    break;
                case 0x8:
                    if (!t) a.write(0x25, p);
                    break;
                case 0x9:
                    if (t) break;
                    if (c < 2) a.write(c === 0 ? 0x11 : 0x16, p);
                    else if (c === 3) a.write(0x22, (a.regs[0x22] & ~8) | p);
                    else {
                        this.loadWave(p & 15);
                        this.playNote(2);
                    }
                    break;
                case 0xa: {
                    if (t) break;
                    const reg = ENV_REG[c];
                    let v = (a.regs[reg] >> 4) - (p & 15);
                    if (v < 0) v = 0;
                    v += p >> 4;
                    if (v > 15) v = 15;
                    a.write(reg, v << 4);
                    a.write(reg + 2, a.regs[reg + 2] | 0x80);
                    this.playNote(c);
                    break;
                }
                case 0xb:
                    if (t) break;
                    if (!this.rowBreak) this.rowBreak = 1;
                    this.nextOrder = p;
                    break;
                case 0xc: {
                    if (t) break;
                    const cv = ((p & 15) << 4) | (p >> 4);
                    if (c < 2) {
                        const reg = ENV_REG[c];
                        a.write(reg, (a.regs[reg] & 15) | cv);
                        this.playNote(c);
                    } else if (c === 2) {
                        a.write(0x1c, cv >= 0xa0 ? 0x20 : cv >= 0x50 ? 0x40 : cv === 0 ? 0 : 0x60);
                    } else {
                        a.write(0x21, cv);
                        this.playNote(3);
                    }
                    break;
                }
                case 0xd:
                    if (!t) this.rowBreak = p;
                    break;
                case 0xe:
                    if (t === p) this.cut(c);
                    break;
                case 0xf:
                    if (!t) this.speed = p || 1;
                    break;
            }
            return true;
        }

        rowChannel(c) {
            const cell = this.cell(c);
            const ch = this.ch[c];
            const valid = cell.note < LAST_NOTE;
            if (valid) {
                ch.note = cell.note;
                if (c < 3) {
                    if (cell.fx !== 3) ch.period = periodOf(cell.note);
                } else {
                    ch.period = notePoly(cell.note);
                }
                if (cell.inst) this.loadInstrument(c, this.instrument(c, cell.inst));
                else ch.highmask &= 0x7f;
            }
            const play = this.effect(c, cell.fx, cell.fp);
            if (valid && play) this.playNote(c);
        }

        tickOnce() {
            if (!this.playing || !this.song) return;
            if (this.tick === 0) {
                for (let c = 0; c < 4; c++) this.rowChannel(c);
            } else {
                for (let c = 0; c < 4; c++) {
                    const cell = this.cell(c);
                    if (cell.fp) this.effect(c, cell.fx, cell.fp);
                }
            }
            this.counter = (this.counter + 1) & 255;
            this.tick++;
            if (this.tick < this.speed) return;
            this.tick = 0;
            const count = this.song.orders[0].length;
            const rows = this.song.rows || ROWS;
            let b = 0;
            if (this.rowBreak) {
                b = Math.min(rows - 1, this.rowBreak - 1);
                this.rowBreak = 0;
                if (this.nextOrder) {
                    this.order = Math.min(count - 1, this.nextOrder - 1);
                    this.nextOrder = 0;
                    this.row = b;
                    return;
                }
            } else {
                this.row++;
                if (this.row < rows) return;
            }
            if (this.loop) {
                this.row = 0;
                return;
            }
            if (this.once && this.order + 1 >= count) {
                this.finish();
                return;
            }
            this.order = (this.order + 1) % count;
            this.row = b;
        }

        preview(c, s, note) {
            const ch = this.ch[c];
            this.apu.write(0x24, 0x77);
            this.apu.write(0x25, 0xff);
            ch.note = note;
            ch.period = c < 3 ? periodOf(note) : notePoly(note);
            this.loadInstrument(c, s);
            this.playNote(c);
        }
    }

    class Engine {
        constructor(rate, post) {
            this.apu = new APU(rate);
            this.driver = new Driver(this.apu);
            this.driver.powerOn();
            this.post = post;
            this.rate = rate;
            this.frameLeft = 0;
            this.previewLeft = 0;
            this.previewCh = 0;
            this.gain = 0.7;
        }

        handle(m) {
            const d = this.driver;
            switch (m.type) {
                case "song":
                    d.setSong(m.song);
                    break;
                case "play":
                    if (!d.song) return;
                    this.previewLeft = 0;
                    d.once = !!m.once;
                    d.cutAtEnd = !!m.cutAtEnd;
                    d.start(m.order, m.row);
                    this.frameLeft = 0;
                    break;
                case "stop":
                    d.stop();
                    this.post({ type: "stopped" });
                    break;
                case "loop":
                    d.loop = !!m.on;
                    if (m.once !== undefined) d.once = !!m.once;
                    break;
                case "mute":
                    this.apu.mask = m.mask.slice(0, 4).map(Boolean);
                    break;
                case "preview":
                    if (d.playing) return;
                    if (this.previewLeft > 0 && this.previewCh !== m.ch) d.cut(this.previewCh);
                    d.preview(m.ch, m.inst, m.note);
                    this.previewCh = m.ch;
                    this.previewLeft = Math.max(1, Math.round((m.dur || 0.5) * this.rate));
                    break;
            }
        }

        render(L, R, n) {
            const apu = this.apu;
            const d = this.driver;
            for (let i = 0; i < n; i++) {
                apu.frac += apu.cps;
                const cyc = Math.floor(apu.frac);
                apu.frac -= cyc;
                if (d.playing) {
                    this.frameLeft -= cyc;
                    if (this.frameLeft <= 0) {
                        this.frameLeft += FRAME_CYCLES;
                        d.tickOnce();
                        if (d.playing) this.post({ type: "pos", order: d.order, row: d.row, tick: d.tick, speed: d.speed });
                        else this.post({ type: "ended" });
                    }
                }
                if (this.previewLeft > 0) {
                    this.previewLeft--;
                    if (this.previewLeft === 0 && !d.playing) d.cut(this.previewCh);
                }
                apu.sample(cyc, L, R, i, this.gain);
            }
        }
    }

    const regChannel = a => a >= 0x30 ? 2 : a <= 0x14 ? 0 : a <= 0x19 ? 1 : a <= 0x1e ? 2 : a <= 0x23 ? 3 : -1;

    function renderVgm(song, maxSeconds) {
        const apu = new APU(44100);
        const d = new Driver(apu);
        d.setSong(song);
        d.start(0, 0);
        d.once = true;
        d.cutAtEnd = true;
        d.loop = false;
        const used = song.used || [true, true, true, true];
        const limit = Math.round((maxSeconds || 60) * 59.7275);
        const data = [];
        let frames = 0;
        while (d.playing && frames < limit) {
            apu.log = [];
            d.tickOnce();
            const log = apu.log;
            for (let i = 0; i < log.length; i += 2) {
                const c = regChannel(log[i]);
                if (c >= 0 && !used[c]) continue;
                data.push(0xb3, log[i] - 0x10, log[i + 1]);
            }
            data.push(0x62);
            frames++;
        }
        data.push(0x66);
        const out = new Uint8Array(0x100 + data.length);
        const view = new DataView(out.buffer);
        out.set([0x56, 0x67, 0x6d, 0x20], 0);
        view.setUint32(0x04, out.length - 4, true);
        view.setUint32(0x08, 0x172, true);
        view.setUint32(0x18, frames * 735, true);
        view.setUint32(0x24, 60, true);
        view.setUint32(0x34, 0x100 - 0x34, true);
        view.setUint32(0x80, CPU_HZ, true);
        out.set(data, 0x100);
        return { bytes: out, frames, seconds: frames / 59.7275 };
    }

    function wavFile(L, R, n, rate) {
        let peak = 0;
        for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
        const g = peak > 0.89 ? 0.89 / peak : 1;
        const out = new Uint8Array(44 + n * 4);
        const v = new DataView(out.buffer);
        const str = (o, s) => {
            for (let k = 0; k < s.length; k++) out[o + k] = s.charCodeAt(k);
        };
        str(0, "RIFF");
        v.setUint32(4, 36 + n * 4, true);
        str(8, "WAVE");
        str(12, "fmt ");
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 2, true);
        v.setUint32(24, rate, true);
        v.setUint32(28, rate * 4, true);
        v.setUint16(32, 4, true);
        v.setUint16(34, 16, true);
        str(36, "data");
        v.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) {
            v.setInt16(44 + i * 4, Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), true);
            v.setInt16(46 + i * 4, Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), true);
        }
        return out;
    }

    function renderWav(song, opts) {
        const o = opts || {};
        const rate = 44100;
        let done = false;
        const e = new Engine(rate, m => {
            if (m.type === "ended") done = true;
        });
        if (o.mask) e.handle({ type: "mute", mask: o.mask });
        e.handle({ type: "song", song });
        e.handle({ type: "play", order: 0, row: 0, once: true, cutAtEnd: !!o.cutAtEnd });
        const max = rate * (o.maxSeconds || 600);
        const block = 1024;
        let L = new Float32Array(rate * 4);
        let R = new Float32Array(rate * 4);
        let n = 0;
        let tail = -1;
        while (n < max) {
            if (n + block > L.length) {
                const L2 = new Float32Array(L.length * 2);
                const R2 = new Float32Array(R.length * 2);
                L2.set(L);
                R2.set(R);
                L = L2;
                R = R2;
            }
            e.render(L.subarray(n, n + block), R.subarray(n, n + block), block);
            n += block;
            if (done && tail < 0) tail = Math.round((o.tail || 0) * rate);
            if (tail >= 0) {
                tail -= block;
                if (tail <= 0) break;
            }
        }
        return { bytes: wavFile(L, R, n, rate), seconds: n / rate };
    }

    return { Engine, APU, Driver, notePoly, PERIODS, renderVgm, renderWav };
}

const GBAudio = (function () {
    "use strict";

    let ctx = null;
    let node = null;
    let engine = null;
    let gainNode = null;
    let starting = null;
    let volume = 0.7;
    const listeners = [];

    function emit(m) {
        for (const f of listeners) f(m);
    }

    function workletMain() {
        class GBProcessor extends AudioWorkletProcessor {
            constructor() {
                super();
                this.engine = new Core.Engine(sampleRate, m => this.port.postMessage(m));
                this.port.onmessage = e => this.engine.handle(e.data);
            }

            process(inputs, outputs) {
                const out = outputs[0];
                this.engine.render(out[0], out[1] || out[0], out[0].length);
                return true;
            }
        }
        registerProcessor("gb-apu", GBProcessor);
    }

    async function boot() {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error("This browser has no Web Audio support.");
        ctx = new AC({ latencyHint: "interactive" });
        gainNode = ctx.createGain();
        gainNode.gain.value = volume;
        gainNode.connect(ctx.destination);
        try {
            if (!ctx.audioWorklet) throw new Error("no worklet");
            const src = "const Core = (" + GBAudioCore.toString() + ")();\n(" + workletMain.toString() + ")();\n";
            try {
                await ctx.audioWorklet.addModule("data:application/javascript;charset=utf-8," + encodeURIComponent(src));
            } catch (e) {
                await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: "application/javascript" })));
            }
            node = new AudioWorkletNode(ctx, "gb-apu", { numberOfInputs: 0, outputChannelCount: [2] });
            node.port.onmessage = e => emit(e.data);
            node.connect(gainNode);
        } catch (err) {
            node = null;
            engine = new (GBAudioCore().Engine)(ctx.sampleRate, emit);
            const sp = ctx.createScriptProcessor(1024, 0, 2);
            sp.onaudioprocess = e => {
                const b = e.outputBuffer;
                engine.render(b.getChannelData(0), b.getChannelData(1), b.length);
            };
            sp.connect(gainNode);
        }
        if (ctx.state === "suspended") await ctx.resume();
    }

    function start() {
        if (!starting) starting = boot();
        else if (ctx && ctx.state === "suspended") ctx.resume();
        return starting;
    }

    function send(m) {
        if (!starting) return;
        starting.then(() => {
            if (node) node.port.postMessage(m);
            else if (engine) engine.handle(m);
        });
    }

    function setVolume(v) {
        volume = v;
        if (gainNode) gainNode.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    }

    return {
        start,
        send,
        setVolume,
        on: f => listeners.push(f),
        get started() {
            return !!starting;
        },
        get mode() {
            return node ? "worklet" : engine ? "script" : "none";
        }
    };
})();
