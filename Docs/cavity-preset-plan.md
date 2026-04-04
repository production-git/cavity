## Cavity Detection Preset Implementation
The goal is to implement a new Cavities preset in the MOF Structure Editor which detects enclosed empty spaces bounded by Carbon rings and visualizes them as maximal empty spheres.

## Background & Strategy
According to the design docs, cavities are formed by chains of multiple atoms. The strategy dictates using the Carbon rings (identified by the ring preset) which collectively form these cavities on both faces of the rings. The test model is HKUST_CIF.json, which should yield 7 key cavities: 1 at the center and 6 at the peripherals.

Key Rule (User Provided): "Treat cavities as spheres, that are enclosed volumes of space, containing no atoms inside. After finding cavities using the carbon rings, find the largest sphere that can be created inside the enclosed volume formed by the carbon rings, that does not contain any atoms inside it. These spheres are the cavities, draw the spheres in the UI."

## Proposed Changes
[Component: Application Logic]
[MODIFY] 
app.js
Parameter-Free Cavity Algorithm Execution: Add logic to handle the cavities preset selection. Manual radius settings from the UI are intentionally omitted to keep the experience completely automatic.

- Retrieve all Carbon ring groupings.
Compute the centroid and normal vector for each ring.
Intersection-Based Center Detection: Calculate the shortest-distance intersections (midpoints) among all pairs of ring normal vectors. Where multiple rings face the same internal volume, their normal lines will converge.
- Spatial Clustering: Cluster these intersection points. Centers supported by multiple contributing rings (>= 4) are validated as true cavity centers.
Maximal Empty Sphere Calculation: From each validated cavity center, find the Euclidean distance to the nearest physical atom in the overall framework. This directly establishes the largest possible radius of an empty sphere fitting inside the cavity volume.
Rendering Cavity Spheres:

The traditional string of atom IDs in getAllDrawGroups is not suitable for drawing free-standing spheres.
We will introduce a dynamically managed pseudo-atom array cavitySpheres holding the exact {x, y, z, r} representing the calculated spatial spheres.
In the primary rendering loop (canvas painter's algorithm), these spheres will be z-sorted uniformly with the standard atoms. They will be projected into 2D and rendered as massive, semi-transparent filled circles, creating an intuitive 3D visualization of the enclosed void volume, occluding background geometry appropriately.
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