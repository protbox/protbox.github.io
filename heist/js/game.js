(function(){
    const STEP_MS = 380;
    const VERDICT_GAP = 460;

    const el = {
        boardView: document.getElementById("caseBoard"),
        caseView: document.getElementById("caseView"),
        cards: document.getElementById("caseCards"),
        head: document.querySelector(".case-head"),
        stamp: document.getElementById("caseStamp"),
        title: document.getElementById("caseTitle"),
        subhead: document.getElementById("caseSubhead"),
        brief: document.getElementById("caseBrief"),
        clues: document.getElementById("clueList"),
        grids: document.getElementById("grids"),
        locked: document.getElementById("accusationLocked"),
        panel: document.getElementById("accusationPanel"),
        results: document.getElementById("resultsList"),
        close: document.getElementById("closeBtn"),
        verdict: document.getElementById("verdict"),
        clear: document.getElementById("clearBtn")
    };

    let puzzle = null;
    let signature = "";
    let timers = [];

    function clearTimers(){
        timers.forEach(clearTimeout);
        timers = [];
    }

    function escape(text){
        return String(text).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    }

    function boardSize(item){
        return (item.categories.length - 1) * item.categories[0].items.length;
    }

    function renderCards(){
        el.cards.innerHTML = "";
        CaseFiles.all().forEach(item => {
            const side = boardSize(item);
            const card = document.createElement("a");
            card.className = "case-card";
            card.href = "#" + item.id;

            const pips = [1, 2, 3, 4, 5]
                .map(n => `<span class="pip${item.difficulty >= n ? " on" : ""}"></span>`)
                .join("");

            card.innerHTML = `<span class="pin"></span>` +
                `<span class="card-num">Case ${escape(item.number || "??")}</span>` +
                `<span class="card-title">${escape(item.title)}</span>` +
                `<span class="card-sub">${escape(item.subtitle || "")}</span>` +
                `<span class="card-meta">${side} \u00d7 ${side} board` +
                `<span class="dot">\u00b7</span>${item.clues.length} clues</span>` +
                (item.difficulty ? `<span class="pips">${pips}</span>` : "");
            el.cards.appendChild(card);
        });
    }

    function renderClues(){
        el.clues.innerHTML = puzzle.clues
            .map((clue, index) => `<div class="clue-card" data-n="${index + 1}">${escape(clue)}</div>`)
            .join("");
    }

    function assignment(){
        const others = puzzle.categories.slice(1);
        const links = others.map((cat, offset) => Board.link(0, offset + 1));
        if(links.some(link => !link)) return null;
        return puzzle.categories[0].items.map((_, index) => {
            const row = {};
            others.forEach((cat, k) => { row[cat.id] = links[k][index]; });
            return row;
        });
    }

    function buildResults(rows){
        const anchor = puzzle.categories[0];
        const others = puzzle.categories.slice(1);
        el.results.innerHTML = "";
        anchor.items.forEach((name, index) => {
            const picks = others.map(cat => cat.items[rows[index][cat.id]]);
            const truth = puzzle.solution[name];
            const correct = others.every((cat, k) => truth[cat.id] === picks[k]);

            const row = document.createElement("div");
            row.className = "result-row";
            row.dataset.correct = String(correct);
            row.innerHTML = `<span><span class="who">${escape(name)}</span>` +
                `<span class="what">- ${escape(picks.join(", "))}</span></span>` +
                `<span class="result-icon"></span>`;
            el.results.appendChild(row);
        });
    }

    function resetVerdict(){
        el.results.classList.remove("checking");
        el.verdict.className = "verdict";
        el.verdict.innerHTML = "";
        el.close.disabled = false;
        el.close.textContent = "Make the Call";
    }

    function onBoardChange(){
        const rows = assignment();
        const next = rows ? JSON.stringify(rows) : "locked";
        if(next === signature) return;
        signature = next;
        clearTimers();
        resetVerdict();

        if(!rows){
            el.locked.style.display = "block";
            el.panel.classList.remove("show");
            el.results.innerHTML = "";
            return;
        }
        buildResults(rows);
        el.locked.style.display = "none";
        el.panel.classList.add("show");
    }

    function stamp(row, correct){
        const icon = row.querySelector(".result-icon");
        icon.textContent = correct ? "✅" : "❌";
        row.classList.add("stamped", correct ? "correct" : "wrong");
    }

    function settle(allCorrect){
        const copy = allCorrect ? puzzle.verdict.win : puzzle.verdict.lose;
        el.results.classList.remove("checking");
        el.verdict.className = "verdict show " + (allCorrect ? "correct" : "wrong");
        el.verdict.innerHTML = `<span class="tag">${escape(copy.tag)}</span>${escape(copy.text)}`;
        el.close.disabled = false;
        el.close.textContent = "Make the Call";
    }

    function makeCall(){
        clearTimers();
        const rows = Array.from(el.results.children);
        if(!rows.length) return;

        rows.forEach(row => {
            row.className = "result-row";
            row.querySelector(".result-icon").textContent = "";
        });
        el.results.classList.add("checking");
        el.verdict.className = "verdict";
        el.close.disabled = true;
        el.close.textContent = "Checking…";

        let allCorrect = true;
        rows.forEach((row, index) => {
            const correct = row.dataset.correct === "true";
            if(!correct) allCorrect = false;
            timers.push(setTimeout(() => stamp(row, correct), index * STEP_MS));
        });
        timers.push(setTimeout(() => settle(allCorrect), rows.length * STEP_MS + VERDICT_GAP));
    }

    function showBoard(){
        clearTimers();
        el.caseView.hidden = true;
        el.boardView.hidden = false;
        document.title = "Case Files";
        window.scrollTo(0, 0);
    }

    function route(){
        const id = location.hash.replace("#", "");
        if(!id || id === "board"){
            showBoard();
            return;
        }
        const next = CaseFiles.all().find(item => item.id === id);
        if(!next){
            showBoard();
            return;
        }
        el.boardView.hidden = true;
        el.caseView.hidden = false;
        window.scrollTo(0, 0);
        openCase(next);
    }

    function openCase(next){
        if(puzzle && puzzle.id === next.id) return;

        clearTimers();
        puzzle = next;
        signature = "";

        document.title = `Case File No. ${puzzle.number} - ${puzzle.title}`;
        el.stamp.textContent = `CONFIDENTIAL · CASE ${puzzle.number}`;
        el.title.textContent = puzzle.title;
        el.subhead.textContent = puzzle.subtitle || "";
        el.brief.textContent = puzzle.brief;
        el.locked.textContent = puzzle.lockedHint || "Fill in the grids above - this panel writes itself once they hold together.";

        el.head.classList.remove("swap");
        void el.head.offsetWidth;
        el.head.classList.add("swap");

        renderClues();
        resetVerdict();
        Board.mount(puzzle, el.grids, onBoardChange);
    }

    el.close.addEventListener("click", makeCall);
    el.clear.addEventListener("click", () => Board.clear());
    window.addEventListener("hashchange", route);

    if(!CaseFiles.all().length){
        el.boardView.hidden = true;
        el.caseView.hidden = false;
        el.title.textContent = "No case files loaded";
        el.brief.textContent = "Add a puzzle file under js/puzzles and include it from index.html.";
    } else {
        renderCards();
        route();
    }
})();
