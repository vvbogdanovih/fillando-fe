# General catalogue transition (Plan-0010)

Implemented locally, not yet released. The product title is the product name as written plus
the variant value — no filament/diameter suffix and no category name (owner, 2026-11-05).

**The category is navigation, its Google category and its list of characteristics — nothing that belongs
to a product (owner, 2026-11-05).** There is no category presentation any more: `category_presentation` is gone
from product detail, the category no longer carries `presentation`, and filament knowledge is not baked into
universal code. The specification table of a v2 page is the backend's: rows arrive ordered by the
category's definitions (`order`) and hold only the definitions marked «У таблиці характеристик на сторінці
товару» (`visible_in_specs`) — the one visibility switch and the one order. `buildSpecRows` only merges repeated
values and appends units; it never reorders, hides or emphasises. A v1 page prints its rows in stored order
(so its «Матеріал»/«Виробник» rows show again until the migration retires v1). See «The product card as
product data» below.

VariantSwitcher renders Next Link hrefs in initial HTML. Colour variants use swatches;
other variants use native details/summary with links. Sold-out siblings remain linked.
Zero/one sibling renders no switcher. Canonical and Product JSON-LD still follow the
existing route: full Plan-0010 SEO matrix and ProductGroup work remain pending. (Superseded — F09 and «ProductGroup structured data» below.)

Product/variant renames now keep stored slugs on the backend. Explicit slug changes,
redirect registry and public typed filters are pending; the opt-in tree admin is described below. (Superseded — B07/F10 «Address changes with redirects» and the typed storefront below.)

Order and visibility of the specification rows are set per characteristic in «Характеристики та фільтри»
(the rule to hide bare numbers without units was removed on 2026-11-05 — units come from the category).
Legacy attribute keys still follow the existing label mapping until v2 editing is enabled. The filament
Google-taxonomy preset was removed; existing saved taxonomy remains unchanged.
Category revalidation expires both category and product caches immediately because
product detail embeds category names, units and the characteristics' order and visibility.

The public price sheet is built per category (owner, 2026-11-06): the backend sorts rows by
category and sends each page's `categories` with their columns — the characteristics the
catalogue filters them by, colour included — and every row's `values`. `priceSheetSections`
(`price-sheet/price-sheet.utils.ts`) groups consecutive rows into sections, each a heading and
its own table (Фото, Назва, its columns, Артикул, Вартість, Кількість, Синхронізовано); a phone
card lists the values as «label: value». «Варіант» (`variant_label ?? color`) stays only where
the category asks for it (`variant_column`: a v1 category, an axis that is not a filter) and for
an older backend without categories. `material` is deprecated and never shown.


## Variation rules in the admin (owner, 2026-11-06)

