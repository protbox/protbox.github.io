/* =========================================================
   DOM
========================================================= */

const root_select = document.getElementById("root_select")
const scale_select = document.getElementById("scale_select")
const chord_grid = document.getElementById("chord_grid")
const now_playing = document.getElementById("now_playing")
const groove_select = document.getElementById("groove_select")

/* =========================================================
   CONSTANTS
========================================================= */

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
const LETTERS = ["C","D","E","F","G","A","B"]
const NATURAL_PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }

const chord_track = []
const PX_PER_BAR = 32
const SNAP = 0.5

const LETTER_COLORS = {
    A:"#ffa214", B:"#27d233", C:"#2993ff",
    D:"#5d4ff7", E:"#892ae2", F:"#e14bea", G:"#fb215b"
}

const SCALES = {
    Ionian:        [2,2,1,2,2,2,1],
    Aeolian:       [2,1,2,2,1,2,2],
    MelodicMinor:  [2,1,2,2,2,2,1],
    HarmonicMinor: [2,1,2,2,1,3,1],
    Dorian:        [2,1,2,2,2,1,2],
    Lydian:        [2,2,2,1,2,2,1],
    Mixolydian:    [2,2,1,2,2,1,2],
    Phrygian:      [1,2,2,2,1,2,2],
    Locrian:       [1,2,2,1,2,2,2]
}

const CHORD_ROWS = [
    { id:"5",          label:"5" },
    { id:"sus2",       label:"sus2" },
    { id:"triad",      label:"triad" },
    { id:"sus4",       label:"sus4" },
    { id:"sus24",      label:"sus24" },
    { id:"6",          label:"6" },
    { id:"7sus2",      label:"7sus2" },
    { id:"7",          label:"7" },
    { id:"7sus4",      label:"7sus4" },
    { id:"9",          label:"9" },
    { id:"11",         label:"11" },
    { id:"add2add9",   label:"add2/add9" },
    { id:"add4add11",  label:"add4/add11" }
]

/* =========================================================
   STATE
========================================================= */

let root_name = "C"
let scale_name = "Ionian"
let groove_timer = null
let groove_step = 0
let active = []
let drag_state = null
let insert_cursor = null

/* =========================================================
   AUDIO
========================================================= */

const audio_ctx = new (window.AudioContext || window.webkitAudioContext)()
const master_gain = audio_ctx.createGain()
master_gain.gain.value = 0.35
master_gain.connect(audio_ctx.destination)

const buffers = {}
let audio_unlocked = false

function pc_from_name(name) {
    return NOTE_NAMES.indexOf(name)
}

function name_from_pc(pc) {
    return NOTE_NAMES[((pc % 12) + 12) % 12]
}

function midi_from_pc_octave(pc, octave_offset) {
    // user-chosen base for RH
    let midi = 48 + ((pc - (48 % 12) + 12) % 12)
    midi += 12 * (octave_offset || 0)

    while (midi < 36) midi += 12
    while (midi > 96) midi -= 12

    return midi
}

function bass_midi_from_pc(pc) {
    return 36 + ((pc - (36 % 12) + 12) % 12)
}

async function get_buffer(midi) {
    if (buffers[midi]) return buffers[midi]
    const res = await fetch(`keys/${midi}.ogg`)
    const arr = await res.arrayBuffer()
    buffers[midi] = await audio_ctx.decodeAudioData(arr)
    return buffers[midi]
}

async function unlock_audio() {
    if (audio_unlocked) return
    audio_unlocked = true

    if (audio_ctx.state !== "running") {
        await audio_ctx.resume()
    }
}

function attach_audio_unlock() {
    const handler = async () => {
        await unlock_audio()
        document.removeEventListener("pointerdown", handler)
        document.removeEventListener("keydown", handler)
        document.removeEventListener("touchstart", handler)
    }

    document.addEventListener("pointerdown", handler)
    document.addEventListener("keydown", handler)
    document.addEventListener("touchstart", handler)
}

