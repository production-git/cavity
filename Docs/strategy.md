# Strategy: Crystal Structure Viewer (HCUST)

> Date: 2026-04-06
> Source: `/pm-strategy` session — derived from codebase analysis, user feedback, and feature backlog. Updated to reflect architecture-first sequencing decision.
> Related: [3D Presentation App strategy](./3d-presentation-app/strategy.md) (separate product)

---

## Positioning

**Customer:** Chemistry students, MOF/crystal researchers, and materials science educators — people who need to *understand* 3D porous structures, not compute them.

**Category:** Free, zero-install, browser-based 3D crystal structure editor and visualizer.

**Positioning statement:**
> For researchers and students who work with metal-organic frameworks and porous materials, the Crystal Structure Viewer is a free, browser-based editor and visualizer that lets you load, edit, and understand 3D crystal structures without installing anything — unlike VESTA, iRASPA, or Avogadro, which require desktop installs and have steep learning curves.

### Competitive Landscape

| Tool | Gap vs. ours |
|------|-------------|
| VESTA | Desktop, steep learning curve, no browser |
| iRASPA | Mac-only, paid |
| CrystalMaker | Paid, desktop |
| Jmol / 3Dmol.js | Visualization only, no editing |
| Avogadro | Desktop, organic-chemistry-first, not MOF-native |

**Core differentiator:** The only free, zero-install tool where you can *edit* a crystal structure, visualize cavities, and understand topology without expert tooling knowledge.

---

## Problem Statement

MOF researchers and students can't quickly edit and understand 3D crystal structures in a browser — they are forced into heavyweight desktop software (VESTA, Avogadro) with steep learning curves, or stuck with view-only tools that offer no intuition-building.

**What happens today:** Researchers open a CIF in VESTA to inspect one bond, then switch to a paper, then back to VESTA, losing context constantly. Students can only observe — they can't experiment.

**What success looks like:** A student opens a structure in a browser, rotates it, changes a metal node, sees the cavity shrink in real time, and understands the structure-property relationship in 10 minutes — no install.

---

## Explicit Non-Goals

- **No computation** — no DFT calculations; only DFT result *visualization*
- **Not replacing Gaussian/VASP/CASTEP** — we visualize, we don't compute
- **"3D PowerPoint" concept** (user feedback 15–17) is a **separate application** — see [3d-presentation-app/strategy.md](./3d-presentation-app/strategy.md)

---

## Opportunity-Solution Tree

**Goal:** Become the default free browser tool for exploring and editing MOF/crystal structures

```
Goal
├── Opportunity 1: Reduce barriers to structural editing
│   ├── Precision bond/angle editor (type numbers directly)         ← HIGH
│   ├── Smart atom placement + constraint-based snapping            ← HIGH
│   └── Atom grouping + bulk select + duplicate/delete              ← HIGH
│
├── Opportunity 2: Make structures speak for themselves
│   ├── Structural analysis panel (bond stats, coordination #)      ← HIGH
│   ├── Pore characterization (surface area, pore size viz)         ← HIGH
│   └── Layer visibility + group control (show/hide/isolate)        ← HIGH
│
├── Opportunity 3: Enable sharing and teaching
│   ├── Session save/load (file + URL-shareable state)              ← HIGH
│   ├── Animation export (rotation GIF/video)                       ← MEDIUM
│   └── 3D presentation mode                                        ← SEPARATE PRODUCT
│
├── Opportunity 4: Expand beyond HKUST-1
│   ├── CIF export (round-trip with VESTA, iRASPA)                  ← HIGH
│   ├── Molecule library / curated presets                          ← MEDIUM
│   └── Better symmetry expansion UI                                ← MEDIUM
│
└── Opportunity 5: Performance for real research structures
    ├── WebGL renderer (Three.js — true 3D spheres, lighting)       ← HIGH (Phase A — before features)
    ├── Large supercell support (BVH, >5,000 atoms)                 ← HIGH (Phase A + Phase 3)
    └── DFT results visualization (electron density, ESP)           ← HIGH (Phase 4)
```

---

## Strategic Bets

### Bet 1 — Stability (Now · 1–2 weeks)
Fix the foundation UX debt before adding features. Known bugs block current users from trusting the tool.

**What:** JSON import/export sync, phantom axis after atom deletion, snap threshold too large, cluttery tooltips, hardcoded default structure.

**Metric:** All 5 Phase 0 bugs resolved; zero regression on import/export round-trip.

---

### Bet 1.5 — Architecture (Now · 4–6 weeks, parallel tracks)
Replace the Canvas 2D renderer, hit-testing, and document-style UI before building any new features.

**Why now, not later:** The app is not in production. Every Phase 1+ feature (precision editor, bulk select, analysis panels) touches the renderer and UI layout. Building on Canvas 2D means rewriting all of it again after WebGL migration. Zero users means zero migration cost — the window to do this right is now.

**What:**
- WebGL renderer via Three.js — true 3D spheres, real lighting, no sorting artifacts
- BVH spatial index — O(log N) hit testing (required by bulk select anyway)
- Full-bleed glassmorphism UI — floating panels, dark-first, immersive workspace

**Metric:** All existing features pass through Three.js renderer; ≥ 60 fps at default structure; hit test ≤ 2 ms at 5,000 atoms.

**Risk:** This is the highest-risk engineering task. Mitigation: keep Canvas 2D renderer in place until Three.js path passes all existing tests; run UI redesign in parallel (touches only HTML/CSS/ui.js).

---

### Bet 2 — Stickiness (3–6 months)
Close the gap between "interesting toy" and "actually useful for research." Builds on Phase A foundation.

**What:** Precision bond/angle editing, atom grouping, bulk select, scene pan, collapsible panels.

**Why it matters:** Without these, users hit a ceiling quickly — they can view structures but can't reconstruct or iterate on them.

**Metric:** Users can edit a structure to match a target geometry without re-importing a CIF; average session length increases.

---

### Bet 3 — Discovery (6–12 months)
Enable the "aha moment" — make structures explain themselves.

**What:** Structural analysis panel, pore characterization, layer visibility/groups, session save/load, CIF export.

**Metric:** PNG exports and saved sessions per week increase; users loading structures other than HKUST-1.

---

### Bet 4 — Platform (12–18 months)
Become serious competition to desktop tools.

**What:** Animation export, molecule library, large supercell support (>5,000 atoms via InstancedMesh), doping simulation, DFT results visualization.

**Note:** WebGL renderer and BVH are delivered in Bet 1.5 (Phase A) — not this phase. Phase 3/4 features consume that foundation, not build it.

**Metric:** 10+ distinct molecule types visualized per month; tool cited in research contexts.

---

## Key Tradeoffs

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture migration timing | Before feature work (Phase A) | App not in production — zero migration cost; building features on Canvas 2D means rewriting them after WebGL migration |
| "3D PPT" concept (feedback 15–17) | Separate product | Fundamentally different UX — spatial storytelling vs. structure editing |
| Supercell tiling approach | Replace ghost-atom approach with bond-extended tiling | Current approach is visually misleading for large structures (feedback #5) |
| Free forever | Yes | Core differentiator; monetization via institutional licensing later if warranted |
| Zero-dependency browser tool | Maintain | Installing npm/node defeats the purpose for non-technical researchers |
| Computation vs. visualization | Visualization only | No DFT engine; import results from external tools |
