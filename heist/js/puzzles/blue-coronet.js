CaseFiles.register({
    id: "blue-coronet",
    number: "15",
    title: "The Blue Coronet",
    subtitle: "Four thieves · four covers · four cabins · one very long corridor",
    brief: "The Blue Coronet runs Paris to Istanbul with eleven paying passengers and rather more staff than it needs. Four of ours were aboard under four different covers, in four different cabins - three, five, seven and nine, in that order down the corridor from the dining car. By Trieste, four things were missing. Nobody was searched, nobody was charged, and everybody got off smiling. Work out who was travelling as what, where they slept, and what they walked off with.",
    categories: [
        { id: "thief", label: "Thief", items: ["Vesna", "Bram", "Lucia", "Odile"] },
        { id: "cover", label: "Cover", items: ["Steward", "Doctor", "Widow", "Priest"] },
        { id: "cabin", label: "Cabin", items: ["3", "5", "7", "9"] },
        { id: "took", label: "Took", items: ["Tiara", "Pearls", "Bonds", "Sable"] }
    ],
    clues: [
        "The steward's jacket was found hanging in cabin three.",
        "The bearer bonds never left cabin three either.",
        "Whoever was travelling as the doctor carried the tiara out in that black bag.",
        "Vesna hasn't the nerve to play doctor.",
        "Vesna wouldn't go near the sable.",
        "Lucia had no use for the sable coat either.",
        "Vesna's cabin came before Lucia's on the way down the corridor.",
        "Odile was billeted nearer the dining car than Vesna.",
        "Vesna in a priest's collar would have fooled nobody.",
        "Odile flatly refuses to wear a uniform."
    ],
    solution: {
        "Vesna": { cover: "Widow", cabin: "7", took: "Pearls" },
        "Bram": { cover: "Steward", cabin: "3", took: "Bonds" },
        "Lucia": { cover: "Doctor", cabin: "9", took: "Tiara" },
        "Odile": { cover: "Priest", cabin: "5", took: "Sable" }
    },
    lockedHint: "Fill in the Thief grids above - this panel writes itself once they hold together.",
    verdict: {
        win: {
            tag: "Case Closed",
            text: "Four covers, four cabins, and four things that never made it to Istanbul. Somewhere past Trieste a widow, a priest, a doctor and a steward all got off at different stations and none of them existed."
        },
        lose: {
            tag: "Doesn't Hold Up",
            text: "One of those four is in the wrong cabin. Start at cabin three - two separate clues point straight at it - and work down the corridor from there."
        }
    }
});
