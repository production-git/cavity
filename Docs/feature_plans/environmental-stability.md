# Feature Plan: Environmental Stability Visualization

> Status: Planned
> Priority: High
> Phase: 3
> Depends on: [doping-simulation.md](./doping-simulation.md) (for doping-stability comparison)

---

## User Story

> "I am a researcher working on improving MOF (HKUST-1) stability by introducing other metals [doping]. I want to visualize how water, heat, and biological environments affect the structure."

---

## Problem

HKUST-1 is one of the highest surface-area MOFs ever reported, but its practical application is severely limited by poor stability:

- **Water/humidity**: Exposure causes rapid framework collapse. Water molecules compete with carboxylate oxygens for Cu coordination, breaking Cu–O bonds and destroying the paddlewheel node.
- **Thermal degradation**: Above ~240 °C, coordinated and lattice water is lost; above ~300 °C, the organic linker begins to decompose. Bond stress accumulates unevenly through the structure.
- **Biological/physiological environments**: At physiological pH (~7.4), carboxylate protonation is minimal, but in acidic environments (lysosomal pH ~5, tumour microenvironment pH ~6.5) the Cu–O bonds weaken. Cu²⁺ ion release is toxic to cells; this is both a concern for biomedical use and an opportunity for antimicrobial applications.

Doping (replacing Cu with Fe, Zn, Co, Cr, Zr) is a primary strategy for improving stability across all three dimensions. A visual tool that overlays predicted vulnerability onto the 3D structure — and lets the researcher instantly see how a doped site changes the local stability picture — would directly support the hypothesis-generation stage of materials engineering research.

---

## Goals

- Overlay a **stability heatmap** on bonds and atoms based on selected environmental stressor (water, heat, pH/biology)
- Visualize **water attack** at the Cu paddlewheel node: show water molecule approach geometry, competing coordination sites
- Animate a **simplified degradation pathway** (qualitative, not DFT-accurate)
- Show how **doping changes the stability profile** at each substituted node
- Remain fully client-side and qualitative — this is a visualization and communication tool, not a simulation engine

---

## Non-Goals

- Quantitative thermodynamic or kinetic calculations
- Force-field molecular dynamics
- Accurate quantum mechanical modelling

---

## Proposed Design

### Overview: Stability Panel

A collapsible panel in the inspector with three tabbed stressors:

```
┌─────────────────────────────────────────┐
│  Stability Analysis                     │
│  [Water]  [Thermal]  [Biological]       │
├─────────────────────────────────────────┤
│  (stressor-specific controls)           │
│  [Show Heatmap]  [Animate]              │
└─────────────────────────────────────────┘
```

Activating the heatmap overlays colour-coded vulnerability onto the live structure. It is independent of (and composable with) the existing Plane presets — both can be active simultaneously.

---

### Stressor 1: Water Stability

#### Mechanism Visualized

Water attacks the axial coordination sites of the Cu paddlewheel. Each Cu in the paddlewheel has one open axial site (where a solvent molecule or guest sits in the as-synthesised structure). Water coordinates there and weakens the equatorial Cu–O carboxylate bonds by pulling electron density toward the axial water.

The framework collapse sequence:
1. H₂O approaches axial Cu site (Cu coordination number: 4 → 5)
2. Equatorial Cu–O (carboxylate) bond elongates
3. Cu–O bond breaks; carboxylate "slips" off Cu
4. Paddlewheel node destabilises; linked linkers detach
5. Framework collapses

#### Vulnerability Scoring

Each atom and bond is assigned a **water vulnerability score** (0 = stable, 1 = highly vulnerable) based on topology:

| Atom/Bond | Vulnerability | Rationale |
|-----------|--------------|-----------|
| Cu nodes | 0.90 | Direct water coordination site |
| O_bridge (Cu–O bond) | 0.80 | First bond broken in water attack |
| Cu–O bond | 0.80 | Breaks upon water coordination |
| O_term | 0.20 | Terminal, partially shielded |
| C_carb, C_arom | 0.05 | Organic backbone, not directly attacked |
| H | 0.05 | Spectator |

For **doped nodes** (from the doping simulation feature): the vulnerability score is adjusted per the substituted metal's known water stability rank:

| Metal | Relative water stability | Score modifier |
|-------|--------------------------|----------------|
| Zr | Very high (zirconium carboxylates) | −0.60 |
| Cr | High | −0.40 |
| Fe | Moderate-high | −0.25 |
| Co | Moderate | −0.15 |
| Zn | Moderate-low | +0.10 |
| Cu | Baseline | ±0.00 |

A doped Fe node shows a distinctly greener (more stable) colour in the heatmap, giving the researcher immediate visual feedback on whether their doping strategy improves water stability.

