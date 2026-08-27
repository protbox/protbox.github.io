CaseFiles.register({
    id: "meridian-count",
    number: "09",
    title: "The Meridian Count",
    subtitle: "Casino floor · four crew, four tables, four doors",
    brief: "The count room at the Meridian came up ninety thousand light, and the cameras picked that exact hour to loop. Four of ours were working the floor that night, one table each, and every one of them was out of the building before the alarm finished sounding. Different doors, though. Work out who was where, and which way they went.",
    categories: [
        { id: "crew", label: "Crew", items: ["Odette", "Sal", "Renz", "Ivy"] },
        { id: "table", label: "Table", items: ["Craps", "Poker", "Wheel", "Slots"] },
        { id: "exit", label: "Way Out", items: ["Valet", "Roof", "Lobby", "Kitchen"] }
    ],
    clues: [
        "Whoever was running the wheel went out through the kitchen.",
        "The valet had a car idling for whoever came off the craps table.",
        "Renz left through the kitchen.",
        "Ivy was still crossing the lobby when the alarm went.",
        "Odette has never had the patience for slots.",
        "Nobody had a car waiting on Odette."
    ],
    solution: {
        "Odette": { table: "Poker", exit: "Roof" },
        "Sal": { table: "Craps", exit: "Valet" },
        "Renz": { table: "Wheel", exit: "Kitchen" },
        "Ivy": { table: "Slots", exit: "Lobby" }
    },
    lockedHint: "Fill in the Crew grids above — this panel writes itself once they hold together.",
    verdict: {
        win: {
            tag: "Case Closed",
            text: "Four tables, four doors, and a count room that came up short. Whoever loops those cameras next had better hope you're off the case."
        },
        lose: {
            tag: "Doesn't Hold Up",
            text: "One of those four is standing at the wrong table. Start with the two doors you can name outright and work back from there."
        }
    }
});
