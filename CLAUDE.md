# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run the app
Open `app/index.html` directly in a browser — no build step, no server required.

### CIF → JSON conversion
```bash
python scripts/cif_to_json.py <input.cif> <output.json>
# Example:
python scripts/cif_to_json.py models/CIF/2300380.cif models/HKUST_CIF.json
```

### Run tests
```bash
cd scripts && python -m unittest test_cif_to_json -v
```

## Architecture

The app is a single-page, zero-dependency browser tool for editing 3D MOF (Metal-Organic Framework) crystal structures.

```
app/
  index.html     — UI layout (canvas, modals, control panels)
  app.js         — All application logic (~1300 lines, vanilla JS)
  styles.css     — CSS variables + component styles

models/
  *.json         — Native model format (hand-authored or exported from app)
  HKUST_CIF.json — Model converted from CIF via cif_to_json.py
  CIF/           — Source crystallographic files (.cif)

scripts/
  cif_to_json.py      — Standalone Python CIF parser + converter
  test_cif_to_json.py — Unit/integration tests for the converter
```

### JSON model format
Both the app and the converter produce/consume this schema:
```json
{
  "version": 8,
  "name": "...",
  "atoms": [{ "x": 0, "y": 0, "z": 0, "t": "Cu", "role": "Cu", "plane": "cu-o", "id": 0 }],
  "bonds": [{ "a": 0, "b": 1, "dashed": false }]
}
```
- Coordinates are Cartesian, centered at the origin, scaled to max radius ≤ 10 (the 3D perspective clips at `per = 14`).
- `t` = element symbol; `role` = semantic role (`Cu`, `O_bridge`, `O_term`, `C_carb`, `C_arom`, `H`); `plane` = highlight group (`cu-o`, `carb`, `ring`, or `""`).
- App-exported files use version 9 and include additional fields (`customGroups`, `elements`, `viewState`).

### CIF conversion pipeline (`scripts/cif_to_json.py` and `app.js:parseCIF`)
Both the Python script and the in-browser CIF parser implement the same pipeline:
1. Parse unit cell parameters (a, b, c, α, β, γ)
2. Extract symmetry operations from `loop_` blocks (`_symmetry_equiv_pos_as_xyz` or `_space_group_symop_operation_xyz`)
3. Parse fractional coordinates for the asymmetric unit; strip uncertainty notation like `0.1(5)` → `0.1`
4. Apply each symmetry op, wrap to `[0, 1)`, deduplicate with 3-decimal-place keys
5. Convert fractional → Cartesian via the full triclinic transformation matrix
6. Center the structure at the geometric centroid
7. Auto-detect bonds: distance < (r_i + r_j + 0.4 Å) and > 0.4 Å; Cu–Cu bonds are dashed
8. Scale all coordinates if max radius > 10 (perspective safety)

The `models/CIF/2300380.cif` and `models/HKUST_CIF.json` files are the reference pair for testing CIF import correctness — they must produce equivalent structures.

### app.js structure (key sections)
- **UNDO/REDO** (line ~33): deep-copies `atoms`, `bonds`, `customGroups` into a 50-entry history stack
- **ELEMENT CATALOG** (line ~85): `ELEMENTS` array defines symbol, display color, radius, and semantic roles
- **ATOMS & BONDS** (line ~100): `atoms[]` and `bonds[]` are the global mutable state; `A()` and `B()` are the shorthand adders
- **buildDefault()** (line ~105): procedurally constructs the default HKUST-1 SBU
- **parseCIF()** (line ~1064): in-browser CIF → structure pipeline (mirrors `cif_to_json.py`)
- **loadStructureFromJSON()** (line ~1214): deserialises a JSON model into `atoms`/`bonds`
- **serializeStructure()** (line ~1213): serialises current state to version-9 JSON

### Coordinate system
3D world coordinates are projected to 2D canvas using a simple perspective divide. The perspective constant `per = 14` means any atom with `|z_screen| ≥ 14` produces division-by-zero artefacts — hence the max-radius-10 scaling in both importers.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
