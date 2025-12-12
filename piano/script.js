/* ------------------ DOM ------------------ */

const keys_nat = document.getElementById("keys_nat")
const keys_acc = document.getElementById("keys_acc")
const display_note = document.getElementById("display_note")
const current_scale = document.getElementById("current_scale")
const root_select = document.getElementById("root_select")
const scale_select = document.getElementById("scale_select")

/* ------------------ CONSTANTS ------------------ */

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

const ROOTS = NOTE_NAMES.map((n, i) => ({
    name: n,
    midi: 36 + i
}))

const SCALES = {
    Ionian:        [2,2,1,2,2,2,1],
    Dorian:        [2,1,2,2,2,1,2],
    Phrygian:      [1,2,2,2,1,2,2],
    Lydian:        [2,2,2,1,2,2,1],
    Mixolydian:    [2,2,1,2,2,1,2],
    Aeolian:       [2,1,2,2,1,2,2],
    HarmonicMinor: [2,1,2,2,1,3,1],
    MelodicMinor:  [2,1,2,2,2,2,1],
    PhrygianDom:   [1,3,1,2,1,2,2],
    MinorBlues:    [3,2,1,1,3,2]
}

/* Your FL-style keyboard layout */
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

const KEY_SIZE = 52
const SPACING = 74   // distance between natural centers

/* ------------------ STATE ------------------ */

let root = ROOTS[0]
let scale_name = "Ionian"
let key_map = {}

const held_keys = new Set()
const visual_by_pc = new Map()

/* ------------------ AUDIO ------------------ */

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

async function play_buffer(midi) {
    if (audio_ctx.state !== "running") {
        await audio_ctx.resume()
    }

    const buf = await get_buffer(midi)
    const src = audio_ctx.createBufferSource()
    src.buffer = buf
    src.connect(master_gain)
    src.start()
}

/* ------------------ MUSIC / MAPPING ------------------ */

function midi_to_name(midi) {
    return NOTE_NAMES[midi % 12]
}

/* Keyboard mapping: */
function build_key_map() {
    key_map = {}

    const r = root.midi
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

    // color stable by pitch class (won’t change when root changes)
    el.style.color = `hsl(${pc_step * 30}, 80%, 60%)`

    visual_by_pc.set(pc_step, el)
    return el
}

function rebuild_visual_keyboard() {
    keys_nat.innerHTML = ""
    keys_acc.innerHTML = ""
    visual_by_pc.clear()

    // Naturals
    NATURALS.forEach(n => {
        const center_x = n.pos * SPACING
        const el = make_circle(n.step, center_x)
        el.addEventListener("mousedown", () => play_note(60 + n.step))
        keys_nat.appendChild(el)
    })

    // Accidentals (between naturals)
    ACCIDENTALS.forEach(a => {
        const center_x = a.pos * SPACING
        const el = make_circle(a.step, center_x)
        el.addEventListener("mousedown", () => play_note(60 + a.step))
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

async function play_note(midi) {
    display_note.textContent = midi_to_name(midi)
    flash_pc(midi)
    await play_buffer(midi)
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
        // visuals DO NOT change / move — that’s intentional
    })

    scale_select.addEventListener("change", e => {
        scale_name = e.target.value
        build_key_map()
        refresh_ui()
    })
}

/* ------------------ INPUT ------------------ */

document.addEventListener("keydown", e => {
    const k = e.key
    if (held_keys.has(k)) return
    if (!key_map[k]) return

    held_keys.add(k)
    play_note(key_map[k])
})

document.addEventListener("keyup", e => {
    held_keys.delete(e.key)
})

/* ------------------ INIT ------------------ */

init_selects()
rebuild_visual_keyboard()
build_key_map()
refresh_ui()