`isAxisCandidate` (`category-definitions.schema.ts`, the backend's twin): a variation only on a
required list, number, yes/no or colour. The product editor offers only those as «Вісь
варіантів» (a stored axis that no longer qualifies stays listed and the server refuses it); with a
required colour the axis is the colour and «Без варіантної ознаки» is off; a colour is never a
product field. The category editor shows the colour with «Фільтр» (the catalogue filters it by
family), its «У фільтрах» checked and locked with one sentence; choosing «Колір» as the meaning
gives the colour shape (text, one value, no unit or filter); «Обов’язкова» is locked while SKUs
vary by the characteristic (`AXIS_REQUIRED`).

The unfolded characteristic (owner, 2026-11-07: «що це каша така»): «Назва» and «Тип» on top; what
the data already fixes (type, unit, «кілька значень») is said as text, not offered as a locked field;
«Призначення» stays a select on a used characteristic too (owner, 2026-11-08: it only says where the feed
and the exports read a value), without «Колір» — a used characteristic never becomes the colour, and a
used colour keeps «Колір зі словника» as text; three checkboxes — table, filter, required — each with its reason beside it when it is
locked («закріплено на 4 посадкових сторінках», «немає значення в 28 товарах», «за нею варіюються
298 SKU»); «Спосіб фільтрації» only for one number; list options one per row with the «Товари» count
and × only on an unused one; order by ↑↓ arrows (characteristics in the list, options in the panel),
never typed numbers; «Прибрати характеристику» only while nothing uses it.

## One «Зберегти» and «Опублікувати» on the category page (owner, 2026-11-09)

«щоб зберегти і опублікувати, треба бігати по всій сторінці»: the blocks no longer hold save buttons
(«Зберегти назву й зображення», «Зберегти розташування», «Зберегти характеристики», «Зберегти SEO», the
Google Shopping «Зберегти») and the separate «Публікація» card is gone. `CategoryHeader` sticks to the top
of the page: the category's name and state, «Опублікувати»/«Зняти з публікації» with its reason when
blocked, and — while something is unsaved — «Не збережено: …» with «Скасувати» and «Зберегти».

- **Unsaved edits live above the blocks** (`category-drafts.tsx`): `useCategoryDraft(categoryId, section,
  serverValue)` returns the draft or the server value. A block remounts on every revision and a folded block
  unmounts — their state would vanish; the store keeps it per category, so moving around the tree keeps it
  too (the tree marks «Є незбережені зміни»), and leaving the page asks first: `beforeunload` for a reload
  or another site, and — because the router takes an in-app link's click without it — one capture-phase
  click listener beside it («Є незбережені зміни. Перейти без збереження?»; the sidebar, «Товари цієї
  категорії →»; product drafts live in the same store, so the «Товари» screen asks too). A draft
  equal to the server value is no draft — also when the server catches up after a lost answer.
- **«Зберегти»** (`saveAll`) prepares every unsaved block's command (`useCategorySave().prepare`); one that
  cannot be sent (no name, a bad order, an invalid characteristic, a Google ID without its path or a path
  without its ID — never saved as «no category») shows its issue in the block, the header names the block
  (`«X» не збережено: …` — the block may be folded or far down the page) and nothing is sent. Then one
  command after another in page order — «Назва й зображення»,
  «Розташування», «Характеристики», «Сторінка категорії на сайті», «Google Shopping» — each persisted with
  its key first (`send`, the same rules as every other command) and each on the revision the previous
  receipt answered. A refusal stops the rest: what was saved is clean, the refused and the remaining
  blocks keep their drafts, the header says «Збережено: … «X» не збережено: …». «Nothing to change»
  (409 `CATEGORY_DETAILS_UNCHANGED` / `SEO_UNCHANGED` / `EXPORT_UNCHANGED` — a trailing space, an emptied
  editor, a lost answer) is no refusal: the block counts as saved, the revision stays, the chain goes on.
  A confirmed command settles its draft only while the draft is still what was sent (`saved(command)`) —
  now, or later through «Перевірити стан операції» / «Повторити той самий запит». While the chain runs
  «Скасувати» is off and the rich-text editors are read-only (`HtmlEditor readOnly`; a `<fieldset
  disabled>` does not stop typing in them). A deleted category's drafts go with it; a category turned
  into a group loses those of «Характеристики» and «Google Shopping».
- **Publication publishes what is saved**: «Опублікувати» waits while something is unsaved («Спершу
  збережіть зміни.»). «Зняти з публікації» asks first, in one sentence (the category and its SKUs leave
  the storefront and the feed; publishing again opens every ready product's draft SKUs).
- **Two-step actions cannot be passed by a double-click** (unpublish, «Видалити чернетку», a draft product
  category → group, the conversion by a plan): the trigger turns into «Скасувати» where it stands and the
  confirmation opens on a line of its own.
- Landings keep their own buttons — each is a record with its own publication; the address change,
  conversion and draft deletion are actions, not edits, and stay in «Основне».
- `HtmlEditor` passes on only the admin's own edits (`source === 'user'`): Quill re-renders a loaded text
  on mount, which would have marked «Сторінка категорії на сайті» unsaved at once.
- Tests render a block inside `WithDrafts` (`category-drafts.test-utils.tsx`), which adds the header's
  «Зберегти»/«Скасувати».
- **The product page the same way** (owner, 2026-11-09: «дуже багато "зберегти" — треба одну кнопку»):
  `ProductHeader` sticks to the top with «Не збережено: Характеристики · Акція · Попередження · Опис»,
  «Скасувати» and «Зберегти»; the blocks lost «Зберегти характеристики товару», «Застосувати до всіх
  варіантів», «Зберегти попередження» and «Зберегти опис». Every one of them is a part of one product save,
  so `useProductSave` (`product-drafts.ts`) builds a single `product` command from the drafts
  (`productBody` + the characteristics, a promotion on/off every SKU, the notice, the description) — no
  partial saves. «Прибрати акцію з усіх» is a draft too («Після збереження акцію буде прибрано…»). The
  workspace's `submit(command, onSuccess)` drops the drafts once the command is confirmed. A variant keeps
  its window's own save; creating a product keeps its own button, named by what it creates — «Створити
  товар» when the chosen status is «Активні» in a published category, «Створити чернетку товару» otherwise;
  moving, archiving and deleting are actions. `DescriptionBlock` reports the admin's own edits through `onChange`. The product list marks
  products with unsaved edits. Tests: `WithProductDrafts`.

## Admin category tree workspace (2026-10-25, local rollout only)

`/admin/categories` opens an iterative tree view by default. It loads every admin cursor
page into one revision before editing; duplicate IDs/cursors or mixed revisions fail
without a partial editable tree. Groups can contain groups or product categories at any
depth. The display caps indentation, not nesting; each row shows the actual level.
Parent options exclude product nodes, the current node and its descendants.

Create a draft group/product category with name, stable slug, parent and order. Rename
and placement use separate forms, so an ordinary rename cannot alter a URL. v1
categories are read-only; a published (active) v2 category edits its name, image, order and
characteristics since 2026-10-29 (section at the end). The server capability flag governs available actions; the old
editor is blocked once catalog control is bootstrapped. No browser code enables the flag.
Publication, conversion, deletion, image editing and public filter integration are pending. (Superseded — all implemented locally since 28–29.10, sections below.)
Typed definitions and ADMIN filter checking are implemented below.

Before a mutation, UUID + exact command body are persisted in sessionStorage. Unknown
responses keep this operation across reloads and block another command. ADMIN can check
status or explicitly retry the same request/key; there is no automatic mutation retry
(apart from the existing Axios 401 refresh, which retains the same header/body). Final
completed/rejected/aborted/rolled_back results release the UI; pending/recovery do not.
A status 404 is not proof that no delayed request will execute, so the key is retained.
Storage failures stop sending the mutation; malformed stored commands block editing.

Validation: `yarn test src/app/admin/categories`; real API/Mongo browser rehearsal:
`yarn test:e2e --config playwright.categories.config.ts`. This separate config requires
the sibling backend and disposable Mongo 27018. It does not use the regular mock API.
Auth is a local test role header; the category path, revision gate and database are real.
The test creates depth 3, renames, moves, checks stable slug, deliberately loses a successful
HTTP acknowledgement and verifies the persisted operation after reload without duplication.


## Typed attribute editor and real filter check (2026-10-25)

The v2 product category panel now loads `/categories/:id/admin/configuration`. It
requires its revision to match the loaded tree before editing. Form controls cover
text/number/boolean/enum, unit, required, filtering, filter type, spec visibility, order,
multiplicity, explicit semantic and enum options/order. Incompatible range/multivalue
combinations and malformed values are rejected locally and by the backend.
Saved IDs survive label edits; the UI never derives them from a label. Copy replaces
only the unsaved editor state after explicitly selecting a source and clicking the
copy action; it strips source identities and becomes a write only on Save.
Definition commands use the same sessionStorage receipt/recovery flow as tree writes.

The static preview illustrates fields and filter widgets; it does not save product
values. The separate expandable **Перевірка збережених фільтрів на товарах** sends
actual typed filters to the bounded ADMIN preview API. It uses saved config only
and is disabled while definitions are dirty. Numeric zero and boolean false survive;
text selections are newline-delimited, never comma-split. Counts disappear on filter
changes. A changed revision or unready data is an error, never an invented zero result.

The active public storefront remains on its legacy reader. Product creation/edit forms,
public filter URL state, visibility activation, catalog groups, price/brand/stock facets
and publication are not implemented by this editor. Never enable the draft flag on
production merely because these local tests pass. (Superseded by the later sections; the flag is switched by the release runbook D08 only.)

### Typed product drafts inside the category workspace

A v2 product category's products: a cursor-paginated list (25 products), followed by a
definition-driven form — on the «Товари» screen only since 2026-11-05 (see below).

**Layout (owner requests 02.11.2026: «дуже дивний дизайн…», then «хай буде як колись: список варіантів,
натискаю редагувати…»).** `/admin/products` (and, since 04.11, the category tree workspace) is capped at `max-w-6xl`, left-aligned (owner 03.11: a form, not a
dashboard — full-width fields were hard to read), two columns from `xl` up and one column below, under a
category filter: the category tree is folded behind «Категорія: <name> ▾» (`CategoryTreeWorkspace`,
`productsOnly`; owner 03.11 — a whole column for one category wasted the screen; it opens the first editable
product category by itself and folds again on a choice), the product list (`TypedProductEditor`: «Створити
товар», numbered pages of 25 with the category total and a name search the server runs over the whole category —
`GET /products/admin/typed-drafts?page=&q=`, owner 03.11; the search over the loaded page could not find a
product on page 3 — the selected product marked) and the editor as white cards, in the old admin's order of work:

1. a header (name, variant count, where a save lands, «Відкрити на сайті») and «Готовність даних товару»;
2. «Характеристики товару» — «Основне» (name, supplier, axis), then the characteristics grouped by what they do
   for the shopper (`characteristicGroups`, owner 03.11 «недостатньо читабельні поля»): «Фільтри на сайті»
   (`filter_enabled`), «Лише на сторінці товару» (`visible_in_specs` only), «Не показуються покупцю» — each a
   titled section with a one-line purpose and a separator (`FormSection`, a CSS container: 1/2/3 columns follow the
   card's width, not the window's); required ones `*`, legend by the title. A
   SKU's axis value is not here: it shows only when the axis itself changes, since every SKU then needs a
   value in the new axis in that one save;
3. «Варіанти» — the old table (value with its colour swatch, SKU linking to its page, supplier article,
   price with the promotion, stock, weight, status, photo) and per row «Редагувати» (`VariantDialog`),
   archive/restore (draft category) and delete (two-step). **The whole SKU is one window:** value, price,
   stock, weight, supplier ids, status, promotion and photos go in one typed-draft PATCH — the body carries
   the axis values, `details` (every SKU, the edited one changed, the rest as stored without promotion
   fields) and one `variant_action` (status); its address is a separate redirect-backed change in the same
   window. «Додати варіант» opens the window empty (`variant_action: add`, photos included since 2026-11-15);
4. «Акція на весь товар» — one promotion for every SKU, saved at once; «Попередження перед покупкою» — the
   product's own purchase notice (`ProductPurchaseNoticeEditor`, see «The product card as product data»);
   «Опис товару» — the description alone; then transfer.

Every panel builds its body with `typed-product-body.ts` (`productBody`, `storedDetailRows`,
`storedDescription`), so it resends what it does not edit unchanged; `details.purchase_notice` is sent only
by its own card — omitted keeps the stored notice. Products are edited in one place, `/admin/products`
(owner, 2026-11-05): the category page no longer embeds the editor — its «Товари категорії» card links to
`/admin/products?category=<id>`, which opens the products view on that category (`ProductWorkspaceGate`
`categoryId`, a 24-hex id or ignored). Shared classes live in
`admin-ui.ts`; controls stay native `<select>`/`<input>` (Playwright `selectOption`), but every text field, select
and textarea of the catalogue admin takes the shared `Input` look (`fieldClassName` in `ui/input.tsx` → `ui.field`,
`ui.input`, `ui.textarea`; owner, 2026-11-09: «як в інших інпутах») — never a class string of its own. Visible captions are not
repeated: a characteristic's input and a SKU's value keep their accessible names (`Виробник 1`, `Варіант FL-…`)
as `sr-only` labels, which the tests use; the window's title is «Редагування варіанта FL-…» so it does not
share that name.

Fields support string/number/boolean/enum and multiple scalar values. Empty
numeric input stays missing; false/zero survive. The axis selector only includes
single-valued definitions, clears old SKU values when changed, and requires
unique values for every sibling. Required attributes may stay blank for drafts.
A product without an axis must have one SKU. The edit form sends only editable typed
fields, never SKU/slug/commerce values, and the server derives variant names.

`product` is a command in the existing pending-operation union. The exact UUID
and body are persisted before PATCH and reused after uncertain outcomes, with
the same operation-status endpoint. New category/product writes stay blocked
until it resolves. Revision changes reset cached editor state. F04 is partial:
category transfer, active edits, dictionary color adaptation and publication
are not available through this form yet. Saved SKU lifecycle is described below.

### The product name on its page

`productDisplayName` (`products/[slug]/product-title.utils.ts`) is the one author of the H1, the
cart line, the Product JSON-LD name and the `<title>` of a v2 page: the product name as written,
then the variant value («Kingroon PLA Silk — Чорний (Black)»); without a variant value, the SKU
name. A v1 page's `<title>` keeps the category name before the variant (`productPageTitle`,
unchanged). The category name suffix (`product_name_suffix`, «Допис до назви товару») was removed
on 2026-11-05 (owner); a stored suffix is ignored.


### Creating a typed draft (2026-10-26, local opt-in)

«Створити товар» loads saved category definitions and the existing vendors API.
Choose the vendor, name, optional single axis and typed attributes; enter a price
and integer stock for each initial variant. Up to 100 variants can be added or
removed before first save. No axis means exactly one variant with null value.
Blank price is an error, not zero; explicit zero/false are valid typed values.

The `product-create` command persists the exact POST body and UUID in the shared
pending-operation storage before sending `/products/admin/typed-drafts`.
After a lost response, reload and operation-status recovery resolve the existing
receipt without creating another product. Server-generated IDs, SKU and slug are
never supplied by the form. Each variant starts with the photos picked in the form, if any
(since 2026-11-15 — «Photos in the creation form» at the end of this document).

URLs are generated once from base name plus variant display value, excluding the
category SEO addition. Renaming leaves them stable. Existing descriptive URLs
are preserved; selective future changes require redirect-backed operations.

Validated with component tests and the real API/Mongo browser harness, including
lost successful POST responses and a mobile form overflow check. The persistent
localhost:9010 workspace was also verified with real JWT login and save/reload.


### Draft details editing (2026-10-26, local)

GET typed-draft now returns `details`: snapshot token, description (HTML/JSON or
null), variants[{id,price,stock,weight_g,images}]. PATCH accepts the optional same
object. Creation excludes details; first create the product, then open its details.
The rich-text/media/commerce section saves separately from typed attributes.
Existing typed-only requests still preserve all detail fields.

The token hashes the raw description and each variant's media/commerce fields
and price/stock timestamps. Stale details return 409 PRODUCT_DETAILS_CHANGED;
the screen then reads the product again by itself, so the next «Зберегти» carries
the fresh token (see «Product admin after the pre-release review» below). This complements
the catalog revision, since commerce may change without a catalog revision.
Membership must match exactly. Price is finite ≥0 and ≤1e9, stock is a safe
nonnegative integer, weight is null (unknown) or a positive integer ≤1e9 grams.
Images are ordered HTTP(S) URLs, max 30 per variant. Description HTML is sanitized
with the existing server helper. HTML and JSON are each bounded to 100k characters.

Only changed detail fields enter journal patches; the explicit
`draft-product-details` journal profile permits these fields while the default
profile continues rejecting commerce writes. Changed price/stock get their own
timestamps. Before/after-image comparisons refuse overwriting concurrent changes,
including during rollback. IDs, SKU, slug and promotion fields remain unchanged.

The UI reuses DescriptionBlock and ImageDropzone: first image is primary,
dragging changes order, removing detaches the URL without deleting storage files.
Existing presign/PUT/confirm upload runs before the mutation; any upload failure
blocks the mutation. Successfully uploaded items stay reusable on retry; uploads
that never become attached may leave unattached storage files; this change does not automatically delete them.
External S3 upload itself is not part of the isolated Mongo/browser acceptance.
Publication and adding/archiving already saved variants remain separate work.

### Variant lifecycle, Products navigation and readiness (2026-10-27)

After catalog control bootstrap, Products index/create/deep-edit routes mount the
new category-driven workspace. Before bootstrap they retain the legacy editor.
Unsupported v1/active products show an explicit error; the legacy editor is not
silently mounted behind the write barrier. Categories still provides the same editor.
`/admin/categories` switches «Дерево категорій» / «Попередній редактор» with one toggle (`Categories.tsx`
`ModeToggle`, a radio group with a sliding thumb and arrow keys, owner 04.11); while `legacy_writes_enabled` is
false — after the migration — the old editor's segment stays in sight but disabled, with the reason beside it.

A saved draft product supports add/archive/restore via optional `variant_action`
on typed PATCH, using the shared exact-body pending-operation recovery. Add requires
an axis, unique value including archived siblings, and fewer than 100 total SKU.
The server reserves the SKU and stable slug; the browser never invents identifiers.
Archive preserves all stored identifiers and commercial data; restore returns to
draft, not active. The last draft may be archived and restored later. No delete UI.

`readiness` returned by GET drives the saved-data checklist: required attributes,
description, a draft SKU, positive price, valid stock, and a photo. Unknown shipping
weight is a warning. False and zero are valid attribute values. Archived siblings
are excluded from completeness checks. This is shop data validation, not publication
or a guarantee of Google eligibility/ranking. Public v2 adapters remain pending.

The local admin runs on 9000 against API9002 and the separate v2 database. The
storefront regression suite uses 9100/19001 with isolated Next cache and refuses
port reuse, so it cannot accidentally address the developer's real API9001.


## Typed storefront (2026-10-27, local stand only)

v2 product categories render `TypedCatalogPage` from `GET /products/catalog/v2` (`/catalog` and groups
were listings too until 03.11 — now the hub, see «Catalogue hub» below); a flat v1 product category (filament) keeps the legacy
`CatalogPage`, colour filters and landings until it is migrated. The branch is in
`[category]/page.tsx` (`kind === 'group' || attribute_contract_version === 2`).

- **URL is the state** (`catalog/typed-filters.ts`): `f.<key>=value` repeated (a comma is
  part of a value), `f.<key>.min/.max` for a range, `category=`/`brand=` ids, `price.min/max`,
  `in_stock=1`, `sort`, `limit`, `page`. Only the scope's own filterable definitions are
  accepted — a group and the whole catalogue have none. Anything else fails the parse.
  Range bounds are plain decimals (≤ 10 integer digits, ≤ 6 decimals, `parseBound`): a price
  is never negative, a characteristic may be (`f.temperature.min=-20`, as on the backend). The
  inputs and the slider apply only a bound this parser reads back, so they never write a 404.
- **SEO matrix** (`typed-indexing.ts`, decided once for page and metadata): unknown input,
  page past the end or filters with zero results → `notFound()`; `?page=1` → permanent
  redirect keeping other parameters; filters/sort/limit or an empty listing → `noindex,follow`
  without canonical; otherwise self-canonical including `?page=N`; tracking params ignored. The
  tracking keys are one list (`TRACKING` in `typed-filters.ts`, shared with the hub through
  `trackingQuery`); a key missing from it is an unknown parameter, i.e. a 404 — it carries what ad
  platforms append by themselves (`utm_*`, `gad_*` beside `gclid`, `gclsrc`, `dclid`, `fbclid`, `ttclid`,
  `_gl`, mailer ids…; review 2026-11-14: `gad_source` was missing and every Google Ads click was a 404).
  `[category]/loading.tsx` and `products/[slug]/loading.tsx` were removed: with them the
  production build streamed a 200 before `notFound()`/`permanentRedirect()` even for
  crawlers (`htmlLimitedBots` did not help), so unknown categories, draft SKUs and invalid
  filters were soft-404s — on the live site too. Checked on a production build: 404/308 now
  reach users and bots; the cost is no skeleton while a category/product navigation loads.
- **Navigation** (`catalog-tree.server.ts` → `getCategoryNavLinks`): the public tree, all
  cursor pages of one revision, pruned to branches with ≥1 active SKU (global facet counts).
  Header/footer show roots; the mobile menu nests children recursively. «Каталог» leads.
- **Breadcrumbs**: listings use `Головна → Каталог → ancestors → node`; the product page
  uses the backend's `category_path`.
- **Product page**: the same component; v2 values come pre-formatted from the backend.
  `<title>` for v2 uses only the configured category addition (`''` = none), never the
  category name.
- Admin «Публікація» panel (Categories) sends the journal-backed publication command with
  the same persisted-key recovery as other tree commands.

Tests: `catalog/typed-filters.test.ts`, `common/utils/catalog-tree.utils.test.ts`; browser
rehearsal on the real API (`playwright.categories.config.ts`, last test): readiness data →
«Опублікувати» group and category → `/example-avr` range filter in the URL → reload keeps it →
product page crumbs → group tile → `?bogus=1` is a real 404.


## Migrated filament: colours, typed landings, old addresses (2026-10-27, local stand)

On the stand filament is a v2 category (see the backend `scripts/catalog-v2-migrate.cjs`).

- **Colour** — `color=<family>` (repeated) is accepted only when the category has a
  `semantic: 'color'` definition; the sidebar shows family swatches with self-excluding
  counts in dictionary family order, chips read «Колір: Чорний». Cards carry the
  dictionary colour, so the swatch and «Чорний (Black)» naming stay as before.
- **Typed landings** — `[category]/[landing]` renders `TypedRoute` with the landing's
  `filters_v2` pinned: pinned keys are removed from the visitor parser (an address that
  tries to change them is a 404) and always override the visitor's choice in the request
  (`withPinned`). H1/title/description/intro/bottom/FAQ (+FAQPage markup) come from the
  landing. A product category page shows its landings as pills («Популярні види»).
- **Exact landing match** — a narrowing exactly equal to a landing's pins (any order, no
  sort/limit) is one permanent redirect to the landing, page kept (`sameFilters`).
