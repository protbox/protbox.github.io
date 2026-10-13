const Desktop = (function () {
    "use strict";

    const T = typeof window !== "undefined" ? window.__TAURI__ : null;
    const desktop = !!(T && T.core && T.dialog);
    const FILTERS = {
        json: [{ name: "fUGE project", extensions: ["json"] }],
        uge: [{ name: "hUGETracker song", extensions: ["uge"] }],
        vgm: [{ name: "VGM sound effect", extensions: ["vgm"] }],
        wav: [{ name: "WAV audio", extensions: ["wav"] }],
        zip: [{ name: "ZIP archive", extensions: ["zip"] }]
    };
    let lastDir = null;

    const baseName = p => String(p).split(/[\\/]/).pop();
    const dirName = p => {
        const s = String(p);
        const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
        return i > 0 ? s.slice(0, i) : null;
    };
    const join = (dir, name) => dir ? dir + (dir.includes("\\") && !dir.includes("/") ? "\\" : "/") + name : name;

    async function bytesOf(data) {
        if (data instanceof Uint8Array) return data;
        if (typeof Blob !== "undefined" && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
        if (typeof data === "string") return new TextEncoder().encode(data);
        return new Uint8Array(data);
    }

    function download(name, data, type) {
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(a.href);
            a.remove();
        }, 1000);
    }

    async function write(path, data) {
        await T.core.invoke("write_file", await bytesOf(data), { headers: { path: encodeURIComponent(path) } });
        lastDir = dirName(path) || lastDir;
        return path;
    }

    async function save(name, data, type) {
        if (!desktop) {
            download(name, data, type);
            return name;
        }
        const ext = name.split(".").pop().toLowerCase();
        const path = await T.dialog.save({ defaultPath: join(lastDir, name), filters: FILTERS[ext] || [] });
        if (!path) return null;
        return write(path, data);
    }

    async function openProject() {
        const path = await T.dialog.open({ multiple: false, directory: false, defaultPath: lastDir || undefined, filters: FILTERS.json });
        if (!path) return null;
        const text = await T.core.invoke("read_text_file", { path });
        lastDir = dirName(path) || lastDir;
        return { path, name: baseName(path), text };
    }

    function ask(message) {
        if (!desktop) return Promise.resolve(window.confirm(message));
        return T.dialog.ask(message, { title: "fUGE", kind: "warning" });
    }

    let title = "";

    function setTitle(t) {
        if (t === title) return;
        title = t;
        if (desktop && T.window) T.window.getCurrentWindow().setTitle(t).catch(() => {});
        else document.title = t;
    }

    function onClose(fn) {
        if (!desktop || !T.window) return;
        T.window.getCurrentWindow().onCloseRequested(async e => {
            if (!(await fn())) e.preventDefault();
        });
    }

    async function openDocs(hash) {
        const url = "docs/index.html" + (hash ? "#" + hash : "");
        if (desktop && T.webviewWindow) {
            try {
                const W = T.webviewWindow.WebviewWindow;
                const open = await W.getByLabel("docs");
                if (open) {
                    await open.setFocus();
                    return;
                }
                new W("docs", { url, title: "fUGE docs", width: 1100, height: 820, center: true });
                return;
            } catch (e) {
                window.open(url, "_blank");
                return;
            }
        }
        window.open(url, "_blank", "noopener");
    }

    return { desktop, save, write, openProject, ask, setTitle, onClose, baseName, openDocs };
})();
