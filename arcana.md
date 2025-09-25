# Arcana - Rules

## TL;DR
Own more spaces on the 3×3 board than your opponent when it fills up.  
Place a card, compare its sides with adjacent cards, flip what you beat, and ride combos if chaining is enabled.

---

## Objective
Control the majority of the 3×3 grid when all slots are filled.

---

## Setup
- **Coin toss** decides who goes first.
- Each card has:
  - **Four sides**: top, right, bottom, left - each with a **type**.
  - A **power** number (1+).
- **First move shield**: the very first card placed this game gets **+1 power**.

---

## Your Turn
1. **Place** a card on any **empty** slot.  
   (Drag and drop; invalid/occupied slots snap your card back.)
2. The placed card **checks** its four neighbours:
   - Up    -> your **top** vs their **bottom**
   - Right -> your **right** vs their **left**
   - Down  -> your **bottom** vs their **top**
   - Left  -> your **left** vs their **right**
3. Apply the result for each neighbour (flip/KO/bonuses) immediately.
4. Turn passes to the opponent (unless chaining rule is active and causes echoes).

---

## How a Check Is Decided

**Types:** `melee`, `fire`, `wind`, `earth`, `water`, `light`, `dark`

### Elemental Ring

```
   Fire → Wind
     ↑       ↓
   Water ← Earth
```

### Special cases
- **Light vs Dark** -> **KO**: both cards are removed from the board.  
  Both players draw a replacement card.
- **Melee**
  - **Loses** to any non-melee type (including light/dark).
  - **Melee vs Melee** -> higher **power** wins.

### Otherwise: Power
If there's no elemental advantage, the higher **power** wins.  
Equal power -> **Draw** (no change).

---

## What Happens on Each Outcome
- **Win** -> the neighbour **flips** to your color.
- **Lose** -> no flip (but see dynamic rules below).
- **Draw** -> nothing happens.
- **KO (Light vs Dark)** -> both removed and both players draw a new card.

---

## Dynamic Rules

- **Line control bonus**
  If you own all **three** cells in any **row or column**, those three cards each gain **+1 power** (triggers once per line per color).

- **Light Bless**  
  If you **win using your Light side**, both:
  - the card you just placed **+1 power**, and
  - the card you flipped **+1 power**.

- **Shadow Punish**  
  If you **lose to a Dark side**, your **attacking (placed) card** loses **1 power** (minimum 1).

- **Melee — Flank Bonus (on placement)**  
  For every **MELEE** side on your placed card that faces a **friendly adjacent card**, gain **+1 power** (default cap **+2** total).  
  *(Neighbour doesn't need to be melee - just friendly.)*

- **Melee — Armor Break (on losing with melee)**  
  If you **attack with a MELEE side** and **lose**, the **defender** loses **1 power** (minimum 1).  
  *(Does not trigger on Light/Dark KO.)*

---

## Chaining Rule
After a flip, the newly flipped card can immediately check **its** neighbours, causing an **echo**. It continues to ripple out until no more matches can be found, or it has hopped a maximum of 3 times.

No more matches are found when:

- The touching sides are **not** identical types, ie: water+water, melee+melee

- The power level is lower

- It has successfully hopped **3** times

---

## End of the Round
When all 9 slots are filled, the side with more owned cards **wins**.  
If equal, it's a **draw**.

---

## Quick Examples

- **Wind vs Earth** (facing sides): Wind **wins** -> opponent flips to you.  
- **Attack into Dark and lose**: your placed card **−1 power** (Shadow Punish).  
- **Win using Light**: your placed card **+1** and the flipped card **+1**.  
- **Tuck a melee card** with two MELEE sides facing two friendlies: **+2 power** on placement (Flank Bonus).  
- **Poke with melee and lose**: defender **−1 power** (Armor Break), setting up your next play.

---

 ​:contentReference[oaicite:0]{index=0}​