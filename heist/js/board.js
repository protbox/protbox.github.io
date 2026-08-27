const Board = (function(){
    const HOLD_MS = 520;
    const RING_DELAY = 140;
    const POP_MS = 400;

    let model = null;
    let hold = null;
    let frame = 0;

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
            model.cells[key].forEach((row, r) => {
                row.forEach((td, c) => {
                    const spot = view[r][c];
                    const mark = td.firstChild;
                    mark.className = spot.auto ? "mark auto" : "mark";
                    mark.textContent = spot.value === 1 ? "❌" : spot.value === 2 ? "✅" : "";
                });
            });
            model.blocks[key].classList.toggle("locked", Boolean(model.derived[key]));
        });
    }

    function update(){
        recompute();
        paint();
        if(model.onChange) model.onChange();
    }

    function buildBlock(i, j){
        const rows = model.puzzle.categories[i];
        const cols = model.puzzle.categories[j];
        const key = pairKey(i, j);

        const block = document.createElement("div");
        block.className = "grid-block";

        const title = document.createElement("div");
        title.className = "grid-title";

        const label = document.createElement("span");
        label.innerHTML = `${rows.label} <b>×</b> ${cols.label}`;
        title.appendChild(label);

        const badge = document.createElement("span");
        badge.className = "auto-badge";
        badge.textContent = "✓ Deduced";
        title.appendChild(badge);

        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "reset-link";
        reset.textContent = "Reset";
        reset.addEventListener("click", () => {
            model.marks[key] = emptyGrid(rows.items.length);
            update();
        });
        title.appendChild(reset);

        const table = document.createElement("table");
        table.className = "logic-grid";

        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        const corner = document.createElement("th");
        corner.className = "corner";
        headRow.appendChild(corner);
        cols.items.forEach(name => {
            const th = document.createElement("th");
            th.scope = "col";
            th.textContent = name;
            headRow.appendChild(th);
        });
        head.appendChild(headRow);

        const body = document.createElement("tbody");

        const cells = [];
        rows.items.forEach((name, r) => {
            const tr = document.createElement("tr");
            const rowHead = document.createElement("td");
            rowHead.className = "rowhead";
            rowHead.textContent = name;
            tr.appendChild(rowHead);

            const line = [];
            cols.items.forEach((_, c) => {
                const td = document.createElement("td");
                td.className = "cell";
                td.dataset.key = key;
                td.dataset.r = r;
                td.dataset.c = c;

                const mark = document.createElement("span");
                mark.className = "mark";
                const charge = document.createElement("span");
                charge.className = "charge";
                td.appendChild(mark);
                td.appendChild(charge);

                tr.appendChild(td);
                line.push(td);
            });
            cells.push(line);
            body.appendChild(tr);
        });

        table.appendChild(head);
        table.appendChild(body);
        block.appendChild(title);
        block.appendChild(table);

        model.blocks[key] = block;
        model.cells[key] = cells;
        model.container.appendChild(block);
    }

    function locate(target){
        const td = target && target.closest ? target.closest(".cell") : null;
        if(!td || !model) return null;
        const key = td.dataset.key;
        if(model.derived[key]) return null;
        return { td: td, key: key, r: Number(td.dataset.r), c: Number(td.dataset.c) };
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
                blocks: {},
                cells: {}
            };
            const count = puzzle.categories.length;
            const size = puzzle.categories[0].items.length;
            for(let i = 0; i < count; i++){
                for(let j = i + 1; j < count; j++){
                    model.marks[pairKey(i, j)] = emptyGrid(size);
                    buildBlock(i, j);
                }
            }
            update();
        },
        link(a, b){
            if(!model) return null;
            return relation(model.maps, a, b);
        }
    };
})();
