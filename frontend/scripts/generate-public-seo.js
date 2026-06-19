const fs = require("fs");
const path = require("path");

const SITE_ORIGIN = "https://www.educlub.co.ke";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceOrInsert(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `  ${replacement}\n  </head>`);
}

function buildSnapshotHtml(template, route, page) {
  const canonical = `${SITE_ORIGIN}${route === "/" ? "/" : route}`;
  const visibleSections = (page.sections || [])
    .map(
      (item) =>
        `<section><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.body)}</p><ul>${(
          item.points || []
        )
          .map((point) => `<li>${escapeHtml(point)}</li>`)
          .join("")}</ul></section>`,
    )
    .join("");
  const staticContent = `<main class="educlub-first-paint" data-seo-snapshot="true"><div><span>eduClub</span><h1>${escapeHtml(
    page.h1,
  )}</h1><p>${escapeHtml(page.intro)}</p>${visibleSections}</div></main>`;
  const criticalStyles = `<style id="educlub-first-paint">
    *{box-sizing:border-box}body{margin:0;background:#f7f9fc;color:#17324d;font-family:Arial,sans-serif}
    .educlub-first-paint{min-height:100vh;padding:64px 24px;background:linear-gradient(135deg,#eef7ff,#fff8e8)}
    .educlub-first-paint>div{max-width:980px;margin:auto;padding:48px;border-radius:24px;background:#fff;box-shadow:0 18px 50px rgba(23,50,77,.12)}
    .educlub-first-paint span{display:inline-block;padding:8px 14px;border-radius:999px;background:#1676d2;color:#fff;font-weight:700}
    .educlub-first-paint h1{max-width:760px;margin:24px 0 16px;font-size:clamp(2rem,5vw,4rem);line-height:1.05}
    .educlub-first-paint h2{margin-top:32px;color:#1676d2}.educlub-first-paint p,.educlub-first-paint li{font-size:1.05rem;line-height:1.7}
    @media(max-width:600px){.educlub-first-paint{padding:24px 12px}.educlub-first-paint>div{padding:28px 20px}}
  </style>`;
  const schema = {
    "@context": "https://schema.org",
    "@type": page.type === "course" ? "Course" : "WebPage",
    name: page.h1,
    description: page.description,
    url: canonical,
    provider: {
      "@type": "EducationalOrganization",
      name: "eduClub",
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/educlub-logo.png`,
      email: "support@educlub.co.ke",
      telephone: "+254740073575",
    },
  };

  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = replaceOrInsert(
    html,
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
  );
  html = html.replace("</head>", `${criticalStyles}</head>`);
  html = replaceOrInsert(
    html,
    /<meta\s+name="keywords"[^>]*>/i,
    `<meta name="keywords" content="${escapeHtml((page.keywords || []).join(", "))}" />`,
  );
  html = replaceOrInsert(
    html,
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
  );
  html = replaceOrInsert(
    html,
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${canonical}" />`,
  );
  html = html.replace(
    '<div id="app"></div>',
    `<div id="app" data-seo-snapshot="true" style="visibility:hidden">${staticContent}</div><script type="application/ld+json">${JSON.stringify(
      schema,
    )}</script>`,
  );
  return html;
}

function buildSitemap(routes) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map((route) => {
      const url = `${SITE_ORIGIN}${route === "/" ? "/" : route}`;
      const priority = route === "/" ? "1.0" : route === "/courses" ? "0.9" : "0.8";
      return `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function loadPublicPages() {
  process.env.BABEL_ENV = "test";
  process.env.NODE_ENV = "test";
  const babel = require("@babel/core");
  const sourcePath = path.resolve(__dirname, "../src/layouts/public-site/publicPages.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const transformed = babel.transformSync(source, {
    filename: sourcePath,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const loadedModule = { exports: {} };
  new Function("module", "exports", "require", transformed)(
    loadedModule,
    loadedModule.exports,
    require,
  );
  return loadedModule.exports;
}

function writeSnapshots() {
  const { PUBLIC_PAGES, PUBLIC_PAGE_PATHS } = loadPublicPages();
  const buildDir = path.resolve(__dirname, "../build");
  const publicDir = path.resolve(__dirname, "../public");
  const template = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
  const utilityPages = {
    "/register": {
      type: "WebPage",
      title: "Register a Learner | eduClub Kenya",
      description:
        "Register a learner for eduClub courses, typing practice, quizzes and competitions with parent or guardian consent.",
      h1: "Register a learner for eduClub",
      intro:
        "Create a learner account with guardian consent, then continue to the learner dashboard and available learning opportunities.",
      keywords: ["eduClub registration", "register learner Kenya"],
      sections: [],
    },
    "/login": {
      type: "WebPage",
      title: "Log In to eduClub | Learners, Schools and Teachers",
      description:
        "Log in to eduClub to continue courses, typing, quizzes, competitions, learner progress or school administration.",
      h1: "Log in to eduClub",
      intro:
        "Learners, teachers and school administrators can sign in to continue securely from their eduClub dashboard.",
      keywords: ["eduClub login", "learner login"],
      sections: [],
    },
  };
  const allPages = { ...PUBLIC_PAGES, ...utilityPages };
  const allRoutes = [...PUBLIC_PAGE_PATHS, ...Object.keys(utilityPages)];

  allRoutes.forEach((route) => {
    const html = buildSnapshotHtml(template, route, allPages[route]);
    if (route === "/") {
      fs.writeFileSync(path.join(buildDir, "index.html"), html);
      return;
    }
    const directory = path.join(buildDir, route.slice(1));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "index.html"), html);
  });

  const sitemap = buildSitemap(allRoutes);
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(buildDir, "sitemap.xml"), sitemap);
  console.log(`Generated ${allRoutes.length} public SEO snapshots.`);
}

if (require.main === module) {
  writeSnapshots();
}

module.exports = {
  buildSnapshotHtml,
  buildSitemap,
  writeSnapshots,
};
