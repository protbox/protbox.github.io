CaseFiles.register({
    id: "marlowe-street",
    number: "07",
    title: "The Marlowe Street Job",
    subtitle: "Four categories · the long version",
    brief: "Marlowe Street, half past two, and the Continental Trust is four floors of open doors. Everyone got in a different way, everyone had a different job, and everyone left with something - except the one who never got out of the car. Four grids won't be enough for this one.",
    categories: [
        { id: "crew", label: "Crew", items: ["Aurelio", "Franny", "Dutch", "Mira"] },
        { id: "job", label: "Job", items: ["Wheel", "Lookout", "Cracksman", "Forger"] },
        { id: "entry", label: "Way In", items: ["Loading Dock", "Skylight", "Service Lift", "Front Desk"] },
        { id: "take", label: "Take", items: ["Bearer Bonds", "Cash Drawer", "Vault Ledger", "Nothing At All"] }
    ],
    clues: [
        "Whoever took the wheel never got out of the car - the loading dock was as close as they came.",
        "The driver came away empty-handed. That was the arrangement.",
        "Aurelio hasn't driven a getaway since forty-eight.",
        "Mira spent the whole night up on the roof.",
        "The forger walked in the front like they owned the building.",
        "Franny's no good with a safe, and worse behind a wheel.",
        "The bearer bonds left with whoever rode the service lift up.",
        "The lookout came in over the roof and went out with the cash drawer.",
        "The cracksman took the service lift, same as the bonds."
    ],
    solution: {
        "Aurelio": { job: "Cracksman", entry: "Service Lift", take: "Bearer Bonds" },
        "Franny": { job: "Forger", entry: "Front Desk", take: "Vault Ledger" },
        "Dutch": { job: "Wheel", entry: "Loading Dock", take: "Nothing At All" },
        "Mira": { job: "Lookout", entry: "Skylight", take: "Cash Drawer" }
    },
    lockedHint: "Pin down every Crew grid above - the rest of the board fills itself in as you go.",
    verdict: {
        win: {
            tag: "Case Closed",
            text: "Four ways in, four jobs, four sets of hands. Nobody on Marlowe Street gets to be a ghost tonight."
        },
        lose: {
            tag: "Doesn't Hold Up",
            text: "One of those four is standing in the wrong place holding the wrong thing. Start with who never got out of the car."
        }
    }
});
