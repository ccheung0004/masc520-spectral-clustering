# MathGPT v8 — Persistent Source ZIP Library, Human Audit & Regeneration

Extends the v7 Next.js / Claude website deployed on Render. Keeps **single-problem generator** (`/`) and **batch uploader** (`/batch`) and adds **saved library and audit review** (`/library`).

## What happens now

1. **Sign in** at `/login` using your own `MATHGPT_ADMIN_PASSWORD` (12+ characters).
2. Visit `/batch`, upload a ZIP with one folder per problem, and click **Save ZIP to library**. You can upload as many batches as you wish within available storage and API quotas (up to 40 folders *per batch*).
3. Click **Generate** to generate PowerPoint lesson JSON and worksheet JSON and optionally an IMathAS draft. The existing Claude LaTeX checks and mathematical audit run before a version is saved as generated. Each problem is independent.
4. Visit `/library` to browse previous ZIPs and per-problem generated versions. Original ZIPs can be downloaded again.
5. **✓ Approve** marks the selected version as **approved by you** (a human review separate from automated checks).
6. **✕ Reject & Regenerate** marks that version rejected and calls the Claude pipeline again from the original stored source files, saving a **new pending version**. The rejected version is retained for comparison/history. If regeneration fails, the error is saved as a failed version, and the original rejected version stays accessible.
7. Download a previous version's PowerPoint or worksheet PDF on demand from its stored generated content. PDF and PPTX are **re-rendered in the browser** on demand; the original ZIP, source JSON, model-generated content JSON, IMathAS draft, and review status live in Supabase.

**Important:** This version processes batch generation or regeneration sequentially while a browser tab is active. It does **not** implement a durable background queue. Clicking ✕ does not perform regeneration after the browser closes. For production, move jobs into an asynchronous queue/worker. For now, keep the tab open until completion.

## Setup (required; Render alone is not persistent file storage)

1. Create a [Supabase](https://supabase.com/) project.
2. In its **SQL Editor**, run `supabase-setup.sql` (creates three tables, enables RLS without public policies, and creates the private `mathgpt-private` Storage bucket).
3. Set these *server-side* Render environment variables:
   - `ANTHROPIC_API_KEY`: your Claude API key
   - `CLAUDE_MODEL`: optional, e.g. `claude-sonnet-4-6`
   - `MATHGPT_ADMIN_PASSWORD`: a strong random password **at least 12 characters** (required; changing it logs out old browser sessions)
   - `SUPABASE_URL`: your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: your Supabase **service-role secret key** (never expose as `NEXT_PUBLIC_*` or in the repo)
4. On Render: Node 22.x, build `npm install --include=dev && npm run build`, start `npm start`. Push the ZIP's extracted **contents** to your existing repo root. Deploy.
5. Visit `/login` first, then `/batch`, then `/library`.

No Supabase data is saved on Render's ephemeral filesystem. Original ZIP and source JSON use the **private bucket**; generated content and review history are in Postgres. RLS blocks client-side access; the server uses the service-role key only after checking the admin session.

## ZIP input structure

```
my_upload.zip
├── problem_001/
│   ├── primary.md
│   ├── problem.txt               # or question.txt
│   ├── verified_answer.txt
│   ├── lo_mapping.json           # optional
│   └── supporting_01.md         # optional
└── problem_002/
    ├── primary.md
    ├── question.txt
    └── verified_answer.txt
```

Up to 40 problems, 60 MB compressed, 500 file entries per ZIP, 12 MB per problem folder, and 150K characters per required text source file. You may upload additional ZIPs later (storage quotas and Supabase plan limits apply). PDFs or images in original ZIP are stored, but are **not automatically parsed as prompt context**.

## Audit and safety

- The existing Claude mathematical/LaTeX audit runs when generating lesson/worksheet content. Its approval isn't a proof of mathematical correctness.
- Your **manual ✓ / ✕** decision is a separate review layer; only you can approve the materials via the password-protected dashboard.
- IMathAS output is always a **draft**. Live IMathAS seed/answer acceptance checks and rubric review are still required before publishing.
- Do not share the admin password or Supabase service-role key. Add real user accounts, rate-limiting, stronger login controls, and a durable job queue before making this a multi-user public product.
- Secure uploads: do not accept ZIPs from untrusted users without separate decompression/security hardening. The browser ZIP parsing has count and size checks, but does not replace comprehensive server-side virus and zip-bomb scanning.

## Files added

- `supabase-setup.sql`: database and private bucket setup
- `app/login/`: admin password sign-in
- `app/library/`: history, past versions, ✓ approval, ✕ reject/regenerate, downloads
- `app/api/auth/`: session login/logout/status
- `app/api/library/`: source ZIP upload and saved history API
- `lib/admin-auth.ts` and `lib/library-db.ts`: server-side auth and Supabase access
- Existing generation API routes are now protected by the admin cookie.

## Build validation

The package has been statically syntax checked using TypeScript's compiler parser. A full `npm install && npm run build` could not be completed in the local sandbox due to npm install timeouts. The first Render build is still the full type/deployment verification step.

## What about old v7 generations?

Because v7 kept its results only in the browser, it cannot automatically recover results from prior browser sessions or Render deployments. Persistence begins with the new ZIPs and generated versions saved after this upgrade. Previously downloaded v7 results remain on your computer.


## Full browser previews (v9)

Every generated problem now has a full viewer with all slide content (title, sample, each worked step) and a scrollable full worksheet with an optional answer key. Available on the single-problem page, Batch Studio after generating, and Saved Library for any saved version. Downloads remain optional. The on-site viewer renders generation JSON, not an embedded/byte-for-byte rendering of the exported PPTX/PDF. The PowerPoint export can add continuation slides to avoid overflow.
