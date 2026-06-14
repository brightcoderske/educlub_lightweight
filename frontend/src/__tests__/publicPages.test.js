import {
  PUBLIC_ALIASES,
  PUBLIC_NAV,
  PUBLIC_PAGES,
  PUBLIC_PAGE_PATHS,
  SITE_CONTACT,
} from "../layouts/public-site/publicPages";
import { buildStructuredData, getSeoData } from "../layouts/public-site/usePublicSeo";
import { readFileSync } from "fs";
import { resolve } from "path";
const { buildSnapshotHtml, buildSitemap } = require("../../scripts/generate-public-seo");

const requiredPaths = [
  "/",
  "/courses",
  "/courses/scratch-coding",
  "/courses/python-programming",
  "/courses/web-development",
  "/courses/mobile-app-development",
  "/courses/data-analysis",
  "/courses/artificial-intelligence",
  "/courses/prompt-engineering",
  "/courses/digital-literacy",
  "/courses/learning-to-learn",
  "/typing",
  "/quizzes",
  "/competitions",
  "/holiday-bootcamps",
  "/for-schools",
  "/about",
  "/contact",
  "/privacy",
  "/user-agreement",
];

test("public catalogue provides substantial unique pages for every search path", () => {
  expect(PUBLIC_PAGE_PATHS).toEqual(expect.arrayContaining(requiredPaths));
  expect(new Set(PUBLIC_PAGE_PATHS).size).toBe(PUBLIC_PAGE_PATHS.length);

  const titles = PUBLIC_PAGE_PATHS.map((path) => PUBLIC_PAGES[path].title);
  const descriptions = PUBLIC_PAGE_PATHS.map((path) => PUBLIC_PAGES[path].description);
  expect(new Set(titles).size).toBe(titles.length);
  expect(new Set(descriptions).size).toBe(descriptions.length);

  PUBLIC_PAGE_PATHS.forEach((path) => {
    const page = PUBLIC_PAGES[path];
    expect(page.h1.length).toBeGreaterThan(20);
    expect(page.description.length).toBeGreaterThan(90);
    expect(page.intro.length).toBeGreaterThan(100);
    expect(page.sections.length).toBeGreaterThanOrEqual(2);
    expect(page.primaryCta.label).toBeTruthy();
    expect(page.primaryCta.path).toMatch(/^(\/|mailto:|https:\/\/)/);
    expect(page.keywords.length).toBeGreaterThanOrEqual(4);
  });
});

test("learner access and Kenyan contact details are canonical", () => {
  expect(SITE_CONTACT.email).toBe("support@educlub.co.ke");
  expect(SITE_CONTACT.phoneHref).toBe("tel:+254740073575");
  expect(SITE_CONTACT.whatsappHref).toBe("https://wa.me/254740073575");
  expect(PUBLIC_ALIASES["/authentication/sign-in"]).toBe("/login");
  expect(PUBLIC_PAGES["/"].primaryCta.path).toBe("/courses");
  expect(PUBLIC_PAGES["/"].secondaryCta.path).toBe("/register");
});

test("future skills pages target distinct learner needs", () => {
  const combinedKeywords = requiredPaths
    .flatMap((path) => PUBLIC_PAGES[path].keywords)
    .join(" ")
    .toLowerCase();

  [
    "scratch",
    "python",
    "web development",
    "mobile app",
    "data analysis",
    "artificial intelligence",
    "prompt engineering",
    "digital literacy",
    "learning to learn",
    "holiday coding bootcamp",
    "lms for schools",
  ].forEach((phrase) => expect(combinedKeywords).toContain(phrase));
});

test("public navigation keeps learner login and registration immediately available", () => {
  expect(PUBLIC_NAV.utility).toEqual([
    { label: "Log In", path: "/login" },
    { label: "Register", path: "/register" },
  ]);
  expect(PUBLIC_NAV.primary.map((item) => item.path)).toEqual(
    expect.arrayContaining(["/courses", "/typing", "/competitions", "/for-schools"])
  );
});

test("SEO data uses production canonicals and page-specific educational schema", () => {
  const seo = getSeoData("/courses/python-programming");
  expect(seo.canonical).toBe("https://www.educlub.co.ke/courses/python-programming");
  expect(seo.title).toContain("Python");
  expect(seo.robots).toContain("index");

  const schemas = buildStructuredData("/courses/python-programming");
  expect(schemas.map((item) => item["@type"])).toEqual(
    expect.arrayContaining(["EducationalOrganization", "WebSite", "Course"])
  );
  expect(JSON.stringify(schemas)).toContain("support@educlub.co.ke");
  expect(JSON.stringify(schemas)).toContain("/educlub-logo.png");
  expect(JSON.stringify(schemas)).not.toContain("/apple-icon.png");
});

test("public pages size brand images and use accessible muted text", () => {
  const source = readFileSync(
    resolve(__dirname, "../layouts/public-site/index.js"),
    "utf8"
  );
  expect(source).toContain('height="42"');
  expect(source).toContain('component="span"');
  expect(source).toContain("#455a64");
});

test("routes expose public content, login, registration and a real not-found page", () => {
  const routesSource = readFileSync(resolve(__dirname, "../routes.js"), "utf8");
  const appSource = readFileSync(resolve(__dirname, "../App.js"), "utf8");
  expect(routesSource).toContain('route: "/login"');
  expect(routesSource).toContain('route: "/register"');
  expect(routesSource).toContain("PUBLIC_PAGE_PATHS.map");
  expect(routesSource).toContain('route: "*"');
  expect(appSource).not.toContain('<Navigate to="/" />');
  expect(appSource).toContain('route.route !== "*"');
  expect(appSource).toContain('"noindex, nofollow"');
});

test("direct registration URLs open the learner registration dialog", () => {
  const landingSource = readFileSync(
    resolve(__dirname, "../layouts/landing/index.js"),
    "utf8"
  );
  expect(landingSource).toContain('pathname === "/register"');
  expect(landingSource).toContain("setRegistrationOpen(true)");
});

test("SEO generator creates crawlable snapshots and a production sitemap", () => {
  const page = PUBLIC_PAGES["/courses/python-programming"];
  const html = buildSnapshotHtml(
    "<html><head><title>Old</title></head><body><div id=\"app\"></div></body></html>",
    "/courses/python-programming",
    page
  );
  expect(html).toContain(page.title);
  expect(html).toContain(page.h1);
  expect(html).toContain("data-seo-snapshot");
  expect(html).toContain("educlub-first-paint");
  expect(html).toContain('rel="canonical" href="https://www.educlub.co.ke/courses/python-programming"');
  expect(html).not.toContain(">Old</title>");

  const sitemap = buildSitemap(PUBLIC_PAGE_PATHS);
  expect(sitemap).toContain("<loc>https://www.educlub.co.ke/courses/python-programming</loc>");
  expect(sitemap).not.toContain("your-frontend-domain.com");
  expect(sitemap).not.toContain("/authentication/");
});
