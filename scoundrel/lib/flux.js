// based on rxi's lua flux library

const easing = {
    linear: p => p,

    quadin: p => p * p,
    quadout: p => 1 - (1 - p) * (1 - p),
    quadinout: p => p < 0.5
        ? 2 * p * p
        : 1 - Math.pow(-2 * p + 2, 2) / 2,

    cubicin: p => p * p * p,
    cubicout: p => 1 - Math.pow(1 - p, 3),
    cubicinout: p => p < 0.5
        ? 4 * p * p * p
        : 1 - Math.pow(-2 * p + 2, 3) / 2,

    quartin: p => p * p * p * p,
    quartout: p => 1 - Math.pow(1 - p, 4),
    quartinout: p => p < 0.5
        ? 8 * p * p * p * p
        : 1 - Math.pow(-2 * p + 2, 4) / 2,

    quintin: p => p * p * p * p * p,
    quintout: p => 1 - Math.pow(1 - p, 5),
    quintinout: p => p < 0.5
        ? 16 * p * p * p * p * p
        : 1 - Math.pow(-2 * p + 2, 5) / 2,

    sinein: p => 1 - Math.cos((p * Math.PI) / 2),
    sineout: p => Math.sin((p * Math.PI) / 2),
    sineinout: p => -(Math.cos(Math.PI * p) - 1) / 2,

    backin: p => p * p * (2.7 * p - 1.7),
    backout: p => {
        const x = p - 1;
        return 1 + x * x * (2.7 * x + 1.7);
    },
    backinout: p => p < 0.5
        ? (Math.pow(2 * p, 2) * (3.5949095 * 2 * p - 2.5949095)) / 2
        : (Math.pow(2 * p - 2, 2) * (3.5949095 * (p * 2 - 2) + 2.5949095) + 2) / 2,
};

class Tween {
    constructor(obj, time, vars) {
        this.obj = obj;
        this.rate = time > 0 ? 1 / time : 0;
        this.progress = time > 0 ? 0 : 1;
        this._delay = 0;
        this._ease = "quadout";
        this.vars = {};
        this.inited = false;

        for (const k in vars) {
            if (typeof vars[k] !== "number") {
                throw new Error(`bad value for key '${k}'; expected number`);
            }
            this.vars[k] = vars[k];
        }
    }

    ease(name) {
        if (!easing[name]) {
            throw new Error(`bad easing type '${name}'`);
        }
        this._ease = name;
        return this;
    }

    delay(t) {
        if (typeof t !== "number") {
            throw new Error("bad delay time; expected number");
        }
        this._delay = t;
        return this;
    }

    onstart(fn) {
        this._onstart = this._onstart
            ? () => { this._onstart(); fn(); }
            : fn;
        return this;
    }

    onupdate(fn) {
        this._onupdate = this._onupdate
            ? () => { this._onupdate(); fn(); }
            : fn;
        return this;
    }

    oncomplete(fn) {
        this._oncomplete = this._oncomplete
            ? () => { this._oncomplete(); fn(); }
            : fn;
        return this;
    }

    init() {
        for (const k in this.vars) {
            const x = this.obj[k];
            if (typeof x !== "number") {
                throw new Error(`bad value on object key '${k}'; expected number`);
            }
            this.vars[k] = {
                start: x,
                diff: this.vars[k] - x,
            };
        }
        this.inited = true;
    }

    after(obj, time, vars) {
        const t = vars
            ? new Tween(obj, time, vars)
            : new Tween(this.obj, obj, time);

        t.parent = this.parent;
        this.oncomplete(() => this.parent.add(t));
        return t;
    }

    stop() {
        this.parent.remove(this);
    }
}

class FluxGroup {
    constructor() {
        this.list = [];
        this.map = new Map();
    }

    to(obj, time, vars) {
        return this.add(new Tween(obj, time, vars));
    }

    add(tween) {
        const obj = tween.obj;
        if (!this.map.has(obj)) {
            this.map.set(obj, new Set());
        }
        this.map.get(obj).add(tween);
        this.list.push(tween);
        tween.parent = this;
        return tween;
    }

    remove(x) {
        let i = typeof x === "number" ? x : this.list.indexOf(x);
        if (i < 0) return;

        const t = this.list[i];
        const set = this.map.get(t.obj);
        set.delete(t);
        if (set.size === 0) this.map.delete(t.obj);

        const last = this.list.pop();
        if (i < this.list.length) this.list[i] = last;
    }

    clear(obj, vars) {
        const set = this.map.get(obj);
        if (!set) return;
        for (const t of set) {
            if (t.inited) {
                for (const k in vars) {
                    delete t.vars[k];
                }
            }
        }
    }

    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const t = this.list[i];

            if (t._delay > 0) {
                t._delay -= dt;
                continue;
            }

            if (!t.inited) {
                this.clear(t.obj, t.vars);
                t.init();
            }

            if (t._onstart) {
                t._onstart();
                t._onstart = null;
            }

            t.progress += t.rate * dt;
            const p = t.progress;
            const x = p >= 1 ? 1 : easing[t._ease](p);

            for (const k in t.vars) {
                const v = t.vars[k];
                t.obj[k] = v.start + x * v.diff;
            }

            if (t._onupdate) t._onupdate();

            if (p >= 1) {
                this.remove(i);
                if (t._oncomplete) t._oncomplete();
            }
        }
    }
}

const tweens = new FluxGroup();

export const flux = {
    easing,
    tweens,
    to: (...args) => tweens.to(...args),
    update: dt => tweens.update(dt),
    remove: x => tweens.remove(x),
    group: () => new FluxGroup(),
};
