CaseFiles.register({
    id: "kessler-job",
    number: "04",
    title: "The Kessler Job",
    subtitle: "Noir heist · four names, four roles",
    brief: "The Kessler diamond walked out of a fourth-floor vault sometime after midnight. Four names keep coming up - Vivian, Marcus, Dez, and Ruth. The job went off clean, which means everyone's story checks out just a little too well. Figure out who played which role, and what they used to pull it off.",
    categories: [
        { id: "crew", label: "Crew", items: ["Vivian", "Marcus", "Dez", "Ruth"] },
        { id: "role", label: "Role", items: ["Wheel", "Safe", "Inside", "Decoy"] },
        { id: "tool", label: "Tool", items: ["Badge", "Wire", "Key", "Smoke"] }
    ],
    clues: [
        "Ruth can't stand tight spaces - cracking the safe was never on her plate.",
        "Marcus has never picked a lock in his life.",
        "Dez talked his way in through the front door - he wouldn't know a tumbler from a doorknob.",
        "The wheelman handled the cut wire personally. No delegating on a job like this.",
        "Whoever ran the distraction lit the smoke bomb herself.",
        "Dez wasn't behind the wheel that night.",
        "Ruth was born for the spotlight - nothing about her fit a quiet inside job, or a driver's seat.",
        "Vivian wasn't seen anywhere near the front doors. Forging a badge wasn't her play."
    ],
    solution: {
        "Vivian": { role: "Safe", tool: "Key" },
        "Marcus": { role: "Wheel", tool: "Wire" },
        "Dez": { role: "Inside", tool: "Badge" },
        "Ruth": { role: "Decoy", tool: "Smoke" }
    },
    lockedHint: "Solve the Crew grids above - this panel fills itself in once they check out.",
    verdict: {
        win: {
            tag: "Case Closed",
            text: "Every name checks out. The crew's scattered, the take's split, and you've got the whole job on paper."
        },
        lose: {
            tag: "Doesn't Hold Up",
            text: "Somebody on that list is still lying to you. Check the crosses above and run the clues again."
        }
    }
});
