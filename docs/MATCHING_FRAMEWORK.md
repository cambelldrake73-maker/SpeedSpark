# SpeedSpark Matching Framework (v1)

**Status:** Production specification  
**Source of truth:** `src/services/matchingService.ts`, `src/constants/matchingPriorities.ts`, onboarding screens  
**Last updated:** 2026-06-02

This document defines how SpeedSpark pairs members for speed dates. It reflects **only data collected in the current UI** — no queer-role matching, no orientation filters, no dealbreakers.

---

## 1. Matching philosophy

SpeedSpark matching is **bidirectional, safety-first, and preference-weighted**:

1. **Hard gates first** — If either member fails an eligibility check, the pair is rejected (score 0, not ranked).
2. **Soft scoring second** — Eligible pairs receive a 0–100 compatibility score from weighted category fits.
3. **Mutual fit** — Final score combines both directions (A→B and B→A) and penalizes lopsided matches.
4. **Private learning** — Post-date attractiveness ratings influence future `appearanceFit` internally; they are never shown on profiles or in the app UI.
5. **User-ranked priorities** — Each member drag-sorts seven dimensions; rank order becomes normalized weights for their directional score.

Pairing uses **greedy maximum-weight matching**: all eligible pairs are scored, sorted descending, then assigned without reusing a member (`pairingEngine.ts`).

---

## 2. Data collected

### Profile (self)

| Field | Type | Used in matching |
|-------|------|------------------|
| `genderIdentity` | enum | Hard gate (partner must list this in `preferredLookingFor`) |
| `sexualOrientation` | enum | Profile descriptor only (v1) |
| `datingIntentions[]` | enum[] | Soft: `datingIntentionFit` |
| `presentationTags[]` | enum[] | Soft: `presentationFit` (partner side) |
| `lifestyleTags[]` | string[] (max 5) | Soft: `lifestyleFit` |
| `age` | integer | Soft: `ageFit` |
| `heightInches` | integer | Soft: `heightFit` |
| `locationLatitude` / `locationLongitude` | number | Hard gate + soft: `distanceFit` |
| `accountStatus` | enum | Hard gate (must be `active`) |

**Not collected in UI (v1):** `queerRoles`, `personalityTags`, `interestedInGenders` on profile (preferences mirror genders instead).

### Preferences (what you want)

| Field | Type | Used in matching |
|-------|------|------------------|
| `preferredLookingFor[]` | gender enum[] (required ≥1 in UI) | Hard gate (bidirectional) |
| `ageRangeMin` / `ageRangeMax` | integer | Soft: `ageFit` |
| `maxDistanceMiles` | integer | Hard gate + soft: `distanceFit` |
| `heightMinInches` / `heightMaxInches` | integer | Soft: `heightFit` |
| `preferredPresentationTags[]` | enum[] (optional) | Soft: `presentationFit` |
| `matchingPriorityOrder[]` | rank keys (7 items) | Weight conversion |

**Not collected in UI (v1):** `preferredOrientations`, `preferredQueerRoles`, dealbreakers.

### Post-date feedback (private)

| Field | Type | Used in matching |
|-------|------|------------------|
| `attractivenessRating` | 1–10 | Soft: `appearanceFit` (internal only) |
| `wouldTalkAgain` | boolean | Match creation only — **not** used in compatibility scoring |

---

## 3. Hard eligibility gates

A pair `(A, B)` is **ineligible** if **any** gate fails. Blockers are logged internally; users never see raw blocker strings in the UI.

| Gate | Rule |
|------|------|
| Same user | `A.id === B.id` |
| Blocked | Either user blocked the other |
| Reported pair | Either user reported the other in the current queue window context |
| Account status | Both profiles must have `accountStatus === 'active'` (non-active excluded at queue load server-side; matcher re-checks defensively) |
| Recent repeat date | Pair dated recently (cooldown window) |
| Max distance | Great-circle miles between A and B exceeds **either** viewer's `maxDistanceMiles` (when lat/lng available on both) |
| Gender looking-for (A→B) | `B.genderIdentity ∈ A.preferredLookingFor` |
| Gender looking-for (B→A) | `A.genderIdentity ∈ B.preferredLookingFor` |

**Empty `preferredLookingFor`:** Treated as **fail closed** (pair rejected). The UI requires at least one gender; empty prefs should not occur in production.

**Orientation:** `sexualOrientation` is stored on profiles but **not** used as a hard or soft filter in v1 (`preferredOrientations` is never set by the UI).

---

## 4. Soft scoring categories

Each category returns **0–100**. All seven rank keys participate in directional scoring.

### Scoring interpretation

| Score | Meaning |
|-------|---------|
| **100** | Strong positive signal — confirmed match on this dimension |
| **50** | Unknown / neutral / insufficient data — **not** treated as a mismatch |
| **0** | Strong negative signal — confirmed mismatch when both sides have meaningful data |

Constant: `NEUTRAL_MATCH_SCORE = 50` in `src/constants/matchingScoring.ts`.

Missing or unset values must **never** produce 0. Only confirmed mismatches (e.g. both users listed intentions with zero overlap, partner age outside a set range) decay toward 0.