- **Old v1 addresses** — `?polymer=PLA,PETG&color_family=black&price_min=100` on a migrated
  category is translated (`legacyListingQuery`) and redirected once, tracking parameters
  kept; when it equals a landing it goes straight there. Unknown input stays a 404.
- **Home** — «Новинки» reads the typed catalogue at global scope (v1 and v2 alike).
- After a migration the storefront caches (categories/products/landings) must be purged;
  the dev server also holds them in memory — restart it.

## Editing published products (2026-10-27, local stand)

`/admin/products` (or a published v2 category's «Товари цієї категорії →») edits live products.
Each SKU has a «Статус» select (Активний / Чернетка / Архівний), as in the old admin; a new
variant defaults to «Чернетка» since 2026-11-15 (it was «Активний») and the create form offers «Статус» —
see «A whole product at creation» at the end of this document.
A colour axis is a dictionary select (`colorsApi.getAll`), never free text. After a save the
same product stays open (`productFocus`), and the message says the change is already live.
A draft category keeps the previous behaviour; requests from it omit `status`.

## Supplier ids, the PDF button and the sitemap (2026-10-28, local stand)

- **«ID на Промі» / «Артикул вендора».** The typed editor carries both per variant in «Опис, фото
  та ціни», in «Додати новий варіант» and in the create form, as the old variant form did
  (`supplierId` in `typed-product.schema.ts`: optional and nullable both ways). A blank field is
  sent as `null` (clears), so the backend's default applies to a new variant: our SKU as the
  article, no Prom link. `prom_id` is what the Prom price/stock sync keys on — without it a
  variant added after bootstrap would never be repriced.
- **Wholesale price list PDF.** After bootstrap `/admin/products` is `CategoryTreeWorkspace
  productsOnly`, which replaced the old products page together with its «Прайс-лист» button; the
  workspace header now renders `PriceListButton` (`admin/products/PriceListButton.tsx`, the same
  `PriceListModal` with categories from `GET /categories` — the visible product categories; since D06.2 (30.10) from `GET /categories/options`, all pages).
  Since 2026-11-06 the PDF is a stock extract — one table per category with its characteristic
  columns, quantity and price; the discount percents are gone from the dialog (the owner agrees
  wholesale terms with the buyer) and it defaults to landscape, which the columns need.
- **Prom sync «Відкладено».** `deferred` (default 0 for an older backend) counts variants the
  sync held back while a catalogue operation ran; shown only when non-zero.
- **`/catalog` in the sitemap** while the export lists any category (`buildSitemapEntries`), as the
  TD-0013 SEO matrix requires; an empty catalogue keeps it out.
- **Zero-count facet values** now come from the backend (`/catalog/v2` keeps values another
  dimension narrows to zero), so `TypedFilters`' muted rows finally appear and the lists no longer
  jump while filtering.
- **Navigation feedback without `loading.tsx`.** Without it a client navigation to a dynamic listing
  showed no feedback until the page's RSC arrived. Since 2026-10-28 (owner decision) the storefront
  layout renders `NavigationProgress` (below).

## Header «Каталог» panel (2026-10-28, owner request)

The desktop header no longer prints one link per root category — with a group and a category
the row overflowed and squeezed the search. `Header` takes `categories` and renders a single
«Каталог» (`common/components/CatalogMenu.tsx`): the label links to `/catalog`, the chevron
(a button with `aria-expanded`: Enter/Space, the tap on touch screens) and mouse hover open a full-width panel under the
header (keyboard focus does not open it since 31.10 — owner decision: Tab walks the header, not the tree; Escape
closes and returns focus to the chevron; a touch's emulated mouse events are ignored, so one tap opens it once) with every root node as a column and its descendants nested below, plus «Увесь каталог →».
It closes 150 ms after the pointer leaves (time to travel into the panel), on Escape and on
navigation. The panel's links are always in the markup and only hidden while closed, so the server
HTML of every storefront page still carries the whole tree (up to 150 links; above that two levels and lazy branches — «Large catalogue III», owner decision 30.10). «Каталог» is highlighted on `/catalog`
and under any category; the mobile menu and the footer are unchanged.

The desktop typed filter sidebar sits in the same card as the legacy `FilterSidebar` (white
`bg-card`, border, shadow, «Фільтри» heading); without it the filters lay on the dotted page
background while the product cards beside them were white. The mobile drawer keeps its own surface.

Filter order: «Ціна» and «Наявність» come first — they are common to every scope (any category,
group and `/catalog`; the backend counts them without any category configuration) — then
«Колір» (colour axis), the category's own dimensions in their configured
order, «Бренд». Price shows when the scope has at least two different prices, availability when
anything is in stock (or while either filter is set). Pinned by `TypedFilters.test.tsx`.

Range filters (price and every `filter_type: 'range'` characteristic) have a two-thumb slider
over the scope's bounds above the «від / до» inputs, as the legacy price filter did. The bounds are the
whole category's whatever else is selected (backend since 31.10, TD-0008 §4 F7), so a selected range never
shifts when another filter is ticked. Dragging
updates the inputs; releasing applies the filter (one URL change per release, not per pixel). A thumb
left at its end is no bound, so dragging back to the end removes it from the URL. The step is 1 for
integer bounds, 0.01 otherwise; the inputs stay for exact values. **Typed bounds apply without a button**
(owner, 2026-11-14 — «для чого кнопка, якщо воно автоматично застосовується»; TD-0008 had already refused a
«Застосувати» for filters, and the legacy price filter applied on blur): on Enter, or when focus leaves the
pair — a click elsewhere, Tab, a phone keypad's «Готово»; moving from «від» to «до» is not leaving, and
leaving without a change asks for nothing. A pair that makes no range is not sent — the reason stands under
the fields. Because such a range applies on the very click that ticks the next filter, `TypedFilters` builds
every change on what it last asked for (`requested`), not on the address still rendered — the address changes
a round trip later; two quick ticks no longer drop the first. The page does the same for its own controls
(review 2026-11-14, `requested` in `TypedCatalogPage`): a chip is removed from the last request, the order
keeps it, and a page link clicked while a request is on its way asks for that request again instead of
replacing it. The range form is never recreated by the address (it was keyed by its bounds and lost the focus
and a half-typed second bound when its own request landed): it keeps its text while the address says what it
asked for and takes the address's bounds otherwise; «leaving without a change» is judged by the address, so a
request that never reached it is asked again; and a blur that is the window or the tab losing focus applies
nothing. Tests: `TypedFilters.test.tsx`, `TypedCatalogPage.test.tsx`. The shared
`ui/slider` takes optional `thumbLabels` («Ціна: від» / «Ціна: до») for the thumbs' accessible names.

## Navigation progress bar and the products view (2026-10-28, owner decision)

`common/components/NavigationProgress.tsx`, mounted once in `(root)/layout.tsx`: a 2 px bar at the top
while a client navigation loads. It starts on a plain left click on an internal link to another page
(document capture listener — before `next/link` cancels the native navigation; new tabs, downloads,
other origins, the same URL and in-page anchors are ignored) and from `startNavigationProgress(href)`,
called right before the programmatic pushes of the legacy filters (`CatalogPage`), the typed filters
(`TypedCatalogPage`) and the search bar (a push to the current URL starts nothing). It completes when
`usePathname()`/`useSearchParams()` change, gives up after 10 s, and is shown only if the navigation
takes longer than 120 ms, so prefetched pages (SSG products) never flash it. Only the bar sits in a
`<Suspense fallback={null}>` (for `useSearchParams`): page content is still outside any boundary and
404/308 stay real — verified on a production build. Tests: `NavigationProgress.test.tsx`.

`/admin/products` (`CategoryTreeWorkspace productsOnly`) used to print «Ця категорія ще не підготовлена
до нового редактора товарів» for every non-draft category — the structure editor's `editable` rule —
right above the working product editor of a published (migrated) category. The message now shows only
for a v1 category; an archived one reads «Категорію архівовано — її товари не редагуються».


## Moving products; deleting and converting drafts (2026-10-28, local stand)

- **«Перенести в іншу категорію»** (`ProductTransferPanel`, under the product editor): targets are the
  other v2 product categories of the tree (draft or published, never archived or v1). Choosing one loads
  the server's proposal (`categoryTreeApi.transferPreview`): what is carried over (target label + value as
  read), what is lost (with the reason; a checkbox must confirm it), required values of the target
  (`ValueInput` per definition — mandatory for a published target, optional for a draft), an incompatible
  axis (blocks) and how many active variants become drafts. «Перенести товар» sends the shared command
  `{type: 'transfer'}` with the proposal + filled values + `confirm_dropped` through the same persisted
  Idempotency-Key flow; the workspace then follows the product into the target category.
- **Draft lifecycle** (`DraftLifecycle` in the category panel, v2 drafts only): «Перетворити на групу /
  на товарну категорію» and «Видалити чернетку» (two-step: «Так, видалити «…» назавжди»; a product
  category → group is two-step too, «Характеристики цієї категорії не збережуться.»). Both are disabled
  for a group with subcategories, and the server refuses anything in use; the copy explains how to empty
  a category first. New error texts in `categoryError` (`CATEGORY_IN_USE`, `TRANSFER_*`, `REQUIRED_VALUE`…).
- Checked on the stand (Playwright, real API9002): a draft category with a copy of the filament
  definitions (new keys) → «Kingroon PLA Gradient» moved into it (its page 404) → back into «Філамент» →
  its SKU re-activated → the draft deleted; the product and SKU documents are byte-identical to before.

## Typed landings in the category workspace (2026-10-28, local stand; F07)

`TypedLandingsEditor` (Categories → a v2 product category → «Посадкові сторінки», not in the products-only
view) lists the category's landings with status and the storefront `product_count` (red when 0, a note
for a landing not yet on the new contract) and opens `TypedLandingForm`: address (read-only once
published — an address change is a redirect-backed operation), H1, title/description with the soft
60/160 counters, pins (checkboxes per filterable definition — values from the admin filter preview of the
category, enum options, always including what is already pinned; min/max for range definitions; colour
families under a colour axis), intro/bottom text (the landing `HtmlEditor`), FAQ, tile image URL, order and
status, plus a two-step «Видалити чернетку сторінки». Saves go through the shared persisted-key commands
`landing-create` / `landing-update` / `landing-delete` (`categoryTreeApi.execute`). The form's count is the
admin preview over characteristics (drafts included, colour not counted); the list shows the real one
after saving. `/admin/landings` switches to a pointer at the category workspace once legacy writes are
closed (`LandingsWorkspaceGate`), as `/admin/products` does.

