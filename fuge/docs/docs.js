(function () {
    "use strict";

    const THEME_KEY = "fuge.theme";
    const root = document.documentElement;

    function stored() {
        try {
            return localStorage.getItem(THEME_KEY);
        } catch (e) {
            return null;
        }
    }

    function setTheme(t) {
        root.dataset.theme = t;
        try {
            localStorage.setItem(THEME_KEY, t);
        } catch (e) {
            return;
        }
    }

    const saved = stored();
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
    if (saved === "slate") root.dataset.theme = "dark";

    document.addEventListener("DOMContentLoaded", () => {
        const links = [...document.querySelectorAll(".nav a[href^='#']")];
        const sections = links.map(a => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
        const text = new Map(sections.map(s => [s.id, s.textContent.toLowerCase()]));

        document.getElementById("theme").addEventListener("click", () => {
            const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
            setTheme(dark ? "light" : "dark");
        });

        const mark = id => links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + id));
        let current = "";
        const spy = () => {
            let best = sections[0];
            for (const s of sections) if (s.getBoundingClientRect().top <= 90) best = s;
            if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) best = sections[sections.length - 1];
            if (best && best.id !== current) {
                current = best.id;
                mark(current);
            }
        };
        document.addEventListener("scroll", spy, { passive: true });
        spy();

        const search = document.getElementById("search");
        const none = document.getElementById("noResults");
        search.addEventListener("input", () => {
            const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
            let shown = 0;
            links.forEach(a => {
                const id = a.getAttribute("href").slice(1);
                const hay = (text.get(id) || "") + " " + a.textContent.toLowerCase();
                const hit = words.every(w => hay.includes(w));
                a.parentElement.hidden = !hit;
                if (hit) shown++;
            });
            document.querySelectorAll(".nav .group").forEach(g => {
                g.hidden = !g.querySelector("li:not([hidden])");
            });
            none.hidden = shown > 0;
        });
        search.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                const first = links.find(a => !a.parentElement.hidden);
                if (first) {
                    location.hash = first.getAttribute("href");
                    document.body.classList.remove("nav-open");
                }
            } else if (e.key === "Escape") {
                search.value = "";
                search.dispatchEvent(new Event("input"));
            }
        });
        document.addEventListener("keydown", e => {
            if (e.key === "/" && document.activeElement !== search) {
                e.preventDefault();
                search.focus();
            }
        });

        document.getElementById("menu").addEventListener("click", () => document.body.classList.toggle("nav-open"));
        links.forEach(a => a.addEventListener("click", () => document.body.classList.remove("nav-open")));
        document.querySelector("main").addEventListener("click", () => document.body.classList.remove("nav-open"));
    });
})();