#### Water Attack Animation

A step-by-step guided animation (play/pause/step controls):

1. **Step 0** — Pristine structure; water molecule (H₂O ghost) appears above the axial Cu site
2. **Step 1** — Water approaches Cu: ghost molecule animates from 3.5 Å to 2.2 Å (Cu–O coordination distance), Cu–O_water bond dashes into view
3. **Step 2** — Equatorial Cu–O bond highlighted in red, length annotation shows elongation (+0.15 Å marker)
4. **Step 3** — Cu–O bond shown as broken (bond removed, gap highlighted), carboxylate fragment shown drifting
5. **Step 4** — Heatmap intensifies on remaining Cu nodes ("cascade risk" indicator)

Each step shows a brief text annotation explaining the chemistry. The animation drives `state.angleY` to rotate the view to the best perspective for each step.

---

### Stressor 2: Thermal Stability

#### Controls

```
Temperature: [──●─────] 250 °C
              25 °C          400 °C
```

#### Visualization

As temperature increases:

- **Bond length scaling**: All bonds uniformly scale by a linear thermal expansion factor. HKUST-1 has a volumetric expansion coefficient ~50 × 10⁻⁶ K⁻¹. At 250 °C (ΔT = 225 K), bonds expand ~0.8%. This is rendered as a live bond-length visual update (bonds get slightly longer, atom positions shift outward from centroid).

- **Thermal vulnerability heatmap**: Colour bonds by predicted breakage risk at the current temperature:
  - **Cu–Cu axial bond** (dashed): weakest; breaks first (~150 °C loss of axial water → paddlewheel geometry distorts)
  - **Cu–O carboxylate**: breaks ~240–280 °C
  - **C–C aromatic bonds**: stable to ~300 °C+
  - **C–H bonds**: stable throughout

- **Threshold markers**: Vertical dashed lines on the temperature slider at known phase-change temperatures:
  - 100 °C — surface water desorption
  - 240 °C — coordinated solvent loss, paddlewheel distortion
  - 300 °C — linker decomposition onset
  - 380 °C — framework collapse

- **Doping effect**: Doped metal nodes shift the breakage threshold. A tooltip on the temperature slider shows: `Cu–O breakage threshold: 250 °C → Fe–O: 290 °C (+40 °C improvement)`.

---

### Stressor 3: Biological / pH Stability

#### Controls

```
Environment:
  ● Physiological  (pH 7.4, 37 °C)
  ○ Tumour microenvironment  (pH 6.5, 37 °C)
  ○ Lysosomal  (pH 5.0, 37 °C)
  ○ Gastric  (pH 2.0, 37 °C)
  ○ Custom pH: [____]
```

#### Visualization

At lower pH, carboxylate groups on the BTC linker become protonated (pKₐ of BTC carboxylates ≈ 2.1–3.5). Protonation breaks the Cu–O coordination bond:

- **Protonation heatmap**: At pH < 4, O_bridge atoms are highlighted in red (protonation risk); at pH 4–6, orange; pH > 6, green.
- **Cu²⁺ release indicator**: A badge on each Cu node shows the estimated release probability at the current pH. At pH < 5 (lysosomal), all Cu nodes show high release risk (red). At pH 7.4, near zero.
- **Linker integrity overlay**: Shows which C_carb–O bonds are at risk of protonation-driven detachment.

#### Biological Relevance Panel

Read-only annotations that update with pH:

```
At pH 6.5 (tumour microenvironment):
  Cu²⁺ release risk: Moderate (25–40%)
  Framework half-life: ~6 h (literature estimate)
  Application note: Controlled Cu²⁺ release for ROS generation in tumour cells [PMC reference tag]
  
Doping note: Fe³⁺ nodes reduce Cu²⁺ leaching; Fe²⁺/Fe³⁺ redox adds Fenton ROS activity.
```

References are static text (curated from key HKUST-1 stability papers) — no live literature search.

---

### Composite View: Doping × Stability

When the Doping Simulation feature is active simultaneously with the Stability panel, the heatmap renders a **split node view**: the left half of each Cu/dopant atom shows the original Cu stability colour; the right half shows the doped-metal stability colour. This directly communicates the per-node stability change.

A summary bar at the bottom of the Stability panel shows:

```
Stability improvement from doping (Fe substitution, 14.3%):
  Water:      ████████░░  +22%
  Thermal:    ██████░░░░  +15%
  Biological: ███████░░░  +18%
  (qualitative estimates based on literature rankings)
```

---

## Implementation Plan

### New files

| File | Purpose |
|------|---------|
| `app/stability.js` | Vulnerability scoring functions, thermal expansion math, pH protonation model, animation step sequencer (~180 lines) |

### Changes to existing files

