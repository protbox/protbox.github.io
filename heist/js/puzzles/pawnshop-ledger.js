CaseFiles.register({
    id: "pawnshop-ledger",
    number: "01",
    title: "The Pawnshop Ledger",
    subtitle: "Four sellers · one night · one crooked ledger",
    brief: "Somebody fenced the Ashcroft haul through a pawnshop on Dane Street, and the owner kept a ledger — right up until the page went missing. Four sellers came through that night, one item each, an hour apart. The times are on the wall clock, the names are in your notebook, and the rest is up to you.",
    categories: [
        { id: "seller", label: "Seller", items: ["Nadia", "Cal", "Ivor", "Pearl"] },
        { id: "item", label: "Item", items: ["Pocket Watch", "Opera Glasses", "Silver Lighter", "Jade Ring"] },
        { id: "time", label: "Time", items: ["9:00", "10:00", "11:00", "Midnight"] }
    ],
    clues: [
        "Cal was first through the door — nine o'clock, on the dot.",
        "The opera glasses hit the counter exactly one hour after the silver lighter.",
        "The pocket watch came in later in the night than the jade ring.",
        "The jade ring wasn't the last thing written down.",
        "Ivor turned up some time after Nadia had already been and gone.",
        "Cal wouldn't know jade from bottle glass.",
        "Nadia's line on the ledger reads eleven o'clock."
    ],
    solution: {
        "Nadia": { item: "Jade Ring", time: "11:00" },
        "Cal": { item: "Silver Lighter", time: "9:00" },
        "Ivor": { item: "Pocket Watch", time: "Midnight" },
        "Pearl": { item: "Opera Glasses", time: "10:00" }
    },
    lockedHint: "Fill in the Seller grids above — this panel writes itself once they hold together.",
    verdict: {
        win: {
            tag: "Case Closed",
            text: "That's the page, rebuilt from nothing. Four names, four items, four times, and a fence who's about to have a very long morning."
        },
        lose: {
            tag: "Doesn't Hold Up",
            text: "At least one line on that ledger is wrong, and a wrong ledger is worse than no ledger. Run the clock times again."
        }
    }
});
