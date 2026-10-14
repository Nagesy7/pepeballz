# PepeBallz: Cate's Fury

This is an original top-down action RPG built with vanilla JS and canvas. It has no frameworks and no build step.
- **Controls:** WASD/arrows to move, J/Z to attack (3-hit combo) or talk, K/X for Howl Blast, hold L/C to charge, Space/Shift to dash, Q/V to Ascend, Enter for the menu, M to mute. Touch devices get a thumb stick on the left and buttons on the right.
- **Chapter 1:** Pawpaw Village, Whisker Woods and Fang Peak. You collect 7 Wish Orbs, fight Cate (form 1), and summon Pepe the Wish Frog.
- **Inu sprites:** ported from Inu Verse (`src/inu/` is a copy, so Inu Verse itself is untouched).
- **Wish Network (`src/kibble.js`):** SIMULATED $KIBBLE. It includes a weekly seeded orb hunt, a Cate boss rush, rank-based daily/weekly/monthly pools, holder tiers, the Pepe Wish shop (2% fee in millionths), packs and the Kibble Cup, a co-op raid stub and an Inu Verse export stub. Cosmetics only. Bones never cash out. Plug a real wallet in with `setWallet(adapter)`, using the same shape as `SimWallet`.
- **Tests:** `npm test` runs the headless rules, fee and ranking tests. `npm run e2e -- <url>` runs the Playwright checks; screenshots go to `proof/`.
