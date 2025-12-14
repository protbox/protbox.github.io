/* ------------------ DOM ------------------ */

const keys_nat = document.getElementById("keys_nat")
const keys_acc = document.getElementById("keys_acc")
const display_note = document.getElementById("display_note")
const current_scale = document.getElementById("current_scale")
const root_select = document.getElementById("root_select")
const scale_select = document.getElementById("scale_select")

/* ------------------ CONSTANTS ------------------ */

const MIN_NOTE_DURATION_MS = 40
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

const ROOTS = NOTE_NAMES.map((n, i) => ({
    name: n,
    midi: 36 + i
}))

async function preload_octave(base_midi = 36) {
    const promises = []

    for (let i = 0; i < 12; i++) {
        promises.push(get_buffer(base_midi + i))
    }

    await Promise.all(promises)
}

const SCALES = {
    Ionian:        [2,2,1,2,2,2,1],
    Dorian:        [2,1,2,2,2,1,2],
    Phrygian:      [1,2,2,2,1,2,2],
    Lydian:        [2,2,2,1,2,2,1],
    Mixolydian:    [2,2,1,2,2,1,2],
    Aeolian:       [2,1,2,2,1,2,2],
    Locrian:       [1,2,2,1,2,2,2], 
    HarmonicMinor: [2,1,2,2,1,3,1],
    MelodicMinor:  [2,1,2,2,2,2,1],
    PhrygianDom:   [1,3,1,2,1,2,2],
    MinorBlues:    [3,2,1,1,3,2],
    Chinese:       [4,2,1,4,1],
    Romanian:      [2,1,3,1,2,1,2],
    MajorBeBop:    [2,2,1,2,1,1,2,1],
    MinorBebop:    [2,1,1,1,2,2,1,2]
}

/* FL-style layout */
const KEYBOARD_LAYOUT = [
    'z','x','c','v','b','n','m',',','.','/',
    'a','s','d','f','g','h','j','k','l',';',"'",'#',
    'q','w','e','r','t','y','u','i','o','p','[',']',
    '1','2','3','4','5','6','7','8','9','0','-','='
]

const NATURALS = [
    { name: "C",  step: 0,  pos: 0 },
    { name: "D",  step: 2,  pos: 1 },
    { name: "E",  step: 4,  pos: 2 },
    { name: "F",  step: 5,  pos: 3 },
    { name: "G",  step: 7,  pos: 4 },
    { name: "A",  step: 9,  pos: 5 },
    { name: "B",  step: 11, pos: 6 }
]

const ACCIDENTALS = [
    { name: "C#", step: 1,  pos: 0.5 },
    { name: "D#", step: 3,  pos: 1.5 },
    { name: "F#", step: 6,  pos: 3.5 },
    { name: "G#", step: 8,  pos: 4.5 },
    { name: "A#", step: 10, pos: 5.5 }
]

const CHORD_TYPES = [
    {
        name: "Triad",
        degrees: [0, 2, 4],   // 1 3 5 (9 maybe idk)
        pattern: "[X][ ][X][ ][X]"
    },
    {
        name: "7th",
        degrees: [0, 2, 4, 6],
        pattern: "[X][ ][X][ ][ ][X]"
    },
    {
        name: "Sus2",
        degrees: [0, 1, 4],
        pattern: "[X][X][ ][ ][X]"
    },
    {
        name: "Sus4",
        degrees: [0, 3, 4],
        pattern: "[X][ ][ ][X][X]"
    }
]

const KEY_SIZE = 52
const SPACING = 74   // distance between natural centers

function format_note_with_octave(midi) {
    const name = NOTE_NAMES[midi % 12]
    const octave = Math.floor(midi / 12) - 1

    return `${name}<span class="octave">${octave}</span>`
}

/* ------------------ STATE ------------------ */

let root = ROOTS[0]
let scale_name = "Ionian"
let key_map = {}
let velocity_enabled = false
// recording stuff
let recording = false
let record_start = 0
let events = []
// playback stuff
let is_playing = false
let playback_timeouts = []
let active_sources = new Set()

// chord assist stuff
let chord_assist = false
let chord_index = 0

const held_keys = new Set()
const visual_by_pc = new Map()

document.getElementById("velocity_toggle").addEventListener("change", e => {
    velocity_enabled = e.target.checked
    e.target.blur()
})