async function ensure_sample_loaded(midi) {
    await unlock_audio()
    await get_buffer(midi)
}

function start_note(midi, vel) {
    const src = audio_ctx.createBufferSource()
    src.buffer = buffers[midi]

    const gain = audio_ctx.createGain()
    gain.gain.value = vel

    src.connect(gain)
    gain.connect(master_gain)
    src.start()

    return { src, gain }
}

function release_notes(active, release_time) {
    const t = audio_ctx.currentTime
    const rt = release_time == null ? 0.15 : release_time

    for (const n of active) {
        try {
            n.gain.gain.cancelScheduledValues(t)
            n.gain.gain.setValueAtTime(n.gain.gain.value, t)
            n.gain.gain.linearRampToValueAtTime(0, t + rt)
            n.src.stop(t + rt + 0.02)
        } catch {}
    }
}

/* =========================================================
   THEORY / SPELLING
========================================================= */

function rotate_letters_from_root(root_name_in) {
    const start_letter = root_name_in[0]
    const idx = LETTERS.indexOf(start_letter)
    return LETTERS.slice(idx).concat(LETTERS.slice(0, idx))
}

function build_scale_pcs(root_pc, pattern) {
    const pcs = [root_pc]
    let cur = root_pc

    for (let i = 0; i < pattern.length - 1; i++) {
        cur = (cur + pattern[i]) % 12
        pcs.push(cur)
    }

    return pcs
}

function spell_note(letter, pc) {
    const base = NATURAL_PC[letter]
    let diff = (pc - base + 12) % 12
    if (diff > 6) diff -= 12

    const acc = {
        "-2":"bb",
        "-1":"b",
        "0":"",
        "1":"#",
        "2":"##"
    }[String(diff)]

    if (acc === undefined) return name_from_pc(pc)
    return `${letter}${acc}`
}

function pc_set_from_scale(scale_pcs) {
    const s = new Set()
    for (const pc of scale_pcs) s.add(pc)
    return s
}

function normalize_pc_list(pcs) {
    const seen = new Set()
    const out = []
    for (const pc of pcs) {
        const n = ((pc % 12) + 12) % 12
        if (!seen.has(n)) {
            seen.add(n)
            out.push(n)
        }
    }
    return out
}

/* =========================================================
   CHORD GENERATION
========================================================= */

function diatonic_stack(scale_pcs, degree_index, steps) {
    // steps are offsets in "scale degrees": 0,2,4,6...
    const out = []
    const len = scale_pcs.length

    for (const step of steps) {
        const idx = degree_index + step
        out.push({
            pc: scale_pcs[idx % len],
            octave: Math.floor(idx / len)
        })
    }

    return out
}

function fixed_intervals_from_root(root_pc, semitones) {
    // returns pcs only
    const pcs = []
    for (const st of semitones) pcs.push((root_pc + st) % 12)
    return normalize_pc_list(pcs)
}

function diatonic_7th_pc(scale_pcs, degree_index) {
    const len = scale_pcs.length
    return scale_pcs[(degree_index + 6) % len]
}

