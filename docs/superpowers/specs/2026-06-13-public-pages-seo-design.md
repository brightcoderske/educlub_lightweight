# eduClub Public Pages and SEO Design

## Goal

Turn `https://www.educlub.co.ke` into an indexable public education website that attracts Kenyan parents, schools, academies, and holiday-program buyers while directing visitors into course exploration, learner registration, school enquiries, and login.

The work must preserve the existing LMS and registration flow. Public marketing pages will explain what eduClub offers without exposing private learner or school data.

## Audience

- Kenyan parents seeking practical computer, coding, STEM, and holiday learning for children
- Schools and academies seeking an LMS, digital-skills curriculum, competitions, and learner tracking
- Children and teenagers seeking engaging technology courses
- Organisations seeking school partnerships, bootcamps, and digital-skills programmes

## Information Architecture

Create distinct public routes with unique visible content and metadata:

| Route | Purpose |
| --- | --- |
| `/` | Main value proposition and route visitors by need |
| `/courses` | Course catalogue and learning pathways |
| `/courses/scratch-coding` | Progressive Scratch coding for children |
| `/courses/python-programming` | Beginner-to-project Python pathway |
| `/courses/web-development` | HTML, CSS, JavaScript, and web projects |
| `/courses/mobile-app-development` | Mobile app design and development pathway |
| `/courses/data-analysis` | Spreadsheets, data thinking, visualisation, and introductory analysis |
| `/courses/artificial-intelligence` | Safe, age-appropriate AI literacy and responsible use |
| `/courses/prompt-engineering` | Clear prompting, verification, bias, privacy, and productive AI use |
| `/courses/digital-literacy` | Computer basics, online safety, productivity, research, and communication |
| `/courses/learning-to-learn` | Study skills, problem solving, reflection, research, and self-directed learning |
| `/typing` | Typing lessons, practice, speed, accuracy, and school typing programmes |
| `/quizzes` | Educational quizzes and revision challenges |
| `/competitions` | Typing, coding, maths, science, and STEM competitions |
| `/holiday-bootcamps` | Kenyan school-holiday coding and STEM programmes |
| `/for-schools` | LMS, curriculum, reporting, competitions, and school partnership offer |
| `/about` | Organisation purpose, teaching approach, safety, and partners |
| `/contact` | Email, telephone, WhatsApp, enquiry choices, and response expectations |
| `/register` | Existing learner registration flow with supporting trust copy |
| `/login` | Existing sign-in flow |
| `/privacy` | Privacy and child-data explanation |
| `/user-agreement` | Public platform terms and acceptable-use agreement |

Existing aliases such as `/digital-skills`, `/talk-to-us`, and `/why-choose-us` may remain, but their canonical URL must point to the preferred route.

## Page Content Pattern

Every public content page should contain:

1. One clear, page-specific H1.
2. A short answer to the visitor's main question near the top.
3. Benefits and real learning outcomes.
4. Suitable learner ages or school use cases without making unsupported guarantees.
5. Project-based and progressive-learning explanation where relevant.
6. Internal links to related pathways.
7. A primary CTA and one context-aware secondary CTA.
8. Frequently asked questions where they add genuine search value.
9. Unique title, description, canonical URL, Open Graph data, and structured data.

Course pages should describe intended learning paths even where enrolment availability is controlled by a school. They must not advertise a specific course as currently open unless the platform can confirm that state.

## CTA Design

The homepage CTA order will be:

1. **Explore Courses** for visitors still evaluating.
2. **Register a Learner** for parents ready to act.
3. **Bring eduClub to Your School** for school and academy leads.
4. **Log In** as a quieter utility action for existing users.

Course pages use **Explore the Learning Path** or **Register a Learner**. School pages use **Talk to eduClub for Schools**. Holiday pages use **Ask About the Next Bootcamp** unless confirmed dates are available.

CTAs must explain what happens next and must not imply immediate paid enrolment where school allocation is required.

## Contact Details

Public contact details:

- Email: `support@educlub.co.ke`
- Copy/support mailbox: `brightcoderske@gmail.com`
- Telephone: `0740073575`
- International telephone format: `+254740073575`
- WhatsApp: `https://wa.me/254740073575`

The website displays the support address, phone, and WhatsApp actions. The copied mailbox is an internal delivery detail and should not be publicly presented as the primary brand email.

## Search Strategy

### Core Kenya Clusters