// so, this gives notes a more "natural" feel by gradually
// lowering the velocity the higher the frequency
// to the point where you get those light taps at the end of the piano
function velocity_from_key(key) {
    if (!velocity_enabled) return 1.0

    if ("zxcvb".includes(key)) return 1.15
    if ("nm,./".includes(key)) return 1.0

    if ("asdfgh".includes(key)) return 0.9
    if ("jkl;'#".includes(key)) return 0.75

    if ("qwerty".includes(key)) return 0.65
    if ("uiop[]".includes(key)) return 0.55

    if ("12345".includes(key)) return 0.5
    if ("67890-=".includes(key)) return 0.4

    return 0.7
}

function update_chord_hint() {
    const hint = document.getElementById("chord_hint")

    if (!chord_assist) {
        hint.textContent = ""
        return
    }

    const chord = CHORD_TYPES[chord_index]
    hint.innerHTML =
        `<span class="name">${chord.name}</span>` +
        `<span class="pattern">${chord.pattern}</span>`
}

/* ------------------ AUDIO ------------------ */

function get_root_base_midi() {
    const pc = root.midi % 12

    let base = 36 + pc
    return base
}


const audio_ctx = new (window.AudioContext || window.webkitAudioContext)()
const master_gain = audio_ctx.createGain()
master_gain.gain.value = 0.35
master_gain.connect(audio_ctx.destination)

const buffer_cache = {}

async function get_buffer(midi) {
    if (buffer_cache[midi]) return buffer_cache[midi]

    const res = await fetch(`res/${midi}.ogg`)
    const arr = await res.arrayBuffer()
    const buf = await audio_ctx.decodeAudioData(arr)
    buffer_cache[midi] = buf
    return buf
}

async function play_buffer(midi, velocity = 1.0) {
    const src = audio_ctx.createBufferSource()
    src.buffer = buffer_cache[midi]

    const gain = audio_ctx.createGain()
    gain.gain.value = velocity

    src.connect(gain)
    gain.connect(master_gain)

    src.start()
    active_sources.add(src)

    src.onended = () => {
        active_sources.delete(src)
    }
}

function stop_playback() {
    playback_timeouts.forEach(clearTimeout)
    playback_timeouts = []

    active_sources.forEach(src => {
        try { src.stop() } catch {}
    })
    active_sources.clear()

    document
        .querySelectorAll(".key.active")
        .forEach(el => el.classList.remove("active"))

    is_playing = false
    play_btn.textContent = "▶ PLAY"
}

/* ------------------ MUSIC / MAPPING ------------------ */

function midi_to_name(midi) {
    return NOTE_NAMES[midi % 12]
}

/* keyboard mapping: */
function build_key_map() {
    key_map = {}

    const r = get_root_base_midi()

    let note = r
    let scale_ct = 0
    const pattern = SCALES[scale_name]

    KEYBOARD_LAYOUT.forEach((k, idx) => {
        if (k === 'a') {
            note = r + 12
            scale_ct = 0
        } else if (k === 'q') {
            note = r + 24
            scale_ct = 0
        } else if (k === '1') {
            note = r + 36
            scale_ct = 0
        } else if (idx !== 0) {
            note += pattern[scale_ct]
            scale_ct = (scale_ct + 1) % pattern.length
        }

        key_map[k] = note
    })
}

/* ------------------ VISUALS ------------------ */

function make_circle(pc_step, x_px) {
    const el = document.createElement("div")
    el.className = "key"

    // left is based on centers: pos*SPACING, then shift by radius
    const left = Math.round(x_px - KEY_SIZE / 2)
    el.style.left = `${left}px`

    // color stable by pitch class
    el.style.color = `hsl(${pc_step * 30}, 80%, 60%)`

    visual_by_pc.set(pc_step, el)
    return el
}

function rebuild_visual_keyboard() {
    keys_nat.innerHTML = ""
    keys_acc.innerHTML = ""
    visual_by_pc.clear()

    // naturals c-b
    NATURALS.forEach(n => {
        const center_x = n.pos * SPACING
        const el = make_circle(n.step, center_x)
        el.addEventListener("mousedown", () => play_note(36 + n.step))
        keys_nat.appendChild(el)
    })

    // accidentals, ie: flats and sharps
    ACCIDENTALS.forEach(a => {
        const center_x = a.pos * SPACING
        const el = make_circle(a.step, center_x)
        el.addEventListener("mousedown", () => play_note(36 + a.step))
        keys_acc.appendChild(el)
    })
}

