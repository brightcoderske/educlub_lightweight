import { useEffect } from "react";
import {
  COURSE_PATHS,
  getPublicPage,
  PUBLIC_PAGES,
  SITE_CONTACT,
  SITE_ORIGIN,
} from "./publicPages";

function setMeta(selector, attributes) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function setCanonical(href) {
  let element = document.querySelector("link[rel='canonical']");
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export function getSeoData(pathname) {
  const { path, page } = getPublicPage(pathname);
  if (!page) {
    return {
      title: "Page Not Found | eduClub",
      description: "The requested eduClub page could not be found.",
      canonical: `${SITE_ORIGIN}${pathname}`,
      robots: "noindex, follow",
      page: null,
      path,
    };
  }
  return {
    title: page.title,
    description: page.description,
    canonical: `${SITE_ORIGIN}${path === "/" ? "/" : path}`,
    robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    page,
    path,
  };
}

export function buildStructuredData(pathname) {
  const seo = getSeoData(pathname);
  if (!seo.page) return [];

  const organization = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "eduClub",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/apple-icon.png`,
    email: SITE_CONTACT.email,
    telephone: SITE_CONTACT.phoneInternational,
    areaServed: { "@type": "Country", name: "Kenya" },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SITE_CONTACT.email,
      telephone: SITE_CONTACT.phoneInternational,
      availableLanguage: ["English", "Swahili"],
    },
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "eduClub",
    url: SITE_ORIGIN,
    description: PUBLIC_PAGES["/"].description,
  };
  const schemas = [organization, website];

  if (COURSE_PATHS.includes(seo.path)) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Course",
      name: seo.page.h1,
      description: seo.page.description,
      provider: {
        "@type": "EducationalOrganization",
        name: "eduClub",
        sameAs: SITE_ORIGIN,
      },
      educationalLevel: "Children and school-age learners",
      inLanguage: "en",
    });
  }
  if (seo.page.type === "catalogue") {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: COURSE_PATHS.map((path, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_ORIGIN}${path}`,
        name: PUBLIC_PAGES[path].h1,
      })),
    });
  }
  if (seo.page.faqs?.length) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: seo.page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  }
  return schemas;
}

export default function usePublicSeo(pathname) {
  useEffect(() => {
    const seo = getSeoData(pathname);
    document.title = seo.title;
    setMeta("meta[name='description']", { name: "description", content: seo.description });
    setMeta("meta[name='robots']", { name: "robots", content: seo.robots });
    setMeta("meta[name='keywords']", {
      name: "keywords",
      content: seo.page?.keywords?.join(", ") || "",
    });
    setMeta("meta[property='og:title']", { property: "og:title", content: seo.title });
    setMeta("meta[property='og:description']", {
      property: "og:description",
      content: seo.description,
    });
    setMeta("meta[property='og:type']", { property: "og:type", content: "website" });
    setMeta("meta[property='og:url']", { property: "og:url", content: seo.canonical });
    setMeta("meta[property='og:image']", {
      property: "og:image",
      content: `${SITE_ORIGIN}/apple-icon.png`,
    });
    setMeta("meta[name='twitter:card']", { name: "twitter:card", content: "summary_large_image" });
    setMeta("meta[name='twitter:title']", { name: "twitter:title", content: seo.title });
    setMeta("meta[name='twitter:description']", {
      name: "twitter:description",
      content: seo.description,
    });
    setCanonical(seo.canonical);

    const id = "educlub-public-structured-data";
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.text = JSON.stringify(buildStructuredData(pathname));
    document.head.appendChild(script);
  }, [pathname]);
}