Checked on the stand (Playwright, real API9002): 14 migrated filament landings listed with the same
counts as the legacy counter; «pla» H1 edited and restored; a new «pla-black-f07» (PLA + Чорні) created,
published (9 products = `/catalog/v2` total for the same filters; public and in the sitemap), unpublished
and deleted (public 404).

## Category SEO, storefront settings and «до каталогу» (2026-10-28, local stand; F05/F11)

- **«SEO сторінки категорії»** (`CategorySeoEditor`, Categories → any v2 category, draft or published): title,
  description, H1, text above/below the listing, with a search-result preview that applies the storefront's
  fallbacks and the root title template (`… | Fillando`). Shared persisted-key command `{type: 'seo'}`.
- **«Вітрина»** (`/admin/storefront`, sidebar): the home page's copy (TD-0015, 2026-11-09 — strip, banner, side
  card, band; see «Home page and header» below) and collections (title + category + optional typed landing of
  it, or a product list); the home category tiles are gone (`home_category_ids` removed — the home menu is the
  tree). `PATCH /storefront-settings` with its own key/retry
  (a new key only when the body changes). The outcome message lives above the form, which remounts on the
  new revision. The page has the category page's look (owner, 2026-11-09): a header that stays on screen
  with «Є незбережені зміни» + «Скасувати»/«Зберегти вітрину» only while something changed, one white card
  per block (`ui.card`), the shared field look and `ui.arrow` ↑ ↓ × buttons.
- **Storefront**: `loadStorefrontSettings()` (`common/utils/storefront-settings.server.ts`, tag
  `categories`, decoration catch — an outage only drops these blocks; the home page itself reads the same
  address through `readStorefrontSettings()`, which throws on an outage — see «Home page and header») feeds
  the strip above the header
  (`(root)/layout.tsx`), the home page's banner, side card and band, and one `FeaturedProducts` strip per
  collection (`/products/catalog/v2` with the category and, for a landing, its pins; «Дивитися всі» → its path).

## Home page and header (TD-0015, 2026-11-09, local stand)

The home page is a marketplace's front (owner, sketch «Аврора»): nothing on it names a product or a category in
code — every word comes from «Вітрина» (the backend answers default copy until the first save) or the tree.