function flash_pc(midi) {
    const pc = midi % 12
    const el = visual_by_pc.get(pc)
    if (!el) return

    el.classList.add("active")
    setTimeout(() => el.classList.remove("active"), 120)
}

/* ------------------ PLAY ------------------ */

async function prime_audio() {
    if (audio_ctx.state !== "running") {
        await audio_ctx.resume()
    }
    await preload_octave(36)
}

function play_note(midi, velocity = 1.0) {
    display_note.textContent = ""
    display_note.innerHTML = format_note_with_octave(midi)
    flash_pc(midi)
    play_buffer(midi, velocity)
}

function get_scale_degree_midi(root_midi, degree) {
    const pattern = SCALES[scale_name]
    let midi = root_midi

    for (let i = 0; i < degree; i++) {
        midi += pattern[i % pattern.length]
    }

    return midi
}

function play_scale_chord(root_midi, velocity) {
    const chord = CHORD_TYPES[chord_index]

    chord.degrees.forEach(d => {
        const midi = get_scale_degree_midi(root_midi, d)
        play_note(midi, velocity)
    })
}

/* ------------------ UI ------------------ */

function refresh_ui() {
    current_scale.textContent = `${root.name} ${scale_name}`
}

function init_selects() {
    ROOTS.forEach(r => {
        const o = document.createElement("option")
        o.value = r.name
        o.textContent = r.name
        root_select.appendChild(o)
    })

    Object.keys(SCALES).forEach(s => {
        const o = document.createElement("option")
        o.value = s
        o.textContent = s
        scale_select.appendChild(o)
    })

    root_select.value = root.name
    scale_select.value = scale_name

    root_select.addEventListener("change", e => {
        root = ROOTS.find(r => r.name === e.target.value) || ROOTS[0]
        build_key_map()
        refresh_ui()
        e.target.blur()
    })

    scale_select.addEventListener("change", e => {
        scale_name = e.target.value
        build_key_map()
        refresh_ui()
        e.target.blur()
    })

}

/* ------------------ INPUT ------------------ */

let audio_ready = false

async function preload_all_samples() {
    if (audio_ready) return
    audio_ready = true

    if (audio_ctx.state !== "running") {
        await audio_ctx.resume()
    }

    const promises = []

    for (let midi = 36; midi <= 96; midi++) {
        promises.push(get_buffer(midi))
    }

    await Promise.all(promises)
}

function attach_audio_unlock() {
    const unlock = async () => {
        await preload_all_samples()
        document.removeEventListener("mousedown", unlock)
        document.removeEventListener("keydown", unlock)
        document.removeEventListener("touchstart", unlock)
    }

    document.addEventListener("mousedown", unlock)
    document.addEventListener("keydown", unlock)
    document.addEventListener("touchstart", unlock)
}

attach_audio_unlock()

document.addEventListener("keydown", async e => {
    // check for tab (chord assist stuff)
    if (e.key === "Tab") {
        e.preventDefault()

        if (e.shiftKey) {
            chord_index =
                (chord_index - 1 + CHORD_TYPES.length) % CHORD_TYPES.length
        } else {
            chord_index =
                (chord_index + 1) % CHORD_TYPES.length
        }

        update_chord_hint()
        return
    }

    const k = e.key
    if (held_keys.has(k)) return
    if (!key_map[k]) return

    held_keys.add(k)
    const vel = velocity_from_key(k)
    if (chord_assist) {
        play_scale_chord(key_map[k], vel)
    } else {
        play_note(key_map[k], vel)
    }

    if (recording) {
        events.push({
            type: "on",
            midi: key_map[k],
            time: performance.now() - record_start
        })
    }
})


document.addEventListener("keyup", e => {
    held_keys.delete(e.key)

    if (recording && key_map[e.key]) {
        events.push({
            type: "off",
            midi: key_map[e.key],
            time: performance.now() - record_start
        })
    }
})

const chord_btn = document.getElementById("chord_btn")

chord_btn.onclick = () => {
    chord_assist = !chord_assist
    chord_btn.classList.toggle("active", chord_assist)
    chord_btn.blur()
    update_chord_hint()
}