| Key | Label | Formula (summary) |
|-----|-------|-------------------|
| `datingIntentionFit` | Dating intentions | Overlap × 100 when both have intentions; **50** if either side empty |
| `presentationFit` | Presentation | Overlap when viewer prefs and partner tags both set; **50** if viewer prefs empty or partner tags empty |
| `ageFit` | Age range | 100 in range; decay outside range; **50** if age prefs or partner age unknown |
| `distanceFit` | Distance | Higher when closer within max; **50** if lat/lng missing on either side |
| `appearanceFit` | Attractiveness | Prior feedback × 10; **50** if no rating history |
| `lifestyleFit` | Lifestyle & values | Overlap × 100 when both have tags; **50** if either side empty |
| `heightFit` | Height | 100 in range; decay outside range; **50** if height prefs or partner height unknown |

`appearanceFit` is **internal only** — never included in user-visible `reasons` strings.

---

## 5. Rank-to-weight conversion

User drag-sorts categories in `matchingPriorityOrder` (most important first).  
Implementation: `priorityWeights()` in `src/constants/matchingPriorities.ts`.

For `n = 7` categories at positions `0 … 6`:

- Raw weight at position `i` = `n - i` (top rank = 7, bottom = 1)
- Normalized weight = raw weight / sum(all raw weights)

**Default order:**

1. `datingIntentionFit`
2. `presentationFit`
3. `ageFit`
4. `distanceFit`
5. `appearanceFit`
6. `lifestyleFit`
7. `heightFit`

Unknown or legacy keys in stored arrays are stripped; missing keys are appended from the default order.

---

## 6. Directional scoring

For viewer **V** evaluating partner **P**:

```
directionalScore(V→P) = round( clamp( Σ categoryWeight[k] × categoryScore[k], 0, 100 ) )
```

- `categoryWeight` comes from **V's** `matchingPriorityOrder`
- `categoryScore[k]` from the formulas in §4
- `reasons` may list non-appearance categories scoring ≥ 75 (e.g. `"datingIntentionFit strong"`) — for internal pairing logs only

Internal debug log `matching.scoreDetail` records full per-category breakdown including `appearanceFit` (server/dev only).

---

## 7. Mutual scoring

```
avg = (scoreAtoB + scoreBtoA) / 2
floor = min(scoreAtoB, scoreBtoA)

if floor < 35:  mutual = round(avg × 0.55 + floor × 0.20)
if floor < 50:  mutual = round(avg × 0.82 + floor × 0.12)
else:           mutual = round(avg)
```

This penalizes pairs where one direction is a poor fit even if the other is strong.

---

## 8. Private appearance / chemistry learning

After each speed date, members rate attractiveness **1–10** (private). Stored in `date_feedback`.

- Converted to `appearanceFit` score: `rating × 10` (clamped 0–100)
- Default when no prior rating: **50** (neutral)
- Loaded server-side into `MatchingContext.appearanceScoresByViewer` during pairing
- **Never** returned in compatibility `reasons`, profile cards, or UI components

`wouldTalkAgain` (Match / No match) controls mutual match creation via RPC — it does **not** enter the compatibility formula.

---

## 9. Intentionally not included (v1)

| Feature | Notes |
|---------|-------|
| Queer role matching | `queerRoles` / `preferredQueerRoles` not collected |
| Orientation preference filter | `preferredOrientations` not collected |
| Dealbreakers / nice-to-haves | DB columns exist; UI unused |
| Gender preference as soft score only | Gender is a **hard gate**, not a weighted category |
| Public attractiveness scores | Never exposed |
| Verification status | Not a scoring factor (may affect queue eligibility separately) |
| Photo / visual ML | Not used |

---

## 10. Examples

### Example A — Gender gate blocks incompatible pair

- **Alex:** `genderIdentity: woman`, `preferredLookingFor: ['woman']`
- **Sam:** `genderIdentity: man`, `preferredLookingFor: ['man']`

**Result:** Ineligible — `Gender looking-for mismatch for A` (Sam's gender not in Alex's prefs) and symmetric blocker for B.

### Example B — Eligible pair, default weights

- **Jordan:** woman, prefers `[woman, non_binary]`, age 28, intentions `[relationship, dates]`
- **Riley:** non_binary, prefers `[woman, non_binary, man]`, age 27, intentions `[relationship]`

Both pass gender gates and distance. Directional scores weight dating intentions highly (default rank #1). Shared `relationship` intention → high `datingIntentionFit` → strong mutual score.

### Example C — Priority order changes ranking

Two eligible partners for **Casey** (presentation ranked first):

| Partner | Presentation overlap | Age fit |
|---------|---------------------|---------|
| Pat | 100 | 60 |
| Quinn | 40 | 100 |

With `presentationFit` ranked first, Pat may outscore Quinn despite Quinn's better age fit.

### Example D — Appearance learning (internal)

Casey previously rated **Pat** attractiveness **9/10** → `appearanceFit` = 90 for Casey→Pat. This boosts Casey's directional score toward Pat but does not appear in UI or public `reasons`.

---

## Implementation map

| Concern | File |
|---------|------|
| Gates + scoring | `src/services/matchingService.ts` |
| Priority weights | `src/constants/matchingPriorities.ts` |
| Appearance scores | `src/services/matchingAppearance.ts`, `src/constants/matchingScoring.ts` |
| Greedy pairing | `src/services/pairingEngine.ts` |
| Server bundle | `src/services/matchingDataServer.ts` + RPC `get_window_matching_context` |
| Dev tests | `src/services/dev/matchingFrameworkTests.ts` |

## Testing

In Metro dev console:

```javascript
await SpeedSparkMatchingDev.runMatchingFrameworkTests()
```

See test file for assertions covering gender gates, bidirectional prefs, priority weighting, and appearance privacy.
