# Feature Brief — Generate Menu from Owner Image

Status: Stage 0 — Framing
Date: 2026-03-02
Author: Orchestrator Agent

---

## Alternative Name

Import menu from image / OCR+AI to menu JSON / Draft menu from photo

---

## Problem

Today the menu is maintained manually in `data/menu.json`. To match the real owner workflow, we need to accept an uploaded menu image (photo/screenshot/PDF-converted image) and transform it into a structured menu draft.

Without this, menu updates remain slow and technical, requiring manual JSON edits.

---

## Goal

Allow an authenticated admin user to upload a menu image, generate a **structured draft** of categories/items/prices, review it, and publish it.

Success = image upload -> structured draft -> human review -> publish to active menu, without manual JSON editing.

---

## Who

- **Burger owner / staff (authenticated):** Wants to update the menu from an image.
- **Customers:** Should only see the published, consistent menu.
- **Developers/operators:** Need a safe, auditable workflow with clear failure behavior.

---

## What We Capture / Change

- **Admin UI (`/admin`):**
  - New section for menu image upload.
  - Review screen with diff between current menu and extracted draft.
  - Actions: `Discard`, `Edit`, `Publish`.
- **Server-side pipeline:**
  - Receives image, calls extractor (OCR/vision), normalizes to internal menu schema.
  - Returns draft with confidence/issues per item.
- **Image storage (locked):**
  - Upload goes to **Supabase Storage** in a dedicated private bucket (e.g., `menu-imports`).
  - DB stores file reference metadata (`bucket`, `path`, `size`, `mime`, `uploaded_by`).
- **Persistence:**
  - Store draft menu separately from active menu.
  - Publishing promotes approved draft to active menu.
- **Minimum auditability:**
  - Who uploaded, when, processing status, who published.

---

## Success Criteria

- [ ] Only authenticated users can access upload/generation/publish flow.
- [ ] Valid image upload generates structured draft with categories, items, and prices when possible.
- [ ] No auto-publish: human review is required before activation.
- [ ] Draft supports manual edits for invalid/uncertain fields.
- [ ] Publish updates active menu used by `/`.
- [ ] Extraction failures return clear pt-BR user messages without exposing internals.
- [ ] Flow keeps minimum attempt/publication history.
- [ ] Existing order/customization behavior is not broken.
- [ ] Upload validates file type/size with explicit limits and returns pt-BR errors when invalid.
- [ ] Source of truth for active menu is explicitly defined and used consistently.

---

## Non-Goals (Out of Scope)

- Auto-publish without human review.
- Perfect extraction for complex layouts/logos/low-quality photos.
- Multi-language support.
- Advanced menu versioning with one-click rollback.
- Training a custom model in this phase.

---

## Acceptance Scenarios

### Happy Paths

1. **Valid upload:** Staff uploads readable image and receives draft with items/prices.
2. **Review and publish:** Staff adjusts a few fields and publishes; `/` shows new menu.
3. **Multiple categories:** Extraction recognizes categories and maps items correctly.

### Unhappy Paths

1. **Unreadable image:** System returns error prompting re-upload.
2. **Ambiguous price:** Field is flagged and requires manual edit before publish.
3. **OCR/vision provider failure:** No publish; pt-BR error shown + internal log.
4. **Unauthenticated user:** Access denied to import/publish flow.
5. **Invalid file:** Unsupported type or size above limit is rejected before extraction.
6. **Stale cart against new menu:** After publish, submit with item/modifier missing from active menu is rejected with pt-BR validation.

---

## Edge Cases

- Price formatting differences (`25,90` vs `25.90`) and `R$` symbol.
- Duplicate item names across categories.
- Accented text/abbreviations (`X-Burguer`, `X Burguer`).
- Items without explicit price in image.
- Very large image or unsupported format.
- Near-simultaneous publishes by two staff users.
- Failure between Storage upload and DB draft creation (consistency gap).

---

## Approach (High-Level Rationale)

1. Build admin upload + async processing flow.
2. Save image to private Supabase Storage and persist metadata/status.
3. Extract text/structure with OCR/vision and convert to menu schema.
4. Save as non-active draft for human review.
5. Publish only after explicit approval by staff.
6. Keep processing/error logs for diagnosis.

---

## Decisions (Locked)

- **Human review required** before any publish.
- **Admin-only scope** (no public import endpoint).
- **Image storage (locked):** Supabase Storage private bucket for owner/staff uploads.
- **Active menu source of truth (locked):** Active menu is read from published DB version (not direct manual edits in `data/menu.json` through admin flow).
- **Local/dev compatibility:** `data/menu.json` may remain as dev seed/fallback, but official image-flow publish updates DB active menu.
- **MVP uses persisted draft** (no auto-publish).
- **Canonical price format:** `priceCents` in final structure.
- **Extractor boundary (locked):** MVP uses one OCR/vision provider behind an app interface; no multi-provider strategy in this phase.
- **Extractor failure contract (locked):**
  - timeout/controlled failure -> draft becomes `failed`, active menu unchanged
  - parsing error -> draft becomes `ready_with_issues` for manual review
- **Upload constraints (locked):**
  - accepted MIME types: `image/jpeg`, `image/png`, `image/webp`
  - max file size: `10MB`
  - quantity: `1` image per draft in this phase
- **Minimum draft lifecycle (locked):**
  - `uploaded` -> `processing` -> `ready` | `ready_with_issues` | `failed` -> `published` | `discarded`
- **Publish semantics (locked):**
  - only one active menu at a time
  - publish is explicit active-version pointer switch
  - publish failure does not alter current active menu
- **Impact on stale carts (locked):** submits containing `menuItemId`/modifiers not present in active menu must fail closed with pt-BR validation (no order creation).
- **UI/message language:** pt-BR.
- **Fail-safe requirement:** extraction errors must leave active menu unchanged.

---

## Stage 0 Exit Gate

- [x] Problem is clearly defined
- [x] Goals are concrete and testable
- [x] Non-goals are explicitly listed
- [x] Happy and unhappy paths are documented
- [x] Edge cases are surfaced
- [x] Key decisions are locked
- [x] Approach is outlined at a high level (no code)
- [ ] Critic has approved this brief
