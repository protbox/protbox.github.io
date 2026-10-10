(function (root) {
    "use strict";

    function twice(cycle) {
        return cycle.concat(cycle);
    }

    function fromFn(n, fn) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(Math.max(0, Math.min(15, Math.round(fn(i / n)))));
        return out;
    }

    const SHAPES = {
        triangle: () => twice([0, 2, 4, 6, 8, 10, 12, 14, 15, 13, 11, 9, 7, 5, 3, 1]),
        sawtooth: () => twice(fromFn(16, t => t * 15)),
        square: () => twice(fromFn(16, t => t < 0.5 ? 15 : 0)),
        pulse25: () => twice(fromFn(16, t => t < 0.25 ? 15 : 0)),
        sine: () => twice(fromFn(16, t => 7.5 + 7.5 * Math.sin(t * Math.PI * 2))),
        organ: () => {
            const raw = [];
            for (let i = 0; i < 16; i++) {
                const a = i / 16 * Math.PI * 2;
                raw.push(Math.sin(a) + 0.5 * Math.sin(a * 2) + 0.25 * Math.sin(a * 4));
            }
            const lo = Math.min(...raw);
            const hi = Math.max(...raw);
            return twice(raw.map(v => Math.round((v - lo) / (hi - lo) * 15)));
        },
        flute: () => twice([3, 6, 9, 12, 14, 15, 15, 14, 12, 9, 6, 3, 1, 0, 0, 1]),
        hollow: () => twice([15, 15, 12, 8, 4, 2, 1, 0, 0, 1, 2, 4, 8, 12, 15, 15]),
        deep: () => fromFn(32, t => t < 0.5 ? t * 2 * 15 : (1 - t) * 2 * 15),
        buzz: () => twice([15, 11, 8, 6, 4, 3, 2, 1, 0, 1, 2, 3, 4, 6, 8, 11]),
        ramp: () => twice(fromFn(16, t => (1 - t) * 15))
    };

    const SHAPE_LABELS = {
        triangle: "Triangle",
        sine: "Sine",
        sawtooth: "Saw",
        square: "Square",
        pulse25: "Pulse 25%",
        organ: "Organ",
        flute: "Flute",
        hollow: "Hollow",
        buzz: "Buzz",
        deep: "Deep (1 cycle)"
    };

    const PULSE = [
        { name: "Square Lead", desc: "50% duty, steady. The classic melody voice.", data: { duty: 2, vol: 12, envDir: "down", envPace: 0 } },
        { name: "Bright Lead", desc: "25% duty, nasal and cutting.", data: { duty: 1, vol: 12, envDir: "down", envPace: 0 } },
        { name: "Thin Lead", desc: "12.5% duty, reedy and thin.", data: { duty: 0, vol: 11, envDir: "down", envPace: 0 } },
        { name: "Pluck", desc: "Fast decay. Great for arpeggios.", data: { duty: 1, vol: 15, envDir: "down", envPace: 1 } },
        { name: "Soft Pluck", desc: "Gentler decay, a little rounder.", data: { duty: 2, vol: 11, envDir: "down", envPace: 2 } },
        { name: "Bell", desc: "Long ringing decay.", data: { duty: 1, vol: 15, envDir: "down", envPace: 4 } },
        { name: "Pulse Bass", desc: "Full volume, slow fade. Bass on a pulse channel.", data: { duty: 2, vol: 15, envDir: "down", envPace: 6 } },
        { name: "Swell", desc: "Fades in from silence.", data: { duty: 2, vol: 0, envDir: "up", envPace: 3 } },
        { name: "Echo", desc: "Quiet copy of a lead, for a delayed echo on Pulse 2.", data: { duty: 1, vol: 5, envDir: "down", envPace: 2 } },
        { name: "Blip", desc: "Short staccato chirp using the length counter.", data: { duty: 0, vol: 14, envDir: "down", envPace: 1, length: 12 } },
        { sfx: true, name: "Jump", desc: "Quick rising chirp. Pulse 1 only (uses sweep).", data: { duty: 2, vol: 13, envDir: "down", envPace: 2, sweepTime: 2, sweepDir: "up", sweepShift: 3 } },
        { sfx: true, name: "Coin", desc: "Bright ding. Play two quick notes a fourth apart.", data: { duty: 1, vol: 15, envDir: "down", envPace: 3 } },
        { sfx: true, name: "Power Up", desc: "Slow upward glide for climbing arpeggios. Pulse 1 only.", data: { duty: 2, vol: 12, envDir: "down", envPace: 4, sweepTime: 4, sweepDir: "up", sweepShift: 6 } },
        { sfx: true, name: "Laser Zap", desc: "Thin, fast downward zap. Pulse 1 only.", data: { duty: 0, vol: 15, envDir: "down", envPace: 1, sweepTime: 1, sweepDir: "down", sweepShift: 2 } },
        { sfx: true, name: "Hurt", desc: "Harsh pitch drop for damage. Pulse 1 only.", data: { duty: 0, vol: 15, envDir: "down", envPace: 2, sweepTime: 2, sweepDir: "down", sweepShift: 1 } },
        { sfx: true, name: "Bounce", desc: "Short springy boing. Pulse 1 only.", data: { duty: 2, vol: 14, envDir: "down", envPace: 1, sweepTime: 1, sweepDir: "up", sweepShift: 4 } },
        { sfx: true, name: "Swoosh", desc: "Soft falling sweep for swings and dashes. Pulse 1 only.", data: { duty: 0, vol: 10, envDir: "down", envPace: 3, sweepTime: 3, sweepDir: "down", sweepShift: 3 } },
        { sfx: true, name: "Teleport", desc: "Smooth long rise. Pulse 1 only.", data: { duty: 2, vol: 12, envDir: "down", envPace: 5, sweepTime: 1, sweepDir: "up", sweepShift: 7 } },
        { sfx: true, name: "Charge Up", desc: "Fades in while slowly rising. Pulse 1 only.", data: { duty: 1, vol: 3, envDir: "up", envPace: 2, sweepTime: 7, sweepDir: "up", sweepShift: 7 } },
        { sfx: true, name: "Sparkle", desc: "Glassy tone for magic. Add a fast arpeggio.", data: { duty: 1, vol: 11, envDir: "down", envPace: 3 } },
        { sfx: true, name: "Menu Blip", desc: "Tiny tick for cursors and text.", data: { duty: 1, vol: 12, envDir: "down", envPace: 1, length: 6 } },
        { sfx: true, name: "Confirm", desc: "Round, friendly beep.", data: { duty: 2, vol: 13, envDir: "down", envPace: 2 } },
        { sfx: true, name: "Error Buzz", desc: "Flat buzz. Use low notes.", data: { duty: 3, vol: 13, envDir: "down", envPace: 0 } }
    ];

    const WAVE = [
        { name: "Triangle Bass", desc: "Round, warm bass. The go-to wave bass.", data: { level: 1, shape: "triangle" } },
        { name: "Deep Bass", desc: "One-cycle wave: sounds an octave lower than written.", data: { level: 1, shape: "deep" } },
        { name: "Sine", desc: "Pure and soft. Flute-like in high notes.", data: { level: 1, shape: "sine" } },
        { name: "Saw", desc: "Bright and buzzy, good for leads and bass.", data: { level: 1, shape: "sawtooth" } },
        { name: "Wave Square", desc: "Hollow square, fuller than the pulse channels.", data: { level: 1, shape: "square" } },
        { name: "Organ", desc: "Harmonic-rich organ tone.", data: { level: 1, shape: "organ" } },
        { name: "Flute", desc: "Soft, breathy lead.", data: { level: 1, shape: "flute" } },
        { name: "Hollow", desc: "Nasal, clarinet-ish tone.", data: { level: 1, shape: "hollow" } },
        { name: "Buzz Bass", desc: "Gritty bass with extra bite.", data: { level: 1, shape: "buzz" } },
        { name: "Pad", desc: "Sine at half volume, sits behind the leads.", data: { level: 2, shape: "sine" } },
        { name: "Quiet Echo", desc: "Triangle at 25% volume for echoes and backing.", data: { level: 3, shape: "triangle" } },
        { name: "Wave Pluck", desc: "Saw that stops after a short time.", data: { level: 1, shape: "sawtooth", length: 40 } },
        { sfx: true, name: "Warble", desc: "Pure tone for magic. Add vibrato.", data: { level: 1, shape: "sine" } },
        { sfx: true, name: "Rumble", desc: "Deep one-cycle wave. Slide it down under explosions.", data: { level: 1, shape: "deep" } },
        { sfx: true, name: "Bass Drop", desc: "Buzzy saw for big falling sounds.", data: { level: 1, shape: "sawtooth" } },
        { sfx: true, name: "Beep", desc: "Hollow square that stops on its own.", data: { level: 2, shape: "square", length: 24 } }
    ];

    const NOISE = [
        { name: "Kick", desc: "Low thump. Metallic mode keeps it heavy but audible.", data: { vol: 15, envDir: "down", envPace: 2, bits: 7, note: 32 } },
        { name: "Punchy Kick", desc: "Shorter and brighter, cuts through busy mixes.", data: { vol: 15, envDir: "down", envPace: 1, bits: 7, note: 36 } },
        { name: "Soft Kick", desc: "Smooth noise thud for quieter tracks.", data: { vol: 15, envDir: "down", envPace: 2, bits: 15, note: 34 } },
        { name: "Snare", desc: "Mid-range crack.", data: { vol: 13, envDir: "down", envPace: 2, bits: 15, note: 40 } },
        { name: "Closed Hat", desc: "Short, bright tick.", data: { vol: 8, envDir: "down", envPace: 1, bits: 15, note: 54 } },
        { name: "Open Hat", desc: "Bright and ringing.", data: { vol: 8, envDir: "down", envPace: 3, bits: 15, note: 52 } },
        { name: "Clap", desc: "Snappy, a bit higher than the snare.", data: { vol: 12, envDir: "down", envPace: 2, bits: 15, note: 44 } },
        { name: "Crash", desc: "Long noisy wash.", data: { vol: 12, envDir: "down", envPace: 6, bits: 15, note: 46 } },
        { name: "Low Tom", desc: "Tonal drum using metallic noise.", data: { vol: 14, envDir: "down", envPace: 2, bits: 7, note: 48 } },
        { name: "High Tom", desc: "Higher tonal drum.", data: { vol: 14, envDir: "down", envPace: 2, bits: 7, note: 52 } },
        { name: "Rimshot", desc: "Short metallic click.", data: { vol: 11, envDir: "down", envPace: 1, bits: 7, note: 56 } },
        { name: "Shaker", desc: "Quiet, high texture for fast patterns.", data: { vol: 5, envDir: "down", envPace: 1, bits: 15, note: 58 } },
        { name: "Explosion", desc: "Big, low and long. A sound effect as much as a drum.", data: { vol: 15, envDir: "down", envPace: 7, bits: 15, note: 30 } },
        { name: "Riser", desc: "Noise that fades in.", data: { vol: 0, envDir: "up", envPace: 4, bits: 15, note: 48 } },
        { sfx: true, name: "Big Boom", desc: "Long, heavy explosion.", data: { vol: 15, envDir: "down", envPace: 7, bits: 15, note: 30 } },
        { sfx: true, name: "Small Boom", desc: "Short blast for bullets hitting walls.", data: { vol: 15, envDir: "down", envPace: 4, bits: 15, note: 34 } },
        { sfx: true, name: "Hit", desc: "Punchy impact.", data: { vol: 15, envDir: "down", envPace: 1, bits: 15, note: 40 } },
        { sfx: true, name: "Slash", desc: "Bright hiss for swords and claws.", data: { vol: 11, envDir: "down", envPace: 2, bits: 15, note: 54 } },
        { sfx: true, name: "Crunch", desc: "Metallic crunch for breaking things.", data: { vol: 14, envDir: "down", envPace: 2, bits: 7, note: 44 } },
        { sfx: true, name: "Thud", desc: "Low knock for doors and landing.", data: { vol: 15, envDir: "down", envPace: 1, bits: 7, note: 30 } },
        { sfx: true, name: "Footstep", desc: "Quiet tap. Alternate two pitches for walking.", data: { vol: 9, envDir: "down", envPace: 1, bits: 15, note: 46 } },
        { sfx: true, name: "Splash", desc: "Wet spray for water.", data: { vol: 12, envDir: "down", envPace: 4, bits: 15, note: 56 } },
        { sfx: true, name: "Static", desc: "Electric crackle.", data: { vol: 10, envDir: "down", envPace: 3, bits: 7, note: 58 } },
        { sfx: true, name: "Noise Zap", desc: "Short electric snap.", data: { vol: 12, envDir: "down", envPace: 2, bits: 7, note: 52 } },
        { sfx: true, name: "Wind", desc: "Hiss that swells in.", data: { vol: 0, envDir: "up", envPace: 6, bits: 15, note: 50 } }
    ];

    const DEFAULTS = {
        pulse: { duty: 2, vol: 15, envDir: "down", envPace: 0, length: 0, sweepTime: 0, sweepDir: "down", sweepShift: 0 },
        wave: { level: 1, length: 0, shape: "triangle" },
        noise: { vol: 15, envDir: "down", envPace: 1, length: 0, bits: 15, note: 24 }
    };

    function make(type, preset) {
        const inst = Object.assign({ type, name: preset.name }, JSON.parse(JSON.stringify(DEFAULTS[type])), JSON.parse(JSON.stringify(preset.data)));
        if (type === "wave" && !Array.isArray(inst.wave)) inst.wave = SHAPES[inst.shape] ? SHAPES[inst.shape]() : SHAPES.triangle();
        delete inst.shape;
        return inst;
    }

    const LIBRARY = { pulse: PULSE, wave: WAVE, noise: NOISE };

    root.Presets = { LIBRARY, SHAPES, SHAPE_LABELS, DEFAULTS, make };
})(typeof window !== "undefined" ? window : globalThis);