function build_chord_pcs_for_type(type_id, root_pc, scale_pcs, degree_index) {
    // returns { pcs: [pc...], diatonic: [{pc,octave}...]? }
    // We return pcs (pitch-classes) for membership tests,
    // and a diatonic stack when we want sensible octaves for playback.

    if (type_id === "triad") {
        const stack = diatonic_stack(scale_pcs, degree_index, [0,2,4])
        return { pcs: normalize_pc_list(stack.map(n => n.pc)), stack }
    }

    if (type_id === "6") {
        const stack = diatonic_stack(scale_pcs, degree_index, [0,2,4,5])
        return { pcs: normalize_pc_list(stack.map(n => n.pc)), stack }
    }

    if (type_id === "7") {
        const stack = diatonic_stack(scale_pcs, degree_index, [0,2,4,6])
        return { pcs: normalize_pc_list(stack.map(n => n.pc)), stack }
    }

    if (type_id === "9") {
        const stack = diatonic_stack(scale_pcs, degree_index, [0,2,4,6,8])
        return { pcs: normalize_pc_list(stack.map(n => n.pc)), stack }
    }

    if (type_id === "11") {
        const stack = diatonic_stack(scale_pcs, degree_index, [0,2,4,6,8,10])
        return { pcs: normalize_pc_list(stack.map(n => n.pc)), stack }
    }

    if (type_id === "5") {
        return { pcs: fixed_intervals_from_root(root_pc, [0,7]), stack: null }
    }

    if (type_id === "sus2") {
        return { pcs: fixed_intervals_from_root(root_pc, [0,2,7]), stack: null }
    }

    if (type_id === "sus4") {
        return { pcs: fixed_intervals_from_root(root_pc, [0,5,7]), stack: null }
    }

    if (type_id === "sus24") {
        return { pcs: fixed_intervals_from_root(root_pc, [0,2,5,7]), stack: null }
    }

    if (type_id === "7sus2") {
        const pcs = fixed_intervals_from_root(root_pc, [0,2,7])
        pcs.push(diatonic_7th_pc(scale_pcs, degree_index))
        return { pcs: normalize_pc_list(pcs), stack: null }
    }

    if (type_id === "7sus4") {
        const pcs = fixed_intervals_from_root(root_pc, [0,5,7])
        pcs.push(diatonic_7th_pc(scale_pcs, degree_index))
        return { pcs: normalize_pc_list(pcs), stack: null }
    }

    if (type_id === "add2add9") {
        const stack = diatonic_stack(scale_pcs, degree_index, [0,2,4])
        const added_pc = (root_pc + 2) % 12

        return {
            pcs: normalize_pc_list([...stack.map(n => n.pc), added_pc]),
            stack,
            extra_pcs: [added_pc]
        }
    }

    if (type_id === "add4add11") {
        const stack = diatonic_stack(scale_pcs, degree_index, [0,2,4])
        const added_pc = (root_pc + 5) % 12

        return {
            pcs: normalize_pc_list([...stack.map(n => n.pc), added_pc]),
            stack,
            extra_pcs: [added_pc]
        }
    }

    return { pcs: [], stack: null }
}

function chord_is_in_scale(chord_pcs, scale_set) {
    for (const pc of chord_pcs) {
        if (!scale_set.has(pc)) return false
    }
    return true
}

/* =========================================================
   LABELS (DIATONIC QUALITIES FOR 7)
========================================================= */

function interval_between(root_pc, other_pc) {
    return (other_pc - root_pc + 12) % 12
}

function seventh_quality_label(root_pc, chord_pcs) {
    // expects diatonic 1-3-5-7 pitch classes
    // returns "maj7", "m7", "7", "m7b5", "dim7" (best-effort)
    const pcs = chord_pcs.slice()
    const third = pcs.find(pc => interval_between(root_pc, pc) === 3 || interval_between(root_pc, pc) === 4)
    const fifth = pcs.find(pc => interval_between(root_pc, pc) === 6 || interval_between(root_pc, pc) === 7 || interval_between(root_pc, pc) === 8)
    const seventh = pcs.find(pc => interval_between(root_pc, pc) === 10 || interval_between(root_pc, pc) === 11)

    const i3 = third == null ? null : interval_between(root_pc, third)
    const i5 = fifth == null ? null : interval_between(root_pc, fifth)
    const i7 = seventh == null ? null : interval_between(root_pc, seventh)

    if (i3 === 4 && i5 === 7 && i7 === 11) return "maj7"
    if (i3 === 4 && i5 === 7 && i7 === 10) return "7"
    if (i3 === 3 && i5 === 7 && i7 === 10) return "m7"
    if (i3 === 3 && i5 === 6 && i7 === 10) return "m7b5"
    if (i3 === 3 && i5 === 6 && i7 === 9) return "dim7"
    return "7"
}

