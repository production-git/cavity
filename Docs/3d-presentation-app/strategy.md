# Strategy: 3D Presentation Application

> Source: User feedback points 15, 16, 17 — `Docs/feature_plans/user_feedback/raw.md`
> Date: 2026-04-06

---

## Positioning

**Customer:** Research scientists, materials scientists, educators, and conference presenters who need to communicate complex 3D molecular structures narratively — people who currently jump between a 3D viewer and a slide deck, losing fidelity and interactivity at every handoff.

**Category:** Scientific presentation tooling. Adjacent to Keynote/PowerPoint (narrative delivery), Blender (3D scene), VESTA/Crystal Maker (molecular viz). None combine all three. This category doesn't cleanly exist yet.

**Positioning statement:**
> For researchers and educators who present 3D molecular structures, the 3D Presentation App is a spatial storytelling tool that lets you build slide-like narratives directly inside a live 3D scene — unlike PowerPoint + VESTA workflows, which force a lossy export and break interactivity.

---

## Problem Statement

Researchers who work with 3D molecular structures are forced to flatten their story into 2D slides (screenshots, GIFs, static renders) because no tool lets them tell a *spatial narrative* with live 3D content. This results in:

- Loss of depth, rotation, and interactivity in the final presentation
- Significant prep overhead to produce polished animations
- Audiences who misunderstand structure because they see a 2D projection, not the actual geometry

**Validated by user feedback:**
- Point 15: "I want to switch scenes/origins" → need spatial navigation between content nodes
- Point 16: "tell a story without leaving the application" → narrative delivery inside 3D
- Point 17: Animation export belongs here → the story needs motion, not just still frames

---

## Opportunity-Solution Tree

```
Opportunity: Present molecular structures narratively in 3D
│
├── Opportunity: Navigate between multiple scenes fluidly
│   ├── Solution A: Multi-origin X-Y plane with arrow-key navigation  ← CHOSEN
│   ├── Solution B: Discrete "slides" as named scenes with a scene list panel
│   └── Solution C: Freeform 3D space with camera path bookmarks
│
├── Opportunity: Enrich scenes with non-molecular content
│   ├── Solution A: Text overlays and image planes anchored to origins  ← CHOSEN
│   ├── Solution B: PPTX import → distribute slides across origins
│   └── Solution C: Embed web content (iframes) as scene objects
│
├── Opportunity: Animate and export for async sharing
│   ├── Solution A: Camera-path animation export (scene transitions)  ← CHOSEN
│   ├── Solution B: Scene-to-scene transition recording
│   └── Solution C: Export full session as self-contained HTML viewer
│
└── Opportunity: HCUST molecule viewer as scene content source
    ├── Solution A: Embed HCUST viewer natively as scene object type  ← CHOSEN
    ├── Solution B: Import .json model files as positioned objects
    └── Solution C: Import arbitrary GLTF/OBJ 3D files
```

**Deferred bets:**
- PPTX import — high complexity, niche payoff; most researchers author fresh
- iFrame embeds — security surface, scope creep
- Freeform 3D camera paths — confusing UX for non-3D-native users

---

## Strategic Frame

**"Spatial Slide Deck for Scientists"**

Three bets, in priority order:

### Bet 1 — Infinite Canvas with Origin Navigation

**What:** An infinite X-Y plane. Each "origin" is a named spatial anchor. Arrow keys navigate between origins (snapping the camera to that anchor's view). No two origins overlap on screen.

**Why it wins:** This is the uniquely defensible mechanic. No competing tool has this. It makes the mental model feel like a slide deck but *stays* in 3D.

**Leading indicators:**
- Users create ≥ 3 origins per session
- Navigation between origins takes < 2 keystrokes
- Users share content that spans multiple origins

**Tradeoffs / non-goals:**
- Origins are X-Y only — Z-axis navigation is out of scope
- Collision detection for origin shifting is Phase 2 — Phase 1 uses fixed grid spacing

---

### Bet 2 — Scene Annotation Layer

**What:** Attach text labels, image planes, and simple shapes to origins. 2D overlays rendered in the 3D canvas, anchored to scene space (not screen space).

**Why it wins:** Transforms the app from a "viewer" into a "presentation tool." Unlocks the core use case: pointing at a structure and saying "this bond is the reactive site."

**Leading indicators:**
- Annotations are added in ≥ 40% of sessions
- Text labels appear in exported frames

**Tradeoffs / non-goals:**
- No rich text formatting in Phase 1 (bold/italic/lists deferred)
- No slide templates (scientist users prefer minimal chrome)

---

### Bet 3 — Scene Transition Export

**What:** Extend the animation export design to capture the *transition between origins* — camera glide from origin A → B → C with a hold at each origin. Export as WebM/GIF.

**Why it wins:** The "share outside the app" unlock. A researcher sends a 30-second video that tells the story without the audience needing the app installed.

**Leading indicators:**
- Export triggered in ≥ 30% of multi-origin sessions
- Exported files used in conference talks (qualitative signal)

**Tradeoffs / non-goals:**
- Phase 1 transition is a simple linear camera glide — no easing curves
- No audio narration track

---

## Explicit Non-Goals

- Z-axis navigation (keeps the "slide" mental model clean)
- Real-time collaboration
- Cloud storage / accounts
- Audio narration
- PPTX import before Phase 4

---

## Key Metrics

| Metric | Target | Why |
|---|---|---|
| Origins per session | ≥ 3 | Validates multi-scene use case |
| Sessions with annotations | ≥ 40% | Validates presentation use case |
| Export rate | ≥ 30% of multi-origin sessions | Validates async sharing bet |
| Time-to-first-export | < 5 min for new user | Validates learnability |