- **Layout** (`(root)/Home.tsx`): a first row `HomeCategoryMenu` · `PromoBanner` · `SidePromo`
  (`md:[220px_1fr]`, `lg:[240px_1fr_280px]`), then «Новинки» as one row (`FeaturedProducts layout='rail'`,
  `RailScroller` — arrows on a computer, swipe on a phone), `PromoBand`, the collections as grids. Without the
  settings (an older backend, an answer of an unknown shape — **not** an outage: since the review of
  2026-11-14 the page's own settings read, `readStorefrontSettings`, throws like its first «Новинки» read, so
  a failed regeneration keeps the previous prerendered page instead of caching one without its copy for an
  hour; the layout's read stays caught) the banner falls back to `OFFLINE_BANNER` — the shop's name as the H1 and
  «До каталогу» — and the side card, band and strip are not rendered.
- **`HomeCategoryMenu`** (as in the sketch, checked by the owner 2026-11-09): «Акції» — only while the
  whole catalogue's on-sale strip has products (`loadStrip({ filters: { on_sale: true } })`, the hub's own
  address, one Data Cache entry) — and «Новинки», both anchors of the hub's strips (`/catalog#akcii`,
  `/catalog#novynky`, `HUB_SECTIONS` in `catalog/catalog-hub.ts`; a strip has no address, and a listing
  parameter on the hub is a 404; the sections carry `scroll-mt` so the sticky header does not cover them).
  Then the first `MENU_ROOTS` (10) roots of the public tree (`getCategoryNavLinks`, the header's own links)
  in tree order, each with its admin photo as the icon (`/categories/slug/<slug>`, the category page's own
  read, caught — no photo or a failed read is a plain tile; the sketch's colours were invented, a photo is
  data), then «Усі товари» and «Прайс-лист», a chevron on every row. It shares a row with the banner, so a
  longer list would stretch both. Hidden below `md` — the phone has «Меню».
- **`PromoBanner`**: the banner's title is the page's only H1; `accent` (a substring of the title, the server
  refuses anything else) is wrapped in a gradient `<span>`. All text is server HTML above the canvas.
- **`AuroraBackground`** (client, home only): one fragment shader, no library, drawn at half resolution;
  starts on `requestIdleCallback` (300 ms timeout fallback), pauses off screen (`IntersectionObserver`) and in a
  hidden tab, one still frame under `prefers-reduced-motion`; the canvas fades in on `data-ready` and is
  `aria-hidden`. Without WebGL nothing starts and the banner's CSS gradient stays; a lost context stops the
  loop and gives the gradient back, and the context is released when the canvas leaves the page (review
  2026-11-14). The shader asks for `highp` where the GPU has it (`mediump` otherwise). **Give a dark block its
  colour and its gradient as two classes** (`bg-[#0b1220] bg-[image:radial-gradient(…)]`): one
  `bg-[radial-gradient(…),#0b1220]` is an invalid `background-image`, the browser drops the whole
  declaration, and white text lands on the light page.
- **`SidePromo`**: `action: 'wholesale-form'` opens `WholesaleInquiryForm` in a dialog
  (`common/components/wholesale/WholesaleFormButton`), `'link'` is a `<Link>` to an internal path.
- **Header** (`common/components/Header.tsx`, every storefront page): `StoreStrip` above it (the «Вітрина»
  lines and `CONTACTS.PHONE_DISPLAY`; none — no strip; a phone keeps the first line and the phone), then
  `MobileMenu` · logo · `CatalogMenu` + `SearchBar` (`md+`; the same `SearchBar` is the second row on a phone) · «Кабінет» (login link, or `UserMenu` whose trigger is the same icon-over-label action with the avatar — the name is inside the menu) ·
  «Кошик» (`aria-label='Кошик'`, so the count never changes the button's name — release E2E finds it
  `exact`). Below `md` the search is the header's second row. «Прайс-лист», «Опт», FAQ, «Контакти» are in the
  footer and `MobileMenu` only.
- **A grid strip shows full rows only** (`beyondFullRows` in `_home/FeaturedProducts.tsx`, owner 2026-11-10 —
  the sketch's collection is one row of 6): a strip of 8 is 6 cards on a computer (6 columns), 8 at `md`
  (4 columns) and on a phone (2); the cards past the last full row are hidden by breakpoint, not dropped from
  the HTML, and fewer cards than one row are all shown. Home collections and the hub's grids alike.
- **Sizes follow the sketch's CSS** (rendered side by side at 1440 px, 100 %, 2026-11-09): search 48 px,
  icon 22 px over a 12 px label for «Кабінет»/«Кошик», banner H1 34 px, a desktop first row of at least 400 px
  (`lg:min-h-[400px]` on the banner — the sketch's height came from its two example menu rows).
- **Fonts**: storefront body Onest (`--font-sans`), `font-display` = Unbounded for the home page's headings,
  the logo and — since 2026-11-14 (owner) — every heading of the catalogue hub, its H1 included; the admin
  wrapper keeps Inter (`admin/layout.tsx`). The H1 of a category and of a product stay Onest — a wide display
  face on long product names is hard to read; changing that is the owner's call.
  Geist Mono (the banner's eyebrow, price-sheet articles, `code` in descriptions) has `preload: false`.
- **LCP** (Lighthouse, 2026-11-11): on a computer the first photo of «Новинки» is a little larger than the
  banner's H1 and becomes the LCP, so the home page passes `eagerCards={1}` — that card preloads with
  `fetchPriority='high'`, the rest stay lazy (on a phone the row is below the fold). Both strip layouts size
  their photos with one measured `STRIP_IMAGE_SIZES` (`_home/FeaturedProducts.tsx`) — the same product often
  stands in «Новинки» and in a collection, and two values picked two derivative tiers of one photo (a double
  download on a phone). It matters once `NEXT_PUBLIC_USE_IMAGE_DERIVATIVES` is on.
- **A strip card is a product** (owner, 2026-11-14; `_home/StripProductCard.tsx`): a product arrives with all
  its colours at once, so «Новинки» — the 8 newest SKUs — was one product seven times, and the colour at the end
  of the name was cut off: seven cards that read as copies (302 SKUs are 45 products). Strips now read
  `GET /products/catalog/v2/strip` (`stripUrl`; one card per product — its first SKU and `group`: the product's
  name, how many SKUs, how many in stock and on sale, the price range over the in-stock ones, up to 12 colours). The card
  prints the product's name, up to `CARD_SWATCHES` (7) swatches and «+N», «N кольорів», «від N ₴» when the
  prices differ and «Обрати колір» — a link to the first SKU's page, where the switcher is; SKUs that are not
  all colours are «N варіантів» / «Обрати варіант», and no value is passed off as a colour. A group of one SKU
  (a one-SKU product, or the one SKU on sale in «Акції») keeps its own price, the struck regular price and
  «В кошик», its colour on a line of its own; the cart line still carries the SKU's name (`useCardCart`, shared
  with `CatalogProductCard`). A product's card carries «−N %» only when every SKU of its group is on sale
  (`group.on_sale === group.count`) — one discounted colour does not badge the other six.
- **A strip card never promises what cannot be bought** (owner, 2026-11-14: «як у найкращій практиці»): «від»
  is the lowest price among the SKUs in stock (the backend's `price_min`; of a sold-out product — what it
  costs, on a greyed card that says «Немає в наявності»); a sold-out colour stays in the row of swatches,
  faded (`colors[].in_stock`), in-stock ones first; and when only some SKUs are in stock the count line says so
  — «10 кольорів · 1 у наявності», «3 варіанти · 2 у наявності». **No word of the admin's is ever declined**:
  the card prints «колір / кольори / кольорів» only when every SKU of the group has its own dictionary colour
  (any category with colours, nothing about filament), and «варіант / варіанти / варіантів» + «Обрати
  варіант» for every other variation — a characteristic's own name («Номінальний струм») is never put into a
  phrase, because its plural and case cannot be derived. No «Арт.» line: a product has no one article. The catalogue grid and the search
  are unchanged — one card per SKU.
- **One or two products are row-wide cards** (`WIDE_CARDS_MAX` in `FeaturedProducts`, grid and rail alike): a
  grid of six with one card in it read as broken markup, and a shop of 45 products meets that often (one
  product on sale is one card). Two share the row from `lg`.
- **Below the first row, by the mock of 2026-11-14** (owner: the first row «гарно», the rest «щось не те»;
  mock https://claude.ai/artifact/C12tBPY9eZkjGnEnn6WZqh). Measured on the stand: the collection over the main
  category repeated «Новинки» — five products of six, both being «the newest» — and the rows under the first
  screen were three strips of one shape in a paler manner than the row above them.
  - **No product twice on the page** (`_home/shelves.ts`, `dedupeShelves`): a shelf skips what «Новинки» or a
    shelf above already shows and takes the next products; a shelf with nothing new is not rendered. A list
    the admin picked by hand (`filters.product_ids`) is shown as picked — skipping one of its products would
    be the code overruling the list — and whole, not cut to five (owner, 2026-11-15; see the shelf below),
    and all of it counts as shown for the shelves below. For this the home page reads
    `SHELF_FETCH` (24, the backend's limit) per collection instead of the strip's eight: with eight, the
    collection over the main category had one card left. Another `limit` is another Data Cache entry than the
    hub's strips, with the same `products` tag.
  - **A collection is a shelf** (`_home/CollectionShelf.tsx`): a dark cover in the manner of the card beside
    the banner — the photo, the «Вітрина» title, the count, «Дивитися всі» — and `SHELF_CARDS` (5) cards
    beside it from `xl`, four below (the fifth hidden by breakpoint, kept in the HTML). Below `lg` the cover
    is one compact row (photo, title, «N товарів · дивитися всі», a round arrow) over the cards: two columns
    and two rows on a phone, one row of four from `md`. One or two products are row-wide cards beside the
    cover. The photo and the count are what the collection points at (`shelfCover` in `Home.tsx`): its
    landing — the admin's tile image and the landing's own count, read through `loadCategoryLandings` — else
    its category — the photo its hub tile shows and the tree's count. A list picked by hand points at
    nothing: a plain cover, «До каталогу». All of it decoration (caught): an outage costs the photo or the
    count. Nothing knows a category. The title is the shelf's `<h2>`, inside the cover link.
  - **A list picked by hand is a row that scrolls, with every product of it** (owner, 2026-11-15: «картки
    полиці стають рядом із гортанням, як „Новинки“; на головній видно всі обрані» — a departure from the
    approved shelf mock, chosen knowingly). A category's or a landing's shelf has a page behind «Дивитися
    всі»; a picked list has none, so cut to five its products 6–24 stood on no page. `Home.tsx` passes
    `rail` (`isPickedList`), and `CollectionShelf` puts the cards into `RailScroller` beside the same cover:
    cards as wide as on the other shelves (`SHELF_ROW` — five from `xl`, four from `md`), on a phone the
    compact cover row and under it a swipe row of two cards and a hint of the third. The row is the region
    named by the title (the section gives its own name up, so there is one), inside a `min-w-0` wrapper —
    below `lg` the section is one content-sized column and two dozen cards would stretch the page. One or
    two picked products stay row-wide cards. The shelves of categories and landings, and the hub, are
    unchanged. `RailScroller` takes `columns` for this; «Новинки» keeps its own (six from `lg`).
  - **The band is dark** (`PromoBand`), the colour and the glow as two classes like the side card; on a phone
    its button takes the width.
  - **`RailScroller` hides an arrow with nowhere to go** — «назад» stood over the first card of a row nobody
    had scrolled. `invisible` + `disabled`, not unmounted: the button under the pointer must not drop its
    focus to the page at the end of the row. The server's guess is «at the start, more to the right». The
    row carries `data-lenis-prevent-horizontal`: Lenis takes every wheel event with a vertical part, and a
    sideways touchpad swipe has one.
  - Tests: `shelves.test.ts`, `CollectionShelf.test.tsx`, `RailScroller.test.tsx`, `Home.test.tsx` (shelves
    without repeats, the landing's and the category's cover, the 24-product read, the tree as decoration).
  - **A live background on the dark cards** (owner, 2026-11-14, after seeing the shelves on the stand: «цим
    карткам теж треба гарний живий фон»): the band and every cover carry `CardAurora` — the banner's «Аврора»
    (`AURORA_FIELD`, exported from `AuroraBackground.tsx`; the banner's own shader string is unchanged) with an
    even, dimmer light, because text stands anywhere on a card. **One WebGL context for all of them**
    (`_home/aurora-cards.ts`): the field is drawn once a frame at 480 × 300 and each card paints its own cut
    of it (`cutOf`, placed by the card's `shift`) on a 2D canvas at half its size. A context per card would be
    up to thirteen shaders on a page of twelve collections; measured on the stand — two contexts on the page
    (the banner's and the cards'), whatever the number of shelves. The context is created when the first card
    comes on screen, only cards on screen are painted, nothing runs in a hidden tab, «менше руху» gets one
    still frame, and without WebGL the card keeps its CSS gradient (the canvas stays `opacity-0` until a frame
    is on it). The side card «Купуєте оптом?» keeps its still gradient — it stands beside the banner.
    «Менше руху» is answered in `schedule`, the one place a frame is requested (the tab coming back into
    view used to start the loop), and a lost context stops it — the cards keep their last frame.
    Tests: `CardAurora.test.tsx` (no context — nothing starts; the cuts), `aurora-cards.test.ts` (the loop).
  - The hub keeps its plain strips: the mock is of the home page.
- Tests: `Home.test.tsx` (menu, copy, collections, offline banner, menu cap, no band, the one eager card),
  `_home/FeaturedProducts.cards.test.tsx` (eager cards, strip sizes, row-wide cards),
  `_home/StripProductCard.test.tsx` (product, one SKU, variants, sold out, row-wide), `StorefrontSettings.test.tsx`
  (copy sent whole, client-side refusals), `StoreStrip.test.tsx`, `AuroraBackground.test.tsx` (no WebGL).
- **`/catalog` intro** is storefront copy in code, not a setting (owner, 2026-11-03):
  `catalog/catalog-intro.ts` (`CATALOG_INTRO_HTML`, `null` renders nothing), drafted in fillando-meta
  `docs/plans/plan-0010-d07-content-drafts.md`. A category's own text stays in «SEO сторінки категорії».
- **F11 transitions**: the empty-cart redirect and link on checkout, «Продовжити покупки» after an order, the
  cart drawer's empty state, the hero CTA and «Усі товари» under «Новинки» now lead to `/catalog`
  (`UI_URLS.CATALOG.ROOT`), not `/filament`. The outage fallback menu still lists «Філамент».

Checked on a production build against the stand API: home tiles and the «PLA філамент» strip with a link
to `/filament/pla`, the `/catalog` intro, and the demo AVR category's saved title/description/H1/intro;
then the test settings and SEO were cleared.

## Feed export rules in the category workspace (2026-10-28; B10)

`CategoryExportEditor` (Categories → a v2 product category → «Google Merchant (фід)»): Google taxonomy id +
path (both or neither), the characteristics appended to the Merchant title and printed as
`product_highlight` (checkbox order = feed order, shown as «Порядок: …»), five custom labels (blank keeps the
computed label; a warning not to set them for filament — the running campaigns segment by them). Shared
persisted-key command `{type: 'export'}`.

## Address changes with redirects (2026-10-28, local stand; B07/F10)

- **Storefront**: `redirectIfMoved(segments, searchParams)` (`common/utils/moved-route.server.ts`) runs in the
  404 branches of `[category]` (page and metadata), `[category]/[landing]` and `products/[slug]`: for
  slug-shaped segments it asks `GET /routes/resolve` (tags `categories`/`products`/`landings`, which the
  backend revalidates after a change) and issues one `permanentRedirect` (308) to the current address, query
  kept. A 404 from the lookup is «not moved»; any other failure throws (a 5xx is safer than an indexed 404).
- **Admin**: `SlugChange` («Змінити адресу» → new slug → «Змінити з перенаправленням», with the note that the
  old address redirects forever) on each SKU row of «Керування варіантами», in the category panel (v2 draft or
  published — its own availability flag, the rest of the panel stays draft-only) and on a published typed
  landing. Shared persisted-key command `{type: 'slug', target, id, body}`.
- `robots.txt` blocks only `/admin/`, `/account/`, `/profile/`, `/auth/`: filtered listings stay crawlable,
  so their `noindex, follow` is seen (SEO matrix).

Checked on the stand + a production build: the SKU «Kingroon PLA Gradient», the demo AVR category and the
«pla» landing moved via the admin; `/products/kingroon-pla-gradient-rainbow`,
`/local-transfer-switches?sort=price_asc` and `/filament/pla?page=2` answered one 308 to the new addresses
(query kept), the new ones 200, the sitemap listed only the new ones; then all three were moved back and
the test aliases removed.

## The product card as product data (2026-11-05, owner decision; was F08 «category data»)

Data that belongs to a product lives in the product; the category is only navigation, its Google category and
the list of characteristics (owner, 2026-11-05).

- **Category presentation removed.** The «Сторінка товару» card (`TypedPresentationEditor`, command
  `presentation`, `GET|PATCH /categories/:id/admin/presentation`, `category-presentation.schema.ts`) and the v1
  «Характеристики в картці товару» editor of `CategoryForm` (`CategoryPresentationEditor`,
  `categoryPresentationSchema`) are gone; the v1 create/update body sends no `presentation`, product detail
  carries no `category_presentation`, and the definition usage no longer has `settings` («налаштування
  «Картка товару»»). Its parts went where they belong:
  - order of the specification rows → the definitions' `order` in «Характеристики та фільтри»;
  - «Приховати» → the definition's checkbox «У таблиці характеристик на сторінці товару» (`visible_in_specs`;
    the summary badge «На сторінці товару»), applied by the backend — the page prints what arrives;
  - «Помітні значення» (bold/amber values) → dropped; no row is emphasised;
  - value notices («Попередження перед покупкою», photo badge) → a field of the product (below).
- **Purchase notice is product data.** «Попередження перед покупкою» in the typed product editor
  (`ProductPurchaseNoticeEditor`, white card: «Показується над кнопкою «В кошик» лише в цього товару, напис —
  поверх фото.»): Заголовок, Текст, Напис на фото (необов’язково). It reads `details.purchase_notice`
  (`{ title, text, badge | null } | null`) and saves through the details PATCH with the stored description and
  rows; three empty fields send `null` (removed), the other cards omit it (kept). Client check
  (`purchaseNoticeInput`): title and text both filled or both empty, the photo text only with them; limits
  120 / 1000 / 40, plain text.
- **Storefront card** (`ProductPage`): a v2 page (`attribute_notice` present in the payload — the key kept its
  name, it is now the product's `purchase_notice`) takes the notice and the photo badge from the product and
  never falls back to `ATTR_NOTES`, the «Без котушки» constant or `REFILL_VARIANT_PATTERN`; a v1 page keeps
  them until the migration retires v1.
- **Brand is explicit.** A characteristic's meaning («Значення характеристики») has «Бренд» (`semantic:
  'brand'`, one per category, text or list; checked in `definitionsInputSchema` before the request), with the
  hint «Бренд для фіду Google і розмітки сторінки: товар без нього не потрапить у Google Merchant.» The
  backend takes a v2 product's brand from its brand entity, else from that characteristic — never from a label
  like «Виробник»; `product.manufacturer` feeds JSON-LD `brand` and GA4 `item_brand` only. **No brand chip
  above the title** (owner, 2026-11-08: the page shows what the admin configures) — the brand is a row of the
  table when its characteristic has «У таблиці на сторінці товару»; the filament migration no longer hides
  `vyrobnyk`. A new product category starts with «Виробник» as its brand (backend default), and the editor warns
  while no required characteristic is the brand: «Немає обов’язкової характеристики з призначенням «Бренд»:
  товари цієї категорії не потраплять у Google Merchant.» The feed's `missing_brand` reads «Немає бренду: ні
  бренду товару, ні характеристики з позначкою «Бренд»».
- **«Інша комплектація» removed (owner, 2026-11-04).** The refill ↔ spool link (B08) is gone end to
  end: the product editor panel and its `relations` command, `GET/PUT /products/:id/admin/relations`,
  the category's `alternative_label` («Підпис посилання на іншу комплектацію»), `spooled_counterpart`
  in the public product payload and, on the product page, the «на котушці — X ₴» line under the
  price and the «Обрати варіант …» link in the notice — on v1 and v2 pages alike (the v1 sibling
  lookup `refill.utils.ts` went with it). The refill notice and its photo badge stay.
- **Stale reads** in the workspace editors throw `CatalogChangedError`, which `categoryError` shows
  as «Каталог змінився. Оновіть дерево.» — before, the message fell through to «Результат запиту
  потребує перевірки». That sentence («…Перевірте стан операції нижче.») is now only for a write whose
  key is kept (`categoryError(error, true)`, the workspace's `send`); a read or a refusal that released
  the key says «Запит не виконано. Оновіть дерево й спробуйте ще раз.», and `CATALOG_MAINTENANCE`,
  `CATALOG_READ_CHANGED`, `CATEGORY_NOT_DRAFT`, `CATEGORY_NOT_ACTIVE`, `CATEGORY_HAS_ACTIVE_CHILDREN` have
  sentences of their own (`PUBLICATION_TOO_LARGE` is gone: the backend sends `PUBLICATION_CHANGED`).

History (F08, 2026-10-28 → 11-04): the card was category data — «Картка товару», later «Сторінка товару», with
the order of characteristics, «Приховати», «Помітні значення» and value notices; «Допис до назви товару» and
«Ховати без одиниці» were removed on 05.11 before the whole card was.

## ProductGroup structured data (2026-10-28, local stand; F09)

`buildProductJsonLd` follows the multi-page variant model of the SEO matrix: with more than one public
SKU and a supported axis (`variant.color` on v1, `variant_type.semantic` `color`/`size`/`material` on
v2) the page carries a `ProductGroup` (`productGroupID` = product id, `variesBy`, name without the
variant value, brand/description, `hasVariant` = this SKU's full `Product` + URL-only siblings, no
`url`); a generic axis keeps a `Product` with `inProductGroupWithID` and `additionalProperty`; a
single SKU is a plain `Product`. v2 `material`/`size` come from `semantic_values` — the backend's
shared rule with the feed (`g:material`), so page and feed state the same material. Checked in the
SSR HTML of the stand: PETG Translucent (colour group, 8 SKUs, material PETG), the demo АВР (current
as `additionalProperty`, no invented brand), the refill (single `Product`). Live Rich Results /
URL Inspection — R03.

## Large catalogue (2026-10-28, local fixture; B05/B06)

The backend counts the «Категорія» facet over every product category in scope only up to 100 of them;
above that (a big group, `/catalog` of a large shop) it returns only the selected categories, so the
sidebar section appears only while something is selected (to untick it) and the sub-category tiles do the
navigation. No FE change was needed: `TypedFilters` already hides the section below two values unless a
category is selected, and chips name the selected ones from the same facet. Measurements and the
remaining whole-catalogue limit are in the Plan-0010 M0 evidence.

### Large catalogue II (2026-10-29, third session; B05/F10, D06)

- **Sitemap in files.** `/sitemap.xml` is the one `<urlset>` while the backend export has one part (the
  current catalogue — byte-identical to before), and a `<sitemapindex>` of `/sitemap/<n>.xml` once it has more;
  each backend part is below 50 000 URLs and 2 MiB, one revision for the whole crawl (`docs/http-service.md`,
  «Sitemap»; BE `CATEGORY_TREE.md`, «Large catalogue II»). Same SEO matrix and URL set: public non-empty nodes,
  `/catalog`, landings, products. On the 10 000-category fixture: 5 files instead of one 7.1 MB export.
- **Home hero.** The home page reads the filament category by slug (`/categories/slug/filament`, the category
  route's own URL and tags) instead of the list of every product category — 17.7 MB at 10 000 categories and
  above what the Data Cache keeps. The list is still the fallback when there is no filament product category.
- **Known limits at that size (not changed here):** the header «Каталог» panel renders the whole public tree in
  the server HTML of every page, and its branch counts come from the whole-catalogue category facet, which the
  backend returns only up to 100 product categories — above that every branch counts 0 and the header falls back
  to the static links. Both need a navigation design for big catalogues (lazy panel, counts per branch) before
  the shop grows past ~100 product categories; measurements in the Plan-0010 M0 evidence.

### Large catalogue III (2026-10-30; Plan-0010 D06.1–D06.5)

- **Navigation past 100 product categories** (D06.5, owner's decision 30.10 — «два рівні в HTML»). The tree's
  branch counts come from `GET /products/catalog/v2/category-counts` (every page; tag `products`), which has no
  100-category limit — before, the whole-catalogue category facet was empty above 100 product categories, the header
  fell back to the static «Філамент» link and `/catalog` and group pages lost their sub-category tiles. A backend
  without the endpoint (404) is read as before, from the facet. `categoryNavLinks` keeps the whole non-empty tree up to
  `NAV_FULL_LINKS` (150) category links — the current catalogue's header HTML is byte for byte the same; above it the
  server HTML carries the roots and their sub-categories (at most `NAV_BRANCH_LINKS` = 30 per branch, the rest
  «Усі (N) →» to the branch page), and a deeper branch is a `lazy` link: the desktop panel (`CatalogMenu`, a chevron
  after the link) and the mobile menu (`MobileNavItem`) load its sub-categories from `GET /api/catalog-nav/<id>`
  (`app/api/catalog-nav/[id]/route.ts`, one level from the same cached tree; `useLazyNav`, one request per branch
  per page). `buildCatalogTree` and `findTreeNode` are iterative (a 20 000-level chain fits the stack), and the
  catalogue tiles get their nodes without descendants (the client payload of `/catalog` was 2 MB at 10 000
  categories). Measured on the 10 000-category fixture (production build): every page 230–470 KiB with 240
  category links, instead of ~2.3 MB with the whole tree or a broken menu.

- **No reader of the old category list.** The admin reads its category selects and lists from
  `GET /categories/options` (all pages, `categoriesApi.getOptions`, React Query key `['categories', 'options']`)
  and one category's characteristics from `GET /categories/:id` (`['categories', 'by-id', id]`):
  `categories.queries.ts` (`useCategoryOptions`, `useCategory`, `useCategories`, `syncCategory`). Moved: the legacy
  categories editor (list from options with `attribute_count`, the edited category by id), the legacy product
  forms (select from options; the required attributes of the selected category by id — a re-seed waits until the
  category of the current id has loaded), the landing form/table/pinned filters (labels only for the categories the
  rows pin into), the products page and `PriceListButton`/`PriceListModal` (id and name only). The home hero falls
  back to the first item of `GET /categories/options?limit=1` (same category as the old list's first). The backend
  keeps the old `GET /categories` unchanged for the storefront released before Plan-0010 until R04; this FE only
  `POST`s to `/categories` (legacy create).
- **Category paths too long to embed** (BE `CATEGORY_TREE.md`, «Large catalogue III»): a detail past 1 MiB of
  ancestors answers `ancestors: []` + `ancestors_paged` (category) or the category alone + `category_path_paged`
  (product). The category route and the product page then read the whole path on the server with
  `loadCategoryAncestors` (`catalog-tree.server.ts`, all pages of `GET /categories/:id/ancestors`, one revision, tag
  `categories`); the product page gets it as `categoryPath` so a client re-read cannot shorten the trail. The trail
  and `BreadcrumbList` stay complete in both cases; at any ordinary depth nothing changes.
- **Feed screen**: the «виключено з фіда» KPI reads `excluded_count` (the list is the first 500 by SKU) and, when the
  list is a sample, says «Показано перші N з M» with the counts by reason; an older backend without the totals is read
  as before.

## Published categories stay editable; the old admin's remaining abilities (2026-10-29, local stand)

After the migration the filament is a published v2 category and the legacy writes are closed, so the new admin
must cover everything the old one could (Plan-0010 «не гірше за стару адмінку»; BE `src/docs/CATEGORY_TREE.md`).

- **Category card** (`EditCategory`): a published category edits its **name and tile image** (`type: 'details'` →
  `PATCH /categories/:id/admin/details`; the image is uploaded through the S3 presign flow, `categoriesApi.uploadImage`,
  and sent only when it changed; «Прибрати зображення» sends `null`) and its **order**; the parent select is
  disabled — moving and deleting stay draft-only. The admin tree item carries `image`.
- **The category page** (owner 04.11: «нереально зрозуміти що для чого потрібно») is white cards, each with its title
  and one sentence on what it sets and where the shopper sees it (`SettingsCard`; the button is named by the title):
  «Сторінка категорії на сайті» (SEO), «Google Shopping» (export rules),
  «Посадкові сторінки», «Товари категорії». The two previews under the characteristics (a disabled product form and
  value-less filters) were removed; «Скопіювати з категорії» shows only while nothing uses the characteristics;
  «Перевірити фільтри на товарах» stays folded. Inputs are white on white cards.
- **Characteristics** (`CategoryDefinitionsEditor`) are editable on drafts and published categories. They are a list
  of one-line summaries (owner 04.11: eleven open forms were «візуальна каша») — name with `*`, type and unit, usage,
  badges «Фільтр»/«На сторінці товару»/«Кілька значень»/meaning, «змінено» — and «Редагувати» unfolds one
  characteristic's form in three titled groups («Назва й тип», «Де видно покупцю», «Значення») with the locks in one
  amber note; a new one opens at once, a failed save unfolds the rows it names, saving stays one request, and the row
  toggles stay usable on a read-only category (only inputs and actions are disabled). It loads
  `GET /categories/:id/admin/definition-usage` for the same revision and shows per characteristic its usage («36
  товарів, 301 SKU, 2 посадкові сторінки»; the «settings naming it» part left with the category presentation on
  05.11). It locks only what the server would refuse:
  type, «Кілька значень» and meaning of a used key; removal of a used key or option (option usage shown beside it);
  the filter flags of a key landings pin; «Обов’язкова» in a published category while products lack the value (with
  the count, in the locative: «значення немає в 44 товарах»); the unit of a key a product or SKU holds a value of (the
  field is locked with the count — values are never recalculated; owner decision 31.10, server `DEFINITION_UNIT_LOCKED`). «Скопіювати з категорії» is off once anything is used. A published category shows that saved changes
  are live. Refusals that still reach the server are explained with its counts (`categoryError` → `definitionRefusal`,
  `describeUsage`). If the usage read fails the form still works and says the server will check.
- **Product editor**: the supplier select (`vendor_id` sent only when changed; the list is loaded by
  `TypedProductEditor`, not inside `ProductForm`); promotions in «Опис, фото та ціни» — per SKU «Акція, %» / «Акція до»
  and «Акція на весь товар» (fills every row, saved with the same button). Only rows the admin touched send promo
  fields, so an ended promotion (named, not prefilled — as the old `VariantModal`) is never resent; the sale-price
  preview uses `previewSalePrice` and warns below `variants[].supplier_price`. «Керування варіантами»: two-step
  «Архівувати всі варіанти» (`archive_all`; the question names how many active SKUs leave the sale), two-step
  «Видалити» for an inactive SKU (`delete`) and «Видалити товар»
  (`type: 'product-delete'` → `POST /products/:id/admin/deletion`; disabled while a SKU is active; the list opens
  afterwards). Server refusals (`VARIANT_IN_USE`, `PRODUCT_IN_USE`, …) say to archive instead.
- **Colours** (`/admin/colors`): `colorsApi` asks `GET /categories/admin/capabilities` on every write; once
  `legacy_writes_enabled` is false it writes through `/colors/admin/entries`, `/colors/:id/admin` (the whole entry,
  the edit merged into the stored row) and `/colors/:id/admin/deletion` with the catalogue revision and a fresh
  Idempotency-Key, then rereads the row — the form and table are unchanged. Coded refusals become sentences
  (`COLOR_IN_USE` keeps the old «Колір використовують N варіант(ів)…»).
- **Landing tile image**: «Завантажити зображення» (S3, `uploadEntityImage('landing', …)`) beside the URL field.
- **Re-publication** of a colour-axis category no longer skips its SKUs (BE); the skip reason
  `COLOR_AXIS_MISMATCH` has a label.

Tests: `CategoryDefinitionsEditor.test.tsx` (usage, locks, refusal text), `CategoryTreeWorkspace.test.tsx` (published
details/order), `ProductDetailsEditor.test.tsx` (promotion), `ProductVariantsEditor.test.tsx` (archive/delete),
`TypedProductEditor.test.tsx` (supplier), `TypedLandingsEditor.test.tsx` (upload), `colors.api.test.ts` (both modes).
Stand (Playwright): renamed/reordered/re-imaged and re-labelled the published filament, added and removed a
characteristic, server refusals with real counts; colours created/edited/refused/deleted; supplier, promotion
(storefront sale price) and product removal on the demo AVR — data byte-identical afterwards.

## Published moves, product category → group, curated product lists (2026-10-29, second session; B02/F02, B09/F05)

- **Moving a published category** (`EditCategory`): the parent select is enabled for a published category too, but
  `allowedParents(items, id, { publicOnly: true })` offers only the root and published groups — the server refuses
  anything else with `CATEGORY_PARENT_NOT_PUBLIC` (the branch would vanish from the storefront). Addresses never depend
  on the tree, so the copy says a move changes menus and breadcrumbs, not URLs.
- **«Перетворити на групу з розподілом товарів»** (`CategoryConversionPanel`, draft or published product category):
  loads every product (all cursor pages of `typedProducts`) and typed landing, lets the admin send each to another v2
  product category («Усі товари й сторінки в» + «Призначити всім», then per row), optionally «Перенести цільові
  категорії в нову групу» (`adopt_targets`, on by default), and asks `POST /categories/:id/admin/conversion-plan`.
  Problems and warnings are sentences built from the codes with product names, landing paths and category names; only
  a plan with `plan_id` offers the two-step «Перетворити на групу», which submits the `convert` command with
  `plan_id` through the workspace's persisted-key flow. Any change of the distribution drops the checked plan; a new
  tree revision remounts the panel. The empty-draft «Перетворити на групу» (`DraftLifecycle`) is unchanged.
- **Curated product lists** («Вітрина» → «Додати добірку товарів»): a collection is a category/landing or
  `product_ids` (category, then product, «Додати товар», reorder, remove; names of saved products are read back by
  `typedProduct`). The home page queries `/products/catalog/v2` without `category_id` and with `filters:
  {product_ids}` — visible categories only, the admin's order under the default sort — and links «Усі товари» to
  `/catalog`, because a list has no page of its own. Brands on the home page are out of scope (owner, 29.10).

Tests: `CategoryConversionPanel.test.tsx` (all pages loaded, targets, plan request, problem sentences, submit),
`CategoryTreeWorkspace.test.tsx` (published move under a published group only), `StorefrontSettings.test.tsx` (product
list order and names). Stand (Playwright, real API 9002): «АВР» moved to the root and back; converted into a group by the
wizard (its 3 active SKUs now in a published child, product pages 200 with three-level breadcrumbs); a product list
«Kingroon PLA» + «PETG Translucent» saved in «Вітрина» and rendered on the home page — then the stand data restored
byte for byte.

## Owner decisions on the audit (31.10.2026, local)

- **Transitional pagination** (`typed-indexing.ts`, `LEGACY_LIMIT` in `typed-filters.ts`; revisit after the Search
  Console baseline D02): the legacy listings had 12 per page. At the default 24, `?page=N` past the end is one 308 to
  page ⌈N/2⌉ when it exists, otherwise 404; `?limit=36` is read as 48 and redirected to `limit=48` when its page
  exists. Existing pages and an explicit `limit=12/48` are untouched; other parameters and attribution are kept.
  Stand: `/filament?page=20` → `?page=10`, `?page=27` → 404, `?limit=36&page=2` → `?limit=48&page=2`.

## Audit 31.10.2026 (local)

- **Cursor walks restart once, uncached, when the catalogue moved.** `loadCatalogTree`, its counts and
  `loadCategoryAncestors` read through one `walk()` (`common/utils/catalog-tree.server.ts`): pages from the Data
  Cache, and on a 409 (`CATEGORY_REVISION_CONFLICT`, `CATEGORY_COUNTS_CHANGED`) or two revisions in one walk the
  whole walk once more with `cache: 'no-store'`; a second change throws. Every catalogue write moves the revision
  the cursors are bound to, but a product, landing or colour edit purges `products`, not `categories`: page 1 of the
  older revision stayed cached up to an hour and every `/catalog` page answered 500 once the tree took more than one
  page. The tree is read in pages of 1000 (the backend's maximum; was the default 200) with a budget of 1000 pages —
  the former 100 × 200 = 20 000-node ceiling broke every catalogue page above it. Tests: `catalog-tree.server.test.ts`.
- **A category hidden between its detail and its path** (`ancestors_paged`): `loadCategoryAncestors` answers `null`
  and the category or product page answers 404 instead of 500 (`products/[slug]/page.test.tsx`).
- **`/api/catalog-nav/<id>`** answers 503 `{links: []}` with `Cache-Control: no-store` when the tree cannot be read
  (was a bare framework 500).
- **Lazy menu branches** (desktop panel and mobile menu): `aria-controls` → the sub-list, `aria-busy` while
  loading, the loading line `role="status"`, the failure `role="alert"` with «Спробувати ще»; reopening a failed
  branch retries too, and the old error is no longer shown during the retry (`navigation-large.test.tsx`).
- **Exact landing redirect keeps attribution and respects the page range.** A narrowing equal to a published
  landing redirects with the page and the tracking parameters (`utm_*`, `gclid`, … — `landingRedirect`,
  `trackingQuery`); a page past the end stays the 404 it is instead of a 308 to a 404 (stand:
  `/filament?polymer=PLA&gclid=abc` → `/filament/pla?gclid=abc`, `?f.polymer=PLA&page=50` → 404).
- **Old addresses**: `redirectIfMoved` now has its own tests (`moved-route.server.test.ts`). Known gap: a moved
  category reached with a legacy filter query takes two hops (`/{old}?polymer=PLA` → `/{new}?polymer=PLA` →
  `/{new}/pla`) — the SEO matrix asks for one; an old SKU address drops its query (ISR page) — documented, not changed (owner decision 31.10; TD-0013 SEO matrix, row «Старий URL»).
- **Admin messages**: `LANDING_SLUG_TAKEN` and `PRODUCT_IN_USE` now name the old address of another page and a
  curated storefront collection (the backend refuses both since this audit).

## Catalogue hub (Plan-0010 P20, 2026-11-03, local)

Owner, 03.11: on `/catalog` a shopper met a product grid with a sidebar holding only «Ціна» and «Наявність»,
took it for the place to filter and never found the characteristics, which live on the product category.
`/catalog` and every group are now navigation (`catalog/CatalogHub.tsx`, data `catalog-hub.server.ts`, rules
`catalog-hub.ts`); a v2 product category and its landings keep `TypedCatalogPage` unchanged.

- **One column, the width of the page** (owner, 2026-11-14). Until then a left column listed the tree beside
  the tiles: the same two categories twice, and 288 px taken from everything below, so a strip's cards were
  150 px wide. It is gone — do not bring it back. «Прайс-лист» and «Опт» stand beside the H1 (`/catalog` only).
  The links to every level of the tree are the header's «Каталог» menu, in the HTML of every page.
- **Entry tiles** are the navigation (`<nav>` «Категорії» / «Розділи: <назва>»): as many columns as fit at
  300 px, each stretched (`auto-fit`) — one tile is a row, two share it, more make an even grid, never an empty
  column. A tile sizes itself by its own width (`@container`: 112 px photo, 20 px name and the arrow from
  28 rem; 80 px and 16 px below). A group's tile names its first `HUB_TILE_CHILDREN` (3) sub-categories and
  «та ще N» in one muted line (`tileChildren`), not links. A product category's tile has no such line: **its
  landings are never its sub-categories** (owner, 2026-11-10 — in the place and the look of a group's children
  they read as sub-categories, and a category without landings looked bare beside one with them). Photos come
  from the category route's own `/categories/slug/<slug>` read, same tags.
- **«Популярні добірки»**: the landings as pills — the label and the product count (`PopularLandings`, a
  per-pill category on the hub). Every landing is visible and none is cut: a pill is as wide as its label.
  On the hub the label is the landing's whole H1 (the short label — the H1 without the category's name — is
  for the category's own page, under its heading; pills of several categories stood side by side with nothing
  to say of what), and a pill's text reads «PLA, 64 товари» to a screen reader and a crawler alike.
  Before 2026-11-14 they were five-across tiles with a dot (nine shown, the rest behind «Ще N видів»); the dot's
  colour was a hash of the slug and beside filament read as the plastic's colour, and three names of nine were
  cut. An admin image, when a landing has one, is a 28 px round mark in the pill. The same component is a
  category's «Популярні види» (its heading keeps the quiet label there). Addresses, sitemap entries, canonicals
  and `product_type` in the feed are unchanged.
- **Then**: the intro above the tiles (`/catalog` — `CATALOG_INTRO_HTML`; a group — its SEO text), «Новинки»
  (the scope's newest products; «Дивитися всі» only when the scope holds one product category), «Акції»
  (`filters.on_sale: true`, hidden when empty; after «Новинки» since 2026-11-11, owner) and, on `/catalog`, the
  «Вітрина» collections — product strips (`GET /products/catalog/v2/strip`, one card per product, see «Home
  page and header»); a group's bottom SEO text. Every heading, the H1 included, is `font-display`. Photos and
  landings are read for at most `HUB_DETAIL_READS` (24) nodes. Everything but the tree is decoration (caught):
  an outage costs a block, the tree failure still reaches the error boundary.
- **SEO** (`hubDecision`, TD-0013 matrix hub rows): bare address and tracking parameters render self-canonical;
  a scope with no active SKU renders `noindex, follow` without a canonical; `?page=N` (a listing page of a group
  converted from a product category) is one 308 to the bare address, attribution kept; filters, sort, page size,
  `category=` or anything else are a 404. Markup: `BreadcrumbList` and an `ItemList` of the tiles. A landing never
  renders under a hub (the writer refuses a group).
- **Gone with the grid**: the «Категорія» filter dimension (`TypedFilters`) and the sub-category tiles of
  `TypedCatalogPage`; a product category's listing no longer reads the tree. Home «Новинки» now says «До каталогу»:
  `/catalog` is not a list of every product. Home and hub strips build their address with `stripUrl`, so the whole
  catalogue's «Новинки» is one Data Cache entry.
- Tests: `catalog-hub.test.ts` (decision, a group tile's line), `typed-route.test.tsx` (`/catalog` and a group
  render the hub — tiles as the only navigation, «Прайс-лист»/«Опт» beside the H1, landings only as «Популярні
  добірки» pills, the display headings; a listing parameter is a 404, a product category stays a listing),
  `PopularLandings.test.tsx`, release E2E `category-conversion.spec.ts` (a converted group shows its new
  sub-categories and one «Новинки» card per product; every SKU address still answers).

## Product admin after the pre-release review (2026-11-15, local)

- **The header's «Зберегти» never writes a SKU's axis value from a draft's copy.** While the axis is the
  stored one, `characteristicsValues` sends each SKU's value as the product holds it now — a SKU recoloured,
  added or deleted in its own window while «Характеристики» waited unsaved is left as it is. Only a changed
  axis takes the form's values, kept by SKU id (`CharacteristicsDraft.variants` is a map, never a list by
  position); a SKU without a value there is «Заповніть значення кожного варіанта».
- **`409 PRODUCT_DETAILS_CHANGED` is recovered in place.** The Prom sync stamps `stock_updated_at` on every
  SKU each half hour, which moves the details token without moving the revision. After any refused command
  the workspace's `execute()` reads the product again (`['typed-product']`), so the next save is made from
  what is stored now; the message is «Дані товару оновились (ціна чи залишок) — перевірте й збережіть ще
  раз». The variant window keeps only what the admin typed (`edits` over the stored SKU): an untouched price
  or stock shows the fresh figure and is never written back from the moment the window opened. A refused
  save says its reason in the window itself (`failure` — the page's line is behind it).
- **`REQUIRED_VALUE` on an ordinary save** (any save of a published product, a price edit included) names the
  characteristic the sent body lacks: «Не заповнено обов’язкову характеристику «…»».
- **«Акція на весь товар»** lists the SKUs whose sale price would fall below `supplier_price` («Нижче
  закупівлі: FL-… (≈85 ₴ < 90 ₴)»), as the old card did; it warns and never blocks.
- **Confirmations stand on a row of their own** («Архівувати всі варіанти», «Видалити товар», «Видалити
  чернетку сторінки»): the first button stays in place, switched off, so a double click lands on nothing.
- **The address change waits for its host form.** In the variant window and in a landing's form «Змінити
  адресу» is off, with one line why, while that form has unsaved input — the change reloads the form. Enter in
  the address field does not submit the landing around it.
- **The header's «Скасувати»** remounts the description editor (it keeps its text in its own state); a
  description the schema refuses says why under the editor, and a schema refusal is always a sentence
  (`problemText`), never zod's JSON.
- **Gates** (`ProductWorkspaceGate`, `LandingsWorkspaceGate`): the «cannot check the mode» alert shows only
  while the mode was never read. A later failed re-read — the workspace re-reads the capabilities after every
  command under the same query key — keeps the screen already chosen, with its unsaved edits.
- **The product search box** stays while a search is typed, asked or being replaced by the whole list, so
  clearing it after a short result does not take it from under the cursor.
- Tests: `ProductSaveRetry.test.tsx` (the workspace, the editor and the variant window against a refusing
  server), `ProductWorkspaceGate.test.tsx`, and the cases added to the editors' own test files.

### Photos in the creation form (owner, 2026-11-15)

«я хочу щоб можна було додати фото одразу»: the creation form (`ProductForm` with `creation`) has a «Фото»
block in every SKU row — the variant window's `ImageDropzone`, the first photo is the main one; a product
without variants has one row and so one block.

- **Uploaded on submit, then sent with the command.** The fields are checked first; then every picked file
  goes through the ordinary `productsApi.uploadImages` (presign → PUT → confirm) and the `product-create`
  body carries each SKU's `images` (public URLs in the order shown; a SKU without photos carries no
  `images`, and the server stores `[]`). The product has no id yet, so the files go under
  `products/<a 24-hex id the form generates once>/…`: a SKU stores full addresses, uploads are deleted by
  key, and nothing reads the folder name as a product id.
- **A file goes up once.** An uploaded photo is kept as uploaded in the form, so a submit repeated after a
  refusal sends its address again without uploading; an upload that fails sends nothing and the next try
  uploads only what is still missing. «Повторити той самий запит» re-sends the stored body — no upload.
  Photos of a form that is abandoned stay in the bucket unattached, as with the variant window.
- Tests: `TypedProductEditor.test.tsx` («photos in the creation form»); backend
  `typed-product-create.int-spec.ts` («photos of a new product»).

### A whole product at creation; a draft unless complete (owner, 2026-11-15)

«можливо і опис варто робити зразу… я хочу щоб були бест практіс» — three decisions.

- **«Усе одразу».** The creation form (`ProductForm` with `creation`) is the edit screen's blocks in its
  order, each a white card: «Новий товар» («Основне»: name, supplier, axis) → «Опис» (the edit screen's
  `DescriptionBlock`) → «Характеристики товару» (the groups, as before) → «Варіанти» (per SKU: ціна, залишок,
  вага для пошти with the variant window's hint, артикул вендора, ID на Промі, фото) → «Попередження перед
  покупкою (необов’язково)» (`PurchaseNoticeFields`, the one block the edit screen's card renders too) →
  «Статус» and the buttons. What is left empty is not sent: no description, no notice, an unknown weight.
  A star marks what an active product needs (опис, ціна, фото); it is drawn with `::after`, so the fields
  keep their names («Ціна, грн · варіант 1»). The weight has none — an unknown weight is a warning.
- **«Чернетка, активний — коли повний».** A new product is a draft, in a published category too (this
  replaces «типово Активний» of 27.10); «Статус» is offered only there. «Активний» is sent only for a
  complete product — the server's `productReadiness` rule: a description, every required characteristic,
  and for each SKU a price above zero and a photo. Otherwise the form sends nothing, uploads nothing and
  lists the gaps in the words of «Готовність даних товару» (`ActivationGaps`, `newProductGaps`, `skuGaps` in
  `ProductReadiness.tsx`); the admin fills them or keeps «Чернетка». The server refuses the same with
  `409 PRODUCT_NOT_READY` (`category-tree.utils.ts`).
- **«Додати варіант» has the whole SKU block** — photos too, uploaded on submit into the product's own
  folder — and a new SKU is a draft by default. In the variant window a SKU goes active (a new one, or a
  stored draft / archived one) only when the product is complete: its own gaps as the server reported them
  with the product (`productGaps`) plus this SKU's price and photo. A SKU that is active already is saved
  as before — a migrated SKU without a photo keeps its price edits.
- Tests: `TypedProductEditor.test.tsx` («a whole product in the creation form»), `VariantDialog.test.tsx`,
  `ProductVariantsEditor.test.tsx`; backend `typed-product-create.int-spec.ts`,
  `typed-product-published.int-spec.ts`.

