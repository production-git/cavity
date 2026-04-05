## Cavity Detection Preset Implementation

> **Status: COMPLETED** — Implemented across commits `f27adeb` → `061ea71` → `272b846` (2026-04-05)
> Lives in: `state.js:getCavitySpheres()` + `renderer.js` (cavity sphere rendering)

The goal was to implement a new Cavities preset in the MOF Structure Editor which detects enclosed empty spaces bounded by Carbon rings and visualizes them as maximal empty spheres.

## Background & Strategy
According to the design docs, cavities are formed by chains of multiple atoms. The strategy dictates using the Carbon rings (identified by the ring preset) which collectively form these cavities on both faces of the rings. The test model is HKUST_CIF.json, which should yield 7 key cavities: 1 at the center and 6 at the peripherals.

Key Rule (User Provided): "Treat cavities as spheres, that are enclosed volumes of space, containing no atoms inside. After finding cavities using the carbon rings, find the largest sphere that can be created inside the enclosed volume formed by the carbon rings, that does not contain any atoms inside it. These spheres are the cavities, draw the spheres in the UI."

## Proposed Changes
[Component: Application Logic]
[MODIFY] 
app.js
Parameter-Free Cavity Algorithm Execution: Add logic to handle the cavities preset selection. Manual radius settings from the UI are intentionally omitted to keep the experience completely automatic.

- Find all Carbon rings.
- Calculate 2 normal vectors from each ring (one for each face).
- Group the vectors that are converging together.
- A cluster of 4 or more converging normal vectors forms an approximate convergence point.
- This convergence point becomes the center of a cavity.
- Calculate the largest sphere from this center such that no atom is inside the sphere.
- Rendering Cavity Spheres:
    - The traditional string of atom IDs in `getAllDrawGroups` is not used.
    - We utilize a dynamic array `cavitySpheres` holding the calculated `{x, y, z, r}`.
    - In the primary rendering loop, these spheres are z-sorted alongside standard atoms and rendered as large, semi-transparent filled circles.
[Component: UI Layout]
[MODIFY] 
index.html
- Preset UI: Add a new selection button/toggle for the 'Cavities' preset in the preset tool panel. No additional inputs or toggles are required!

## Open Questions
No open questions. The implementation utilizes a fully automatic, parameter-free strategy that seamlessly derives the maximal radius for generic volumes.

## Verification Plan
Automated Tests
N/A - The current project does not utilize an automated test suite.
Manual Verification
Open HKUST_CIF.json in the web application using the test script.
Select the Cavities preset.
Visually verify exactly 7 spheres are drawn (1 central, 6 peripheral).
Ensure the spheres represent purely empty space (not engulfing structural atoms like Cu or O) and naturally expand perfectly to touch the bounding Carbon rings.