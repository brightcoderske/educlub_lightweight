# Public Pages and SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an indexable public eduClub website with prominent learner login and registration, future-skills course pages, Kenyan search content, correct technical SEO, and working contact actions.

**Architecture:** Replace the single path-switching landing page with a shared public-site shell and route-driven static page catalogue. Keep registration as a reusable dialog inside that shell, centralize SEO metadata and structured data, and generate sitemap entries and static route snapshots from the same page definitions so content and indexing stay aligned.

**Tech Stack:** React 18, React Router 6, Material UI, Jest, Node build scripts, static XML/HTML assets.

---

### Task 1: Public page catalogue and SEO contract

**Files:**
- Create: `frontend/src/layouts/public-site/publicPages.js`
- Create: `frontend/src/__tests__/publicPages.test.js`

- [ ] Write a failing Jest test asserting unique paths, titles, descriptions, H1 text, keywords, CTA labels, and required routes for courses, typing, quizzes, competitions, bootcamps, schools, about, contact, privacy, and user agreement.
- [ ] Run `npm test -- --runInBand src/__tests__/publicPages.test.js` and confirm it fails because the catalogue does not exist.
- [ ] Implement a static `PUBLIC_PAGES` map and `PUBLIC_ALIASES` map. Include course clusters for Scratch, Python, web development, mobile apps, data analysis, AI, prompt engineering, digital literacy, and learning-to-learn.
- [ ] Add natural Kenya-focused headings and supporting keyword phrases without duplicated doorway content.
- [ ] Re-run the focused test and commit the catalogue.

### Task 2: Shared public shell with persistent learner access

**Files:**
- Create: `frontend/src/layouts/public-site/index.js`
- Create: `frontend/src/layouts/public-site/RegistrationDialog.js`
- Modify: `frontend/src/layouts/landing/index.js`
- Test: `frontend/src/__tests__/publicPages.test.js`

- [ ] Add failing source-contract tests for visible `Log In` and `Register` actions in both desktop and compact/mobile navigation.
- [ ] Extract the existing registration form and API behavior into `RegistrationDialog`.
- [ ] Build a responsive public header, footer, page hero, content sections, related links, FAQ blocks, and CTA panels from `PUBLIC_PAGES`.
- [ ] Keep `Log In` and `Register` in the header on every public route. Make mobile controls visible without opening a menu.
- [ ] Use `Explore Courses` as the homepage primary CTA, followed by `Register a Learner` and `For Schools`.
- [ ] Preserve registration validation, parent consent, school/term loading, automatic login, and existing learner redirect behavior.
- [ ] Reduce `layouts/landing/index.js` to a compatibility export or remove it after routes migrate.
- [ ] Run focused frontend tests and commit the public shell.

### Task 3: Public routes and private-route indexing boundaries

**Files:**
- Modify: `frontend/src/routes.js`
- Modify: `frontend/src/App.js`
- Test: `frontend/src/__tests__/publicPages.test.js`

- [ ] Add a failing test that every canonical public path is routed to `PublicSite`.
- [ ] Register all preferred public paths and legacy aliases.
- [ ] Add `/login` as the public-friendly sign-in route while preserving `/authentication/sign-in`.
- [ ] Ensure unknown URLs render a real public not-found page rather than redirecting to duplicate homepage content.
- [ ] Keep authenticated dashboard routes role-protected and outside public navigation.
- [ ] Run focused tests and commit routing.

### Task 4: Metadata and structured data

**Files:**
- Create: `frontend/src/layouts/public-site/usePublicSeo.js`
- Modify: `frontend/public/index.html`
- Test: `frontend/src/__tests__/publicPages.test.js`

- [ ] Add failing tests for production canonicals, Open Graph URLs, index/follow metadata, and schema types.
- [ ] Implement route-specific title, description, canonical, robots, Open Graph, and Twitter tags.
- [ ] Generate accurate `EducationalOrganization`, `WebSite`, `Course`, `ItemList`, `FAQPage`, and `ContactPoint` JSON-LD based on page type.
- [ ] Remove every `your-frontend-domain.com` placeholder from the HTML shell.
- [ ] Apply `noindex, nofollow` to private app routes and authentication utility pages where appropriate.
- [ ] Run tests and commit metadata support.

### Task 5: Sitemap, robots, snapshots, and hosting fallback

**Files:**
- Create: `frontend/scripts/generate-public-seo.js`
- Modify: `frontend/package.json`
- Modify: `frontend/public/sitemap.xml`
- Modify: `frontend/public/robots.txt`
- Create: `frontend/public/.htaccess`
- Test: `frontend/src/__tests__/publicPages.test.js`

- [ ] Add failing tests that sitemap URLs use `https://www.educlub.co.ke`, contain every preferred public route, and contain no aliases or private routes.
- [ ] Build a Node generator that reads the public page catalogue and writes `sitemap.xml`.
- [ ] Correct `robots.txt`, reference the production sitemap, and disallow private dashboard prefixes.
- [ ] Add an Apache SPA fallback that preserves real static assets and routes application requests to `index.html`.
- [ ] Hook SEO generation into the frontend build.
- [ ] Run the generator and focused tests, then commit generated SEO assets.

### Task 6: Contact, legal, and conversion details

**Files:**
- Modify: `frontend/src/layouts/public-site/publicPages.js`
- Modify: `frontend/src/layouts/public-site/index.js`
- Test: `frontend/src/__tests__/publicPages.test.js`

- [ ] Add tests for `support@educlub.co.ke`, `tel:+254740073575`, and `https://wa.me/254740073575`.
- [ ] Add About, Contact, Privacy, and User Agreement content suitable for a child-focused LMS.
- [ ] Expose support email, call, and WhatsApp actions; keep `brightcoderske@gmail.com` as an internal copy mailbox rather than the public identity.
- [ ] Add truthful enquiry CTAs that do not claim unavailable bootcamp dates or instant course allocation.
- [ ] Run tests and commit.

### Task 7: Full verification and launch documentation

**Files:**
- Create: `docs/deployment/google-search-console.md`
- Modify: `README.md` only if an existing deployment section links naturally to the new guide.

- [ ] Run `npm test -- --runInBand` in `frontend`.
- [ ] Run `npm run build` in `frontend`.
- [ ] Run `npm test` in `backend`.
- [ ] Search the repository for domain placeholders and incorrect public contact details.
- [ ] Inspect generated pages at desktop and mobile widths using the browser.
- [ ] Document deployment, sitemap submission, Search Console URL inspection, indexing requests, and query monitoring.
- [ ] Commit, push `main`, and provide the exact cPanel deployment command.
