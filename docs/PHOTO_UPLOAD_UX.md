# Team photo selection and final consent — 2026-10-12

Photo selection was gated by a per-member checkbox and a disabled native file control. Each member now gets a visible camera/add-photo button, local preview, and optional-photo encouragement. Copy says photos *can help* matching; it does not claim a measured increase.

Selection decodes, validates, strips metadata and resizes locally. No photo or reservation is sent to Supabase until the final photo consent and team save. The photo consent appears alongside the final required member consent only when a photo is present. Selecting a new image resets it. A team without photos needs only the existing member consent.

Uploads completed before a later failure remain in form state for retry. Removing a failed selection allows saving without it. Existing server authorization, private storage, atomic team save, approval gate and 90-day deleted-team retention are unchanged; this release requires no database migration.

Validation:
- TypeScript, build and 101 baseline unit tests passed; added no-consent upload test passed (102 total with CI).
- Chrome: 21 existing scenarios plus the new partial-upload retry scenario passed.
- WebKit: all 22 scenarios passed.
- Three-photo selection sends zero reservation requests before final consent/save.
- Partial upload retry does not upload successful photos twice.
- Photo-free save after upload failure, existing draft editing/publishing, administrator archive, image enlargement and signup flows passed.
- Mobile selection screenshot inspected: `validation/photo-upload-ux/selection.png`. Only synthetic image/person fixtures were used.

Release target: existing Chuncheon production Vercel project `prj_NYsmDO19bnUOeLGqey1AQKgzuXPJ`, via protected main after PR checks. Roll back application deployment to `dpl_8xBN2Nmix9EBGvNC3eqcgJDiaRP1` if necessary; no backend rollback is needed for this UI change.
