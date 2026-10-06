# Design QA

Source visual truth: selected archive mock at `/workspace/scratch/9d6324ff7b2e/generated_images/exec-bb2f5e8b-4f65-40fb-8198-c3cd93fa7b2d.png`, combined with the user's later explicit warm-white letter-paper decision and supplied paper/envelope assets.
Implementation screenshot: `/workspace/scratch/our-archive-final.jpg`.
Comparison evidence: `.sites-runtime/qa-comparison.png` (before refinements), `.sites-runtime/qa-comparison-final.png` (after refinements). Private screenshots are excluded from GitHub.
Browser viewport: 1363 × 936 CSS px, devicePixelRatio 1. Screenshot content width: 1348 px (scrollbar excluded); full-page height changes with layout. Source: 1484 × 1060 px. Source was scaled to implementation content width; the implementation was cropped to the same height before combining both images in one comparison.
State: unlocked archive home, original photo collection, no newly added records.

## Findings and comparison history

- P0: Composer crashed in the HTTP-only local preview because `crypto.randomUUID` was unavailable. Fixed with a UUID v4 fallback using `crypto.getRandomValues`. Browser retest successfully opened the form and saved a temporary memory; the temporary data was then removed.
- P2: The first desktop rendering pushed the memory and envelope row too far down compared with the selected mock. Reduced top padding, matched the main photo ratio, removed the forced desktop intro line break and reduced carousel spacing. Final combined comparison preserves the intended large-photo/large-title composition and reveals the second row sooner.
- P2: Desktop footer content touched the viewport edges. Fixed its width and responsive margins; final full-page screenshot shows all footer controls with consistent insets.

No actionable P0/P1/P2 findings remain in the verified desktop state.

## Required fidelity surfaces

- Typography: Chinese serif display and letter text, with smaller sans-serif controls and restrained Roman metadata. Hierarchy and wrapping checked in the home and opened-letter browser views. Main text remains at least 16px; regular controls at least 14px.
- Layout: asymmetric hero, framed main photo, small photo/memory/envelope second row and fine rules match the selected direction. Additional navigation and new-record area support the requested persistent archive.
- Color: warm ivory, brown text, champagne borders and burgundy seal replace the rejected plum/gold background by explicit user request. Text is legible in the captured rendering.
- Images: original user photographs remain unaltered. Generated paper and envelope are independent raster assets; WebP compression preserves their appearance. Photo framing uses a paper mat and fine double edge.
- Copy: original seed text is retained. No new events or personal history were invented. Dates show 2020 — 至今; Shanghai timezone is used for record dates and sync timestamps.

Focused review: the browser-rendered opened letter was separately inspected for paper texture, serif text, paragraph spacing, close control and reply action. The generated envelope and main-photo borders are readable in the final full-view comparison.

## Validation

Browser: home, letter opening/closing, album navigation, hanfu photo filtering, composer opening and saving a memory. Console inspected: the earlier UUID error was corrected; browser-extension metadata errors are unrelated to the app. No new app errors after the fix.
Server: password login, anonymous API/media denial, CSRF rejection, invalid-image rejection, R2 upload/read, two independent authenticated clients reading shared D1 records, stale-edit rejection, future text redaction, import idempotency, legacy reply paragraphs, shared preferences, export, soft delete and rate limiting.
Build: Worker ESM, static client and manifest produced; schema migrations generated and included.

## Follow-up polish and test gaps

- Full browser mobile emulation was unavailable on the exposed browser surface. Responsive grid, typography and modal rules are implemented; no mobile browser pass is claimed.
- WebMCP is feature-detected and adds only a draft-opening tool. This browser reported no available registrations, so WebMCP runtime validation is unavailable; it is not a requested user feature.
- The source mock includes stylized versions of the photographs; retaining the actual photographs is intentional.

final result: passed
