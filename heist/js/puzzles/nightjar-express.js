CaseFiles.register({
    id: "nightjar-express",
    number: "12",
    title: "The Nightjar Express",
    subtitle: "Five crew · five carriages · five stops down the line",
    brief: "The Nightjar runs Ashby, Ridge, Calder, Vane, Kell, in that order, and by the time it reached Kell the mail car was forty pounds lighter than the manifest said. Five of ours were aboard, each in a different carriage, each having climbed on at a different stop. Nobody moved between carriages once the train was rolling. Work out who rode where, and where each of them got on.",
    categories: [
        { id: "crew", label: "Crew", items: ["Della", "Kip", "Mona", "Silas", "Rook"] },
        { id: "carriage", label: "Carriage", items: ["Diner", "Mail", "Sleeper", "Guard", "Lounge"] },
        { id: "boarded", label: "Boarded", items: ["Ashby", "Ridge", "Calder", "Vane", "Kell"] }
    ],
    clues: [
        "Kip was aboard from the very first stop, at Ashby.",
        "Whoever rode in the guard's van climbed on at Calder.",
        "Rook wouldn't go near the guard's van.",
        "Della kept well clear of the lounge car.",
        "The one who settled into the diner car got on at Vane.",
        "Whoever was working the mail car had been aboard since before Della got on.",
        "Rook boarded at an earlier stop than Mona.",
        "Della was already aboard by the time Silas climbed on.",
        "Rook didn't get on at Ridge."
    ],
    solution: {
        "Della": { carriage: "Sleeper", boarded: "Ridge" },
        "Kip": { carriage: "Mail", boarded: "Ashby" },
        "Mona": { carriage: "Lounge", boarded: "Kell" },
        "Silas": { carriage: "Guard", boarded: "Calder" },
        "Rook": { carriage: "Diner", boarded: "Vane" }
    },
    lockedHint: "Fill in the Crew grids above — this panel writes itself once they hold together.",
    verdict: {
        win: {
            tag: "Case Closed",
            text: "Five carriages, five stops, and one mail car nobody can account for. The Nightjar won't be running that route again."
        },
        lose: {
            tag: "Doesn't Hold Up",
            text: "Somebody's in the wrong carriage. The line runs Ashby, Ridge, Calder, Vane, Kell — walk the boarding order again and see who can't have been where you put them."
        }
    }
});
