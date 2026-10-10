export const SITE_URL = "https://inbooc.grok.me";
export const SITE_NAME = "NAKA HOME";
export const SITE_TITLE = "NAKA HOME";
export const SITE_DESCRIPTION =
  "NAKA HOME is a civil construction labour marketplace. Book masons, steel fixers, shuttering workers, plaster workers, painters, electricians, plumbers, helpers, excavation and loading labour near you.";
export const SITE_KEYWORDS =
  "NAKA HOME, civil labour booking, mason, steel fixer, shuttering, plaster, plumber, electrician, painter, excavation, construction labour";
export const LOGO_PATH = "/logo.png";
export const LOGO_URL = `${SITE_URL}${LOGO_PATH}`;

export const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: LOGO_URL,
      },
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-IN",
    },
  ],
};
