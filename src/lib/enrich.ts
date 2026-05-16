export interface CompanyEnrichment {
  domain: string | null;
  websiteSummary: string | null;
  enriched: boolean;
  companyName: string | null;
  source: string | null;
}

const SCRAPE_TIMEOUT_MS = 8000;
const MAX_TEXT_LENGTH = 2500;

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta\\s[^>]*?(?:name|property)=["']${name}["'][^>]*?content=["']([^"']*)["']`,
    "i",
  );
  const match = regex.exec(html);
  return match ? match[1] : null;
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length < 100) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return null;
    return text;
  } catch {
    return null;
  }
}

function summarizePage(html: string, domain: string): string {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const desc =
    extractMetaContent(html, "description") ??
    extractMetaContent(html, "og:description") ??
    "";
  const h1 = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim();

  const body = stripHtml(html);

  const parts: string[] = [];
  if (title) parts.push(`Title: ${title}`);
  if (desc) parts.push(`Description: ${desc}`);
  if (h1) parts.push(`Heading: ${h1}`);
  const cleaned = body.replace(title ?? "", "").replace(desc, "");
  parts.push(cleaned.slice(0, MAX_TEXT_LENGTH));

  return parts.join("\n\n").slice(0, MAX_TEXT_LENGTH * 2);
}

function extractCompanyName(html: string): string | null {
  const ogSiteName = extractMetaContent(html, "og:site_name");
  if (ogSiteName) return ogSiteName;

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if (title) {
    const cleaned = title.replace(/ - .*$/, "").replace(/ \| .*$/, "").trim();
    if (cleaned) return cleaned;
  }
  return null;
}

export async function enrichFromWeb(
  fromEmail: string,
  knownCompany?: string | null,
): Promise<CompanyEnrichment> {
  const domain = fromEmail.split("@")[1]?.toLowerCase();
  if (!domain || domain.startsWith("gmail.") || domain.startsWith("yahoo.") || domain.startsWith("outlook.") || domain.startsWith("hotmail.")) {
    return { domain, websiteSummary: null, enriched: false, companyName: knownCompany ?? null, source: null };
  }

  const urls = [`https://www.${domain}`, `https://${domain}`];
  let html: string | null = null;
  let usedUrl: string | null = null;

  for (const url of urls) {
    html = await tryFetch(url);
    if (html) {
      usedUrl = url;
      break;
    }
  }

  if (!html) {
    return { domain, websiteSummary: null, enriched: false, companyName: knownCompany ?? null, source: null };
  }

  const companyName = extractCompanyName(html) ?? knownCompany ?? null;
  const websiteSummary = summarizePage(html, domain);

  return {
    domain,
    websiteSummary,
    enriched: true,
    companyName,
    source: usedUrl,
  };
}