- LMS for schools in Kenya
- learning management system Kenya
- online learning platform for schools Kenya
- digital learning platform Kenya
- online courses for kids Kenya
- computer courses for children Kenya
- digital skills for kids Kenya
- coding classes for kids Kenya
- programming courses for kids Kenya
- STEM courses for kids Kenya
- STEAM learning for children Kenya
- project-based learning for kids Kenya
- CBC digital literacy activities
- future skills for children Kenya

### Course Clusters

- Scratch coding for kids Kenya
- Python programming for kids Kenya
- web development classes for kids Kenya
- mobile app development for students Kenya
- data analysis course for students Kenya
- AI course for kids Kenya
- artificial intelligence literacy for students
- prompt engineering for students Kenya
- computer literacy classes for children
- online safety course for children
- typing practice for kids Kenya
- touch typing lessons for students
- educational quizzes for children Kenya
- computational thinking for kids
- learn how to learn course for students
- study skills and self-directed learning for children

### Programme and Buyer Clusters

- holiday coding bootcamp Kenya
- holiday tech bootcamp Nairobi
- STEM holiday camp for kids Kenya
- school holiday computer classes
- weekend coding classes for kids Nairobi
- after-school coding programme Kenya
- coding curriculum for schools Kenya
- STEM programme for schools Kenya
- school typing competition Kenya
- coding competitions for students Kenya
- online learning tools for Kenyan schools
- learner progress tracking software Kenya

Keywords should be used naturally. Pages will answer specific intent rather than repeat lists or create near-duplicate doorway pages.

## Technical SEO

- Replace every `your-frontend-domain.com` reference with `https://www.educlub.co.ke`.
- Publish a complete `robots.txt` and XML sitemap containing only preferred public URLs.
- Generate unique metadata from a central page configuration.
- Add canonical URLs and correct social-preview URLs.
- Add `EducationalOrganization`, `WebSite`, `Course`, `ItemList`, `FAQPage`, and `ContactPoint` structured data where accurate.
- Add meaningful internal navigation and footer links so crawlers can discover every public page.
- Mark private dashboard and authentication utility screens appropriately. Login can be discoverable, but private app routes must not be indexed.
- Ensure unknown public URLs return a real not-found experience rather than landing-page duplicate content.
- Preserve mobile responsiveness, semantic headings, image alternative text, and keyboard-accessible navigation.
- Avoid making indexing depend solely on content that appears after API requests.
- Add Google Search Console verification support and document sitemap submission. Search ranking and indexing cannot be guaranteed.

## Rendering Approach

Use a reusable React public-page system backed by route-specific static content and SEO configuration. Pages should render meaningful headings and copy immediately without waiting for API data.

Because the current app is a client-rendered SPA, deployment must also provide crawler-friendly route handling. The implementation will use the least disruptive supported approach in the current hosting setup:

- preferred: build-time generated static HTML snapshots for the public routes;
- fallback: one correctly configured SPA shell plus crawlable route-specific content and metadata, followed by a server-rendering or prerendering phase.

The sitemap, canonical corrections, and distinct page content are mandatory in either case.

## Navigation and Visual Direction

Keep the existing eduClub identity but simplify the public header:

- Courses
- Typing
- Quizzes
- Competitions
- Holiday Bootcamps
- For Schools
- About
- Contact
- Log In
- Register

The homepage should communicate three promises quickly: practical future skills, progressive project-based learning, and visibility for parents or schools.

## Measurement and Launch

After deployment:

1. Verify all preferred URLs return HTTP 200 and correct canonical tags.
2. Submit `https://www.educlub.co.ke/sitemap.xml` in Google Search Console.
3. Request indexing for the homepage, Courses, For Schools, Holiday Bootcamps, Typing, and one flagship course page.
4. Monitor indexed pages, impressions, clicks, queries, and CTA conversions.
5. Improve pages from actual Search Console query data rather than guessing indefinitely.

## Acceptance Criteria

- All listed public pages are available through navigation and direct URLs.
- Each page has substantial unique learner-, parent-, or school-focused content.
- Domain placeholders are eliminated.
- Sitemap and robots files use the production domain.
- Contact actions work with the approved email, telephone, and WhatsApp details.
- Registration and login continue to work.
- Public pages have unique metadata, canonicals, structured data, and internal links.
- Private LMS routes do not become public search results.
- Automated tests cover SEO configuration and route generation.
- Production build succeeds.
