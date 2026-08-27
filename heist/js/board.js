const Board = (function(){
    const HOLD_MS = 520;
    const RING_DELAY = 140;
    const POP_MS = 400;

    let model = null;
    let hold = null;
    let frame = 0;
    let hovered = null;

    function pairKey(a, b){
        return a + ":" + b;
    }

    function emptyGrid(size){
        return Array.from({ length: size }, () => new Array(size).fill(0));
    }

    function project(marks){
        const size = marks.length;
        const view = marks.map(row => row.map(value => ({ value: value, auto: false })));
        for(let r = 0; r < size; r++){
            for(let c = 0; c < size; c++){
                if(marks[r][c] !== 2) continue;
                for(let i = 0; i < size; i++){
                    if(i !== c && view[r][i].value === 0) view[r][i] = { value: 1, auto: true };
                    if(i !== r && view[i][c].value === 0) view[i][c] = { value: 1, auto: true };
                }
            }
        }
        return view;
    }

    function mappingOf(view){
        const size = view.length;
        const map = new Array(size).fill(-1);
        const taken = new Set();
        for(let r = 0; r < size; r++){
            let found = -1;
            for(let c = 0; c < size; c++){
                if(view[r][c].value !== 2) continue;
                if(found !== -1) return null;
                found = c;
            }
            if(found === -1 || taken.has(found)) return null;
            taken.add(found);
            map[r] = found;
        }
        return map;
    }

    function viewFromMapping(map){
        const size = map.length;
        return map.map(target => Array.from({ length: size }, (_, c) => ({ value: c === target ? 2 : 1, auto: true })));
    }

    function relation(maps, a, b){
        if(a === b) return null;
        if(a < b) return maps[pairKey(a, b)] || null;
        const inverse = maps[pairKey(b, a)];
        if(!inverse) return null;
        const out = new Array(inverse.length);
        inverse.forEach((value, index) => { out[value] = index; });
        return out;
    }

    function recompute(){
        const count = model.puzzle.categories.length;
        const view = {};
        const maps = {};
        const derived = {};

        for(let i = 0; i < count; i++){
            for(let j = i + 1; j < count; j++){
                const key = pairKey(i, j);
                view[key] = project(model.marks[key]);
                maps[key] = mappingOf(view[key]);
            }
        }

        let progressed = true;
        while(progressed){
            progressed = false;
            for(let i = 0; i < count; i++){
                for(let j = i + 1; j < count; j++){
                    const key = pairKey(i, j);
                    if(maps[key]) continue;
                    for(let k = 0; k < count; k++){
                        if(k === i || k === j) continue;
                        const first = relation(maps, i, k);
                        const second = relation(maps, k, j);
                        if(!first || !second) continue;
                        const combined = first.map(step => second[step]);
                        view[key] = viewFromMapping(combined);
                        maps[key] = combined;
                        derived[key] = true;
                        progressed = true;
                        break;
                    }
                }
            }
        }

        model.view = view;
        model.maps = maps;
        model.derived = derived;
    }

    function paint(){
        Object.keys(model.cells).forEach(key => {
            const view = model.view[key];
            const derived = Boolean(model.derived[key]);
            model.cells[key].forEach((row, r) => {
                row.forEach((td, c) => {
                    const spot = view[r][c];
                    const mark = td.firstChild;
                    td.classList.toggle("derived", derived);
                    mark.className = spot.auto ? "mark auto" : "mark";
                    mark.textContent = spot.value === 1 ? "❌" : spot.value === 2 ? "✅" : "";
                });
            });
        });
    }

    function update(){
        recompute();
        paint();
        if(model.onChange) model.onChange();
    }

    function makeCell(key, r, c, bandStart, tr, tc){
        const td = document.createElement("td");
        td.className = bandStart ? "cell band-start" : "cell";
        td.dataset.key = key;
        td.dataset.r = r;
        td.dataset.c = c;
        td.dataset.tr = tr;
        td.dataset.tc = tc;
        (model.byRow[tr] = model.byRow[tr] || []).push(td);
        (model.byCol[tc] = model.byCol[tc] || []).push(td);

        const mark = document.createElement("span");
        mark.className = "mark";
        const charge = document.createElement("span");
        charge.className = "charge";
        td.appendChild(mark);
        td.appendChild(charge);
        return td;
    }

    function buildBoard(){
        const cats = model.puzzle.categories;
        const count = cats.length;
        const size = cats[0].items.length;

        const table = document.createElement("table");
        table.className = "staircase";

        const head = document.createElement("thead");
        const bandRow = document.createElement("tr");
        const corner = document.createElement("th");
        corner.className = "corner";
        corner.colSpan = 2;
        corner.rowSpan = 2;
        bandRow.appendChild(corner);

        for(let j = 1; j < count; j++){
            const th = document.createElement("th");
            th.className = "band band-start";
            th.colSpan = size;
            th.textContent = cats[j].label;
            bandRow.appendChild(th);
        }
        head.appendChild(bandRow);

        const itemRow = document.createElement("tr");
        for(let j = 1; j < count; j++){
            cats[j].items.forEach((name, index) => {
                const th = document.createElement("th");
                th.className = index === 0 ? "colhead band-start" : "colhead";
                th.scope = "col";
                th.textContent = name;
                model.colHeads[(j - 1) * size + index] = th;
                itemRow.appendChild(th);
            });
        }
        head.appendChild(itemRow);
        table.appendChild(head);

        const body = document.createElement("tbody");
        for(let i = 0; i < count - 1; i++){
            cats[i].items.forEach((rowName, r) => {
                const tr = document.createElement("tr");
                if(r === 0) tr.className = "band-start";

                if(r === 0){
                    const side = document.createElement("th");
                    side.className = "band side";
                    side.rowSpan = size;
                    const label = document.createElement("span");
                    label.textContent = cats[i].label;
                    side.appendChild(label);
                    tr.appendChild(side);
                }

                const rowHead = document.createElement("th");
                rowHead.className = "rowhead";
                rowHead.scope = "row";
                rowHead.textContent = rowName;
                model.rowHeads[i * size + r] = rowHead;
                tr.appendChild(rowHead);

                for(let j = 1; j < count; j++){
                    if(j <= i){
                        if(r !== 0) continue;
                        const gap = document.createElement("td");
                        gap.className = "void";
                        gap.colSpan = size;
                        gap.rowSpan = size;
                        tr.appendChild(gap);
                        continue;
                    }
                    const key = pairKey(i, j);
                    if(!model.cells[key]) model.cells[key] = [];
                    const line = [];
                    for(let c = 0; c < size; c++){
                        const td = makeCell(key, r, c, c === 0, i * size + r, (j - 1) * size + c);
                        tr.appendChild(td);
                        line.push(td);
                    }
                    model.cells[key][r] = line;
                }
                body.appendChild(tr);
            });
        }

        table.appendChild(body);
        model.container.appendChild(table);
    }

    function locate(target){
        const td = target && target.closest ? target.closest(".cell") : null;
        if(!td || !model) return null;
        const key = td.dataset.key;
        if(model.derived[key]) return null;
        return { td: td, key: key, r: Number(td.dataset.r), c: Number(td.dataset.c) };
    }

    function unlight(){
        if(!model) return;
        model.lit.forEach(node => node.classList.remove("lit"));
        model.lit = [];
        hovered = null;
    }

    function light(td){
        if(td === hovered) return;
        unlight();
        if(!td || !model) return;
        hovered = td;
        const tr = Number(td.dataset.tr);
        const tc = Number(td.dataset.tc);
        model.lit = []
            .concat(model.byRow[tr] || [], model.byCol[tc] || [])
            .concat([model.rowHeads[tr], model.colHeads[tc]])
            .filter(Boolean);
        model.lit.forEach(node => node.classList.add("lit"));
    }

    function endHold(){
        cancelAnimationFrame(frame);
        if(!hold) return;
        hold.td.classList.remove("charging", "clearing");
        hold.td.style.removeProperty("--charge");
        hold = null;
    }

    function tick(){
        if(!hold) return;
        const elapsed = performance.now() - hold.start;
        if(elapsed > RING_DELAY){
            hold.td.classList.add("charging");
            if(hold.clearing) hold.td.classList.add("clearing");
        }
        const progress = Math.min(1, Math.max(0, (elapsed - RING_DELAY) / HOLD_MS));
        hold.td.style.setProperty("--charge", progress.toFixed(3));
        if(progress >= 1){
            const target = hold;
            endHold();
            seal(target);
            return;
        }
        frame = requestAnimationFrame(tick);
    }

    function seal(target){
        const grid = model.marks[target.key];
        const filling = grid[target.r][target.c] !== 2;
        grid[target.r][target.c] = filling ? 2 : 0;
        update();
        if(!filling) return;
        target.td.classList.add("pop");
        setTimeout(() => target.td.classList.remove("pop"), POP_MS);
    }

    function cross(target){
        const grid = model.marks[target.key];
        if(grid[target.r][target.c] === 2) return;
        grid[target.r][target.c] = grid[target.r][target.c] === 1 ? 0 : 1;
        update();
    }

    function onDown(event){
        if(event.button !== 0) return;
        const target = locate(event.target);
        if(!target) return;
        event.preventDefault();
        endHold();
        hold = target;
        hold.start = performance.now();
        hold.clearing = model.marks[target.key][target.r][target.c] === 2;
        frame = requestAnimationFrame(tick);
    }

    function onMove(event){
        if(!hold) return;
        const over = document.elementFromPoint(event.clientX, event.clientY);
        if(!over || !over.closest || over.closest(".cell") !== hold.td) endHold();
    }

    function onUp(){
        if(!hold) return;
        const target = hold;
        endHold();
        cross(target);
    }

    function onContext(event){
        const target = locate(event.target);
        if(!target) return;
        event.preventDefault();
        endHold();
        model.marks[target.key][target.r][target.c] = 0;
        update();
    }

    document.addEventListener("pointerover", event => {
        if(!model) return;
        light(event.target && event.target.closest ? event.target.closest(".cell") : null);
    });
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", endHold);
    document.addEventListener("contextmenu", onContext);
    window.addEventListener("blur", endHold);

    return {
        mount(puzzle, container, onChange){
            endHold();
            container.innerHTML = "";
            model = {
                puzzle: puzzle,
                container: container,
                onChange: onChange,
                marks: {},
                view: {},
                maps: {},
                derived: {},
                cells: {},
                byRow: {},
                byCol: {},
                rowHeads: {},
                colHeads: {},
                lit: []
            };
            hovered = null;
            const count = puzzle.categories.length;
            const size = puzzle.categories[0].items.length;
            for(let i = 0; i < count; i++){
                for(let j = i + 1; j < count; j++){
                    model.marks[pairKey(i, j)] = emptyGrid(size);
                }
            }
            buildBoard();
            update();
        },
        clear(){
            if(!model) return;
            const size = model.puzzle.categories[0].items.length;
            Object.keys(model.marks).forEach(key => { model.marks[key] = emptyGrid(size); });
            update();
        },
        link(a, b){
            if(!model) return null;
            return relation(model.maps, a, b);
        }
    };
})();