function triad_quality_suffix(root_pc, chord_pcs) {
    const third = chord_pcs.find(pc => interval_between(root_pc, pc) === 3 || interval_between(root_pc, pc) === 4)
    const fifth = chord_pcs.find(pc => interval_between(root_pc, pc) === 6 || interval_between(root_pc, pc) === 7 || interval_between(root_pc, pc) === 8)

    const i3 = third == null ? null : interval_between(root_pc, third)
    const i5 = fifth == null ? null : interval_between(root_pc, fifth)

    if (i3 === 4 && i5 === 7) return ""      // major
    if (i3 === 3 && i5 === 7) return "m"     // minor
    if (i3 === 3 && i5 === 6) return "dim"   // diminished
    if (i3 === 4 && i5 === 8) return "aug"   // augmented
    return ""
}

function chord_button_label(root_spelled, type_id, chord_pcs) {
    if (type_id === "triad") {
        const root_pc = pc_from_name(name_from_pc(pc_from_name(root_spelled.replace(/bb|b|##|#/g,"")))) // not reliable, so skip
        // Todo: show proper chord type, ie: aug, dim, maj, m
        return `${root_spelled}`
    }

    if (type_id === "7") {
        const root_pc_guess = chord_pcs[0]
        return `${root_spelled}${seventh_quality_label(root_pc_guess, chord_pcs)}`
    }

    const row = CHORD_ROWS.find(r => r.id === type_id)
    return `${root_spelled} ${row ? row.label : type_id}`
}

/* =========================================================
   UI HELPERS
========================================================= */

function snap_bar(v) {
    return Math.round(v / SNAP) * SNAP
}

function x_to_bar(x, lane) {
    const r = lane.getBoundingClientRect()
    return snap_bar((x - r.left) / PX_PER_BAR)
}

function begin_chord_drag(label, chord_data, letter, e) {
    const ghost = document.createElement("div")
    ghost.className = "chord_region dragging"
    ghost.textContent = label
    ghost.style.position = "fixed"
    ghost.style.pointerEvents = "none"
    ghost.style.zIndex = 9999
    document.body.appendChild(ghost)

    const lane = document.getElementById("chord_track_lane")

    insert_cursor = document.createElement("div")
    insert_cursor.className = "insert_cursor"
    lane.appendChild(insert_cursor)

    drag_state = { ghost, label, chord_data, letter }

    const move = ev => {
        ghost.style.left = ev.clientX + 6 + "px"
        ghost.style.top = ev.clientY + 6 + "px"

        if (ev.target.closest("#chord_track_lane")) {
            const bar = x_to_bar(ev.clientX, lane)
            insert_cursor.style.left = bar * PX_PER_BAR + "px"
        }
    }

    const up = ev => {
        end_chord_drag(ev)
        document.removeEventListener("pointermove", move)
        document.removeEventListener("pointerup", up)
    }

    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", up)
}

function end_chord_drag(e) {
    const lane = document.getElementById("chord_track_lane")

    if (e.target.closest("#chord_track_lane")) {
        const start_bar = x_to_bar(e.clientX, lane)

        insert_chord_region({
            id: crypto.randomUUID(),
            label: drag_state.label,
            chord_data: drag_state.chord_data,
            letter: drag_state.letter,
            start_bar,
            length_bars: 4
        })

        render_chord_track()
    }

    drag_state.ghost.remove()
    insert_cursor.remove()
    drag_state = null
}

function render_chord_track() {
    const lane = document.getElementById("chord_track_lane")
    lane.querySelectorAll(".chord_region").forEach(n => n.remove())

    for (const c of chord_track) {
        const el = document.createElement("div")
        el.className = "chord_region"
        el.textContent = c.label

        el.style.left = c.start_bar * PX_PER_BAR + "px"
        el.style.width = c.length_bars * PX_PER_BAR + "px"

        const color = LETTER_COLORS[c.letter]
        if (color) {
            el.style.background = `${color}33`
            el.style.borderColor = `${color}aa`
            el.style.color = "#fff"
        }

        lane.appendChild(el)
    }
}

function insert_chord_region(region) {
    const insert_at = region.start_bar
    const shift = region.length_bars

    for (const c of chord_track) {
        if (c.start_bar >= insert_at) {
            c.start_bar += shift
        }
    }

    chord_track.push(region)
    chord_track.sort((a, b) => a.start_bar - b.start_bar)
}

function clear_grid() {
    chord_grid.innerHTML = ""
}

function make_cell(text, extra_class, color) {
    const el = document.createElement("div")
    el.className = `cell ${extra_class || ""}`.trim()
    el.textContent = text || ""
    if (color) el.style.color = color
    return el
}

function make_chord_button_cell(label, letter, root_pc, chord_pcs, stack_hint, extra_pcs) {
    const chord_data = {
        root_pc: root_pc,
        chord_pcs: chord_pcs,
        chord_midis: build_playback_midis(root_pc, chord_pcs)
    }

    const cell = document.createElement("div")
    cell.className = "cell"

    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "chord_btn"
    btn.textContent = label

    btn.style.background = `${LETTER_COLORS[letter]}22`
    btn.style.borderColor = `${LETTER_COLORS[letter]}66`

    let dragging = false

    btn.addEventListener("pointerdown", async e => {
        e.preventDefault()

        const start_x = e.clientX
        const start_y = e.clientY
        const grid_rect = chord_grid.getBoundingClientRect()

        dragging = false

        const move = ev => {
            if (dragging) return

            const outside =
                ev.clientX < grid_rect.left ||
                ev.clientX > grid_rect.right ||
                ev.clientY < grid_rect.top ||
                ev.clientY > grid_rect.bottom

            if (!outside) return

            dragging = true
            stop_groove()

            begin_chord_drag(label, chord_data, letter, ev)
        }

        const up = () => {
            document.removeEventListener("pointermove", move)
            document.removeEventListener("pointerup", up)
        }

        document.addEventListener("pointermove", move)
        document.addEventListener("pointerup", up)

        // ensure buffers for needed notes (don’t preload 61 files if you don't want to)
        await unlock_audio()
        const midis = build_playback_midis(root_pc, chord_pcs)

        for (const m of midis) await ensure_sample_loaded(m)

        const bass_midi = bass_midi_from_pc(root_pc)
        await ensure_sample_loaded(bass_midi)

        for (const m of midis) {
            await ensure_sample_loaded(m)
        }
        active = []
        now_playing.textContent = label

        start_groove(chord_data)

        //btn.setPointerCapture(e.pointerId)
    })

    const release = () => {
        if (dragging) return
        stop_groove()
        release_notes(active, 0.15)
        active = []
        now_playing.textContent = "—"
    }

    btn.addEventListener("pointerup", release)
    btn.addEventListener("pointerleave", release)
    btn.addEventListener("pointercancel", release)

    cell.appendChild(btn)
    return cell
}

/* =========================================================
   PLAYBACK VOICING
========================================================= */

function build_playback_midis(root_pc, chord_pcs) {
    const BASE = 48
    const midis = []

    const intervals = chord_pcs.map(pc => (pc - root_pc + 12) % 12)

    const has_3rd = intervals.includes(3) || intervals.includes(4)
    const is_sus2 = intervals.includes(2) && !has_3rd
    const is_sus4 = intervals.includes(5) && !has_3rd

    for (const pc of chord_pcs) {
        const interval = (pc - root_pc + 12) % 12

        // Drop RH root only for tertian chords
        if (pc === root_pc && has_3rd) continue

        let m = BASE + ((pc - (BASE % 12) + 12) % 12)

        // ---- VOICING RULES ----

        // Sus tones live INSIDE the chord body
        if (interval === 2 && is_sus2) {
            // keep close
        }
        else if (interval === 5 && is_sus4) {
            // keep close
        }

        // Add tones live in the body
        else if (interval === 2 || interval === 5) {
            // add2/add4: body
        }

        // True extensions float upward (9, 11)
        // BUT 6 (interval 9) stays in the body
        if (interval === 2 + 12 || interval === 5 + 12) {
            m += 12
        }

        // Clamp gently (never fold back down into bass range)
        while (m < 52) m += 12
        while (m > 84) m -= 12

        midis.push(m)
    }

    // Highest notes first feels best
    midis.sort((a, b) => b - a)
    return midis
}

/* =========================================================
   HIDDEN CHORD REPORTING
========================================================= */

function compute_hidden_for_degree(scale_pcs, degree_index, scale_set) {
    const root_pc = scale_pcs[degree_index]
    const hidden = []
    const shown = []

    for (const row of CHORD_ROWS) {
        const built = build_chord_pcs_for_type(row.id, root_pc, scale_pcs, degree_index)
        const ok = chord_is_in_scale(built.pcs, scale_set)
        if (ok) shown.push(row.label)
        else hidden.push(row.label)
    }

    return { shown, hidden }
}

function compute_hidden_summary(scale_pcs, cols_letters, scale_set) {
    const summary = []
    for (let i = 0; i < 7; i++) {
        const degree = i + 1
        const letter = cols_letters[i]
        const root_pc = scale_pcs[i]
        const spelled = spell_note(letter, root_pc)
        const r = compute_hidden_for_degree(scale_pcs, i, scale_set)
        summary.push({ degree, spelled, hidden: r.hidden })
    }
    return summary
}

function log_hidden_summary_to_console(mode_name, summary) {
    const out = summary.map(x => ({
        degree: x.degree,
        root: x.spelled,
        hidden: x.hidden.join(", ")
    }))
    console.log(`[Hidden chords] ${mode_name}`, out)
}

/* =========================================================
   GRID BUILD
========================================================= */

function build_grid() {
    clear_grid()

    const key_root_pc = pc_from_name(root_name)
    const pattern = SCALES[scale_name]
    const scale_pcs = build_scale_pcs(key_root_pc, pattern)
    const scale_set = pc_set_from_scale(scale_pcs)

    // Column letters follow the diatonic letter cycle from the chosen root
    const cols_letters = rotate_letters_from_root(root_name)

    // Report hidden chords (per degree) for current mode
    const hidden_summary = compute_hidden_summary(scale_pcs, cols_letters, scale_set)
    log_hidden_summary_to_console(scale_name, hidden_summary)

    // Rows
    for (const row of CHORD_ROWS) {
        for (let col = 0; col < 7; col++) {
            const letter = cols_letters[col]
            const root_pc = scale_pcs[col]
            const root_spelled = spell_note(letter, root_pc)

            const built = build_chord_pcs_for_type(row.id, root_pc, scale_pcs, col)
            const ok = chord_is_in_scale(built.pcs, scale_set)

            if (!ok) {
                chord_grid.appendChild(make_cell("", "empty"))
                continue
            }

            const label = row.id === "7"
                ? `${root_spelled}${seventh_quality_label(root_pc, built.pcs)}`
                : `${root_spelled} ${row.label}`

            chord_grid.appendChild(
                make_chord_button_cell(
                    label,
                    letter,
                    root_pc,
                    built.pcs,
                    built.stack,
                    built.extra_pcs || null
                )
            )
        }
    }
}


/* =========================================================
   GROOVE ENGINE (TICK / DURATION BASED)
========================================================= */

function ticks_per_32(ppq) {
    return ppq / 8
}

function bar_ticks(ppq) {
    return ppq * 4
}

function ticks_to_seconds(ticks, bpm, ppq) {
    return (ticks / ppq) * (60 / bpm)
}

const GROOVES = [
    {
        name: "Once",
        tempo: 120,
        ppq: 96,
        bars: 1,
        one_shot: true,

        lh: {
            seq_32: [
                { len: 32, note: "root" }
            ],
            vel: 0.9,
            gate: 1.0
        },

        rh: {
            seq_32: [
                { len: 32, hit: { notes: "all" } }
            ],
            vel: 0.95,
            gate: 1.0
        }
    },

    {
        name: "Dance 1",
        tempo: 120,
        ppq: 96,
        bars: 1,

        lh: {
            seq_32: [
                { len: 8, note: "root" },
                { len: 8, note: "octave" },
                { len: 8, note: "root" },
                { len: 8, note: "octave" }
            ],
            vel: 0.9,
            gate: 0.85
        },

        rh: {
            seq_32: [
                { len: 6, hit: { notes: "all", strum: { dir: "down", spread_ticks: 4 } } },
                { len: 6, hit: { notes: "all", strum: { dir: "up", spread_ticks: 4 } } },
                { len: 4, hit: { notes: "all", strum: { dir: "down", spread_ticks: 3 }, accent: true } },
                { len: 2 },
                { len: 6, hit: { notes: "all", strum: { dir: "up", spread_ticks: 4 } } },
                { len: 6, hit: { notes: "all", strum: { dir: "down", spread_ticks: 4 } } },
                { len: 2, hit: { notes: "all", strum: { dir: "up", spread_ticks: 2 }, accent: true } }
            ],
            vel: 0.95,
            gate: 0.72,
            accent_vel_boost: 0.15
        }
    }
]

let current_groove = GROOVES[0]
let groove_state = null

function resolve_bass_midi(chord_data, spec) {
    if (spec === "root") return bass_midi_from_pc(chord_data.root_pc)
    if (spec === "octave") return bass_midi_from_pc(chord_data.root_pc) + 12
    return null
}

function select_rh_midis(chord_data, notes_spec) {
    if (notes_spec === "all") return chord_data.chord_midis
    if (notes_spec === "top") return [chord_data.chord_midis[0]]
    if (notes_spec === "bottom") return [chord_data.chord_midis[chord_data.chord_midis.length - 1]]
    if (Array.isArray(notes_spec)) {
        return notes_spec.map(i => chord_data.chord_midis[i]).filter(Boolean)
    }
    return []
}

function apply_strum(midis, strum) {
    if (!strum) return midis.map(m => ({ midi: m, offset_ticks: 0 }))

    const spread = Math.max(0, strum.spread_ticks | 0)
    const ordered = midis.slice().sort((a, b) => a - b)
    const played = strum.dir === "down" ? ordered.slice().reverse() : ordered

    return played.map((m, i) => ({
        midi: m,
        offset_ticks: i * spread
    }))
}

function compile_track(track, seq_32, chord_data, ppq, base_vel, gate, accent_boost) {
    const t32 = ticks_per_32(ppq)
    let cursor = 0
    const events = []

    for (const seg of seq_32) {
        const seg_ticks = seg.len * t32

        if (track === "lh" && seg.note) {
            const midi = resolve_bass_midi(chord_data, seg.note)
            if (midi != null) {
                events.push({
                    midi,
                    vel: base_vel,
                    start_tick: cursor,
                    dur_ticks: Math.floor(seg_ticks * gate)
                })
            }
        }

        if (track === "rh" && seg.hit) {
            const vel = Math.min(1, base_vel + (seg.hit.accent ? accent_boost : 0))
            const midis = select_rh_midis(chord_data, seg.hit.notes)
            const strummed = apply_strum(midis, seg.hit.strum)

            for (const s of strummed) {
                events.push({
                    midi: s.midi,
                    vel,
                    start_tick: cursor + s.offset_ticks,
                    dur_ticks: Math.max(1, Math.floor(seg_ticks * gate) - s.offset_ticks)
                })
            }
        }

        cursor += seg_ticks
    }

    return events
}

function compile_groove(groove, chord_data) {
    const ppq = groove.ppq
    const loop_ticks = bar_ticks(ppq) * groove.bars
    const events = [
        ...compile_track("lh", groove.lh.seq_32, chord_data, ppq, groove.lh.vel, groove.lh.gate, 0),
        ...compile_track("rh", groove.rh.seq_32, chord_data, ppq, groove.rh.vel, groove.rh.gate, groove.rh.accent_vel_boost)
    ]

    const by_tick = new Map()
    for (const e of events) {
        const t = e.start_tick % loop_ticks
        if (!by_tick.has(t)) by_tick.set(t, [])
        by_tick.get(t).push(e)
    }

    return { bpm: groove.tempo, ppq, loop_ticks, by_tick }
}

function start_note_at(midi, vel, start_time, dur_time) {
    const src = audio_ctx.createBufferSource()
    src.buffer = buffers[midi]

    const gain = audio_ctx.createGain()
    gain.gain.setValueAtTime(0, start_time)
    gain.gain.linearRampToValueAtTime(vel, start_time + 0.002)

    const end = start_time + dur_time
    gain.gain.setValueAtTime(vel, Math.max(start_time + 0.003, end - 0.02))
    gain.gain.linearRampToValueAtTime(0, end)

    src.connect(gain)
    gain.connect(master_gain)

    src.start(start_time)
    src.stop(end + 0.03)

    active.push({ src, gain })
}

function start_groove(chord_data) {
    stop_groove()

    const compiled = compile_groove(current_groove, chord_data)
    const { bpm, ppq, loop_ticks, by_tick } = compiled

    groove_state = {
        start_time: audio_ctx.currentTime + 0.02,
        next_tick: 0,
        timer: null
    }

    const lookahead = 0.025
    const ahead = 0.2

    groove_state.timer = setInterval(() => {
        const now = audio_ctx.currentTime
        const target = now + ahead

        while (true) {
            // stop after one pass for one-shots
            if (current_groove.one_shot && groove_state.next_tick >= loop_ticks) {
                stop_groove()
                break
            }

            const t = groove_state.start_time +
                ticks_to_seconds(groove_state.next_tick, bpm, ppq)

            if (t > target) break

            const tick = groove_state.next_tick % loop_ticks
            const events = by_tick.get(tick)
            if (events) {
                for (const e of events) {
                    start_note_at(
                        e.midi,
                        e.vel,
                        t,
                        ticks_to_seconds(e.dur_ticks, bpm, ppq)
                    )
                }
            }

            groove_state.next_tick++
        }
    }, lookahead * 1000)
}

function stop_groove() {
    if (!groove_state) return
    clearInterval(groove_state.timer)
    groove_state = null
}

/* =========================================================
   INIT
========================================================= */

function init_grooves() {
    groove_select.innerHTML = ""
    GROOVES.forEach((g, i) => groove_select.add(new Option(g.name, i)))
    groove_select.value = "0"
    groove_select.addEventListener("change", () => {
        current_groove = GROOVES[parseInt(groove_select.value, 10)]
    })
}

function init_selects() {
    // roots
    for (const n of NOTE_NAMES) {
        const o = document.createElement("option")
        o.value = n
        o.textContent = n
        root_select.appendChild(o)
    }

    // scales
    for (const s of Object.keys(SCALES)) {
        const o = document.createElement("option")
        o.value = s
        o.textContent = s
        scale_select.appendChild(o)
    }

    root_select.value = root_name
    scale_select.value = scale_name

    root_select.addEventListener("change", () => {
        root_name = root_select.value
        build_grid()
    })

    scale_select.addEventListener("change", () => {
        scale_name = scale_select.value
        build_grid()
    })
}

function init() {
    attach_audio_unlock()
    init_selects()
    init_grooves()
    build_grid()
}

init()