record_btn.onclick = () => {
    recording = !recording
    record_btn.textContent = recording ? "■ STOP" : "● REC"
    record_btn.classList.toggle("recording", recording)

    if (recording) {
        events = []
        record_start = performance.now()
    }
}


play_btn.onclick = () => {
    if (is_playing) {
        stop_playback()
        return
    }

    if (!events.length) return

    is_playing = true
    play_btn.textContent = "■ STOP"

    events.forEach(ev => {
        const id = setTimeout(() => {
            if (!is_playing) return
            if (ev.type === "on") {
                play_note(ev.midi)
            }
        }, ev.time)

        playback_timeouts.push(id)
    })

    // auto-reset when playback ends
    const last_time = events[events.length - 1].time
    const end_id = setTimeout(() => {
        if (is_playing) stop_playback()
    }, last_time + 50)

    playback_timeouts.push(end_id)
}

// variable length quality helper
function write_vlq(value) {
    value = Math.max(0, Math.floor(value))

    const bytes = [value & 0x7f]
    value >>= 7

    while (value > 0) {
        bytes.unshift((value & 0x7f) | 0x80)
        value >>= 7
    }

    return bytes
}

function tempo_meta_event(bpm) {
    const mpqn = Math.floor(60000000 / bpm)
    return [
        0x00,
        0xFF, 0x51, 0x03,
        (mpqn >> 16) & 0xFF,
        (mpqn >> 8) & 0xFF,
        mpqn & 0xFF
    ]
}

function _download_midi_internal() {
    if (!events.length) return

    const PPQ = 480
    const BPM = 140
    const MS_PER_TICK = (60000 / BPM) / PPQ

    // build a flat event list
    const midi_events = events
        .filter(e => e.midi !== undefined)
        .map(e => ({
            tick: Math.floor(e.time / MS_PER_TICK),
            type: e.type, // "on" | "off"
            midi: e.midi
        }))

    midi_events.sort((a, b) => {
        if (a.tick !== b.tick) return a.tick - b.tick
        if (a.type === b.type) return 0
        return a.type === "off" ? -1 : 1
    })

    // Collapse ultra-short notes
    const note_on_times = new Map()

    const filtered = []

    midi_events.forEach(ev => {
        const key = ev.midi

        if (ev.type === "on") {
            note_on_times.set(key, ev.tick)
            filtered.push(ev)
        } else if (ev.type === "off") {
            const on_tick = note_on_times.get(key)
            if (on_tick !== undefined) {
                const duration = ev.tick - on_tick
                const min_ticks = Math.floor(
                    MIN_NOTE_DURATION_MS / ((60000 / BPM) / PPQ)
                )

                // Clamp tiny notes
                if (duration < min_ticks) {
                    ev.tick = on_tick + min_ticks
                }

                filtered.push(ev)
                note_on_times.delete(key)
            }
        }
    })

    // emit MIDI track
    let track = []

    // Set tempo at start of track
    track.push(...tempo_meta_event(BPM))

    let last_tick = 0

    midi_events.forEach(ev => {
        const delta = Math.max(0, ev.tick - last_tick)
        last_tick = ev.tick

        track.push(...write_vlq(delta))

        if (ev.type === "on") {
            track.push(0x90, ev.midi, 100)
        } else {
            track.push(0x80, ev.midi, 0)
        }
    })

    // end of track
    track.push(0x00, 0xff, 0x2f, 0x00)

    // header
    const header = [
        0x4d,0x54,0x68,0x64,
        0x00,0x00,0x00,0x06,
        0x00,0x00,
        0x00,0x01,
        0x01,0xe0 // 480 PPQ
    ]

    const track_header = [
        0x4d,0x54,0x72,0x6b,
        (track.length >> 24) & 0xff,
        (track.length >> 16) & 0xff,
        (track.length >> 8) & 0xff,
        track.length & 0xff
    ]

    const midi = new Uint8Array([
        ...header,
        ...track_header,
        ...track
    ])

    const blob = new Blob([midi], { type: "audio/midi" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "sketch.mid"
    a.click()
}

function download_midi() {
    // defer heavy work so UI doesn't freeze
    // having said that, I think this problem is resolved without needing to do this
    setTimeout(_download_midi_internal, 0)
}

midi_btn.onclick = download_midi

/* ------------------ INIT ------------------ */

init_selects()
rebuild_visual_keyboard()
build_key_map()
update_chord_hint()
refresh_ui()
