const CaseFiles = (function(){
    const cases = [];

    function faults(puzzle){
        const found = [];
        if(!puzzle || typeof puzzle !== "object") return ["definition is not an object"];
        if(!puzzle.id) found.push("no id");
        if(!puzzle.title) found.push("no title");

        const categories = puzzle.categories || [];
        if(categories.length < 2){
            found.push("needs at least two categories");
            return found;
        }

        const size = categories[0].items.length;
        const ids = new Set();
        categories.forEach(cat => {
            if(!cat.id) found.push("a category has no id");
            if(ids.has(cat.id)) found.push(`duplicate category id "${cat.id}"`);
            ids.add(cat.id);
            if(!Array.isArray(cat.items)) found.push(`category "${cat.id}" has no items`);
            else if(cat.items.length !== size) found.push(`category "${cat.id}" has ${cat.items.length} items, expected ${size}`);
            else if(new Set(cat.items).size !== size) found.push(`category "${cat.id}" repeats an item`);
        });
        if(found.length) return found;

        const anchor = categories[0];
        const others = categories.slice(1);
        const solution = puzzle.solution || {};

        anchor.items.forEach(item => {
            const row = solution[item];
            if(!row){
                found.push(`solution has no entry for "${item}"`);
                return;
            }
            others.forEach(cat => {
                if(!cat.items.includes(row[cat.id])) found.push(`solution for "${item}" has no valid "${cat.id}"`);
            });
        });

        others.forEach(cat => {
            const used = anchor.items.map(item => solution[item] && solution[item][cat.id]);
            if(new Set(used).size !== used.length) found.push(`solution uses a "${cat.id}" value twice`);
        });

        if(!Array.isArray(puzzle.clues) || !puzzle.clues.length) found.push("no clues");

        return found;
    }

    return {
        register(puzzle){
            const problems = faults(puzzle);
            if(problems.length){
                console.error(`Case "${(puzzle && puzzle.id) || "untitled"}" was not loaded:\n  - ${problems.join("\n  - ")}`);
                return;
            }
            cases.push(puzzle);
        },
        all(){
            return cases.slice();
        },
        get(id){
            return cases.find(item => item.id === id) || cases[0] || null;
        }
    };
})();
