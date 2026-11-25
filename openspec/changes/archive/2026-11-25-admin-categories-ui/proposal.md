## Why

GC-2 (`admin-layer-categories`) gave the admin API per-country categories and a
`category_id` on every layer, but the admin web still has no way to use them: a
country's admin can't create "Agricultural frontier" or "Protected areas", every new
layer goes into `deforestation`, and the form can't even save an existing layer of a
non-temporal category, because it always sends years the API refuses. An enabled layer
that is hidden because of its category or its years shows no reason. This change is
the admin UI for categories and the category of each layer. Part of the "Gestor de
capas" orchestration (undp/monbo#116), unit GC-5 (undp/monbo#121).

## What Changes

- **New categories page** (`/[locale]/admin/categories`), linked from the admin
  header between "Layers" and "Usage":
  - one card per category of the session's country: icon and color, name in ES and
    EN, description, what its layers mark (polarity) in plain words, the threshold
    (its own or the global one), the "no findings" and "with findings" result chips,
    its layers and how many are published, and whether it is enabled;
  - an enable/disable switch per category;
  - a warning when the country's `categories.json` can't be read or has rejected
    entries (`readable`, `errors`), with category writes disabled while it is
    unreadable.
- **A side panel to create and edit a category**:
  - name and description in ES and EN, icon, color, threshold (global or its own),
    whether its layers compare two years (`temporal`), and the result texts in ES and
    EN;
  - the polarity is chosen **explicitly**, with no default, and each option explains
    what counts as a finding; the form can't be saved without one;
  - the id is suggested from the Spanish name while creating, can be edited, and is
    shown as permanent; it is read-only when editing;
  - a live preview of the category chip and of the "no findings" and "with findings"
    chips, computed with the shared classifier, that changes with the polarity and the
    threshold.
- **The API's rules are explained before the admin hits them**, not only as a 400:
  - a category with published layers can't be enabled or disabled, and its polarity
    can't change: the control is locked and names the layers to hide first;
  - `temporal` is locked while the category has any layer;
  - a published layer's category is locked in the layer form, with the same "hide it
    first" explanation.
- **Layer form**: a required category selector (enabled categories, plus the layer's
  current one even when it is disabled or broken). `baseline` and
  `compared_against` are shown only for a temporal category and sent as `null`
  otherwise. This fixes saving an existing layer of a non-temporal category.
- **Why a layer is not public**: the layers list gains a "Category" column and a
  status that says why an enabled layer is hidden (`category_issue`, a disabled
  category, `layer_issue`) and how to fix it; the layer editor shows the same notice.
  Publishing from the list or the raster section translates the API's refusals
  instead of a generic error.
- **Admin texts that still said "deforestation"** (login subtitle, layers list
  subtitle, publish notice) are made generic.
- Translation keys in `es` and `en`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `layer-administration`: the "Admin UI" requirement gains the categories page and
  panel, the category in the layers list and in the layer form, years by `temporal`,
  the reasons a layer isn't public, and a third admin navigation item.

## Impact

- **Web:**
  - `app/[locale]/admin/categories/page.tsx` (new route);
  - `components/page/admin/`: a categories page, a category panel with its preview,
    and form state for categories; `LayerForm`, `layerFormState`,
    `AdminLayersPageContent`, `AdminLayerEditorPageContent` and
    `RasterUploadSection` (publish errors);
  - `api/adminCategories.ts` (new client for `/admin/categories`);
  - `components/reusable/Header/` (navigation item; below 900 px the admin sections
    and country move into the header's menu so the admin fits 390 px);
  - `CategoryChip` and `ResultChip` move from `components/page/documentation/` to
    `components/reusable/` so the admin can reuse them;
  - `locales/{es,en}/admin.json` and `common.json`.
- **API and contracts:** none. The UI uses the routes and shapes of GC-2 as merged.
- **Docs:** `docs/maps.md` ("Managing categories in the admin" points to the UI).
- No change to the analysis, the ratio, the public routes or the stored data.