| File | Change |
|------|--------|
| `app/state.js` | Add `stabilityMode` flag, `currentStressor` (`water`/`thermal`/`biological`), `temperature`, `pH` state vars; add `getVulnerabilityScore(atomOrBond, stressor, state)` |
| `app/renderer.js` | Overlay heatmap colours on atoms/bonds when `stabilityMode` is active; blend with existing element colour (lerp toward red at score=1); draw water molecule ghost in animation steps |
| `app/ui.js` | Bind Stability panel tabs, temperature slider, pH environment radio buttons; wire animation play/pause/step controls |
| `app/index.html` | Add Stability section to inspector panel |

### Heatmap colour blending

```js
// In renderer.js draw loop, after computing base element colour:
if (state.stabilityMode) {
    const score = stability.getVulnerabilityScore(atom, state.currentStressor, state);
    // Lerp: 0 = base colour, 1 = red (#ef4444)
    baseColor = lerpColor(baseColor, '#ef4444', score);
}
```

`lerpColor` is a simple hex→RGB→lerp→hex utility in `math3d.js` (2 lines).

### `stability.js` vulnerability model

```js
// Water vulnerability scores by role
const WATER_SCORES = {
    'Cu':       0.90,
    'O_bridge': 0.80,
    'O_term':   0.20,
    'C_carb':   0.05,
    'C_arom':   0.05,
    'H':        0.05,
};

// Doping modifier by element
const DOPING_WATER_MODIFIER = {
    'Zr': -0.60, 'Cr': -0.40, 'Fe': -0.25, 'Co': -0.15, 'Zn': +0.10, 'Cu': 0,
};

export function getWaterVulnerability(atom) {
    const base = WATER_SCORES[atom.role] ?? 0.10;
    const modifier = atom.dopant ? (DOPING_WATER_MODIFIER[atom.t] ?? 0) : 0;
    return Math.max(0, Math.min(1, base + modifier));
}

// Thermal bond vulnerability at temperature T (°C)
export function getThermalVulnerability(bond, atoms, T) {
    const a = atoms.find(x => x.id === bond.a);
    const b = atoms.find(x => x.id === bond.b);
    if (a.t === 'Cu' && b.t === 'Cu') return Math.min(1, (T - 100) / 150); // Cu–Cu axial
    if (a.t === 'Cu' || b.t === 'Cu') return Math.min(1, (T - 200) / 100); // Cu–O
    return Math.min(1, Math.max(0, (T - 280) / 120));                       // C–C, C–O
}

// pH protonation risk for O_bridge atoms
export function getPHVulnerability(atom, pH) {
    if (atom.role !== 'O_bridge' && atom.role !== 'O_term') return 0;
    // pKa of BTC carboxylate ~2.1–3.5; sigmoidal risk curve
    return 1 / (1 + Math.pow(10, pH - 3.0));
}
```

---

## Open Questions

| # | Question | Proposed Answer |
|---|----------|-----------------|
| 1 | Are stability scores qualitative or should they cite specific literature values? | Qualitative + curated footnotes. Add a disclaimer: "Scores are illustrative based on published stability rankings. Not a substitute for experimental measurement." |
| 2 | Should the water attack animation modify `atoms[]`? | No — drive a separate `animState` in `stability.js` that `renderer.js` reads for ghost molecule position. The real `atoms[]` is never mutated by the animation. |
| 3 | How to handle structures other than HKUST-1 (e.g., custom imports)? | Score by `role` field — the scoring table is role-based, not molecule-specific. Any imported structure with correct roles will be scored. Unknown roles default to 0.10. |
| 4 | Should biological references be hardcoded? | Yes for v1 — 3–5 curated citation tags (author, year, DOI) rendered as static text. No live PubMed query. |

---

## Verification

Manual tests:
- [ ] Activate Water heatmap on HKUST_CIF.json — verify Cu atoms are deepest red, C_arom atoms near-green
- [ ] Activate Water heatmap with Fe doping applied — verify Fe nodes show measurably lighter (less vulnerable) colour
- [ ] Play water attack animation — verify H₂O ghost approaches Cu axial site, bond highlight appears at step 2, bond disappears at step 3
- [ ] Set temperature to 350 °C — verify Cu–Cu dashed bonds are red, aromatic C–C bonds are green/yellow
- [ ] Set temperature to 100 °C — verify Cu–Cu bonds show moderate score, others near-green
- [ ] Set pH to 5.0 — verify O_bridge atoms highlighted, Cu²⁺ release badge appears on Cu nodes
- [ ] Set pH to 7.4 — verify near-zero vulnerability across all atoms
- [ ] Composite: activate doping + water heatmap simultaneously — verify split-node rendering on doped atoms
