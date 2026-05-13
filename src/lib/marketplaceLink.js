const WB_ARTICLE_RE = /\b\d{5,15}\b/;
const WB_ARTICLE_GLOBAL_RE = /\b\d{5,15}\b/g;
const WB_CATALOG_RE = /\/catalog\/(\d{5,15})(?:[/?#]|$)/i;
const WB_QUERY_KEYS = ['nm', 'nmid', 'nmId', 'article', 'sku', 'product', 'productId'];

function normalizeUrlCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) return raw;
  if (/^(www\.)?(wildberries|wb)\.ru/i.test(raw)) return `https://${raw}`;
  return raw;
}

function isWildberriesHost(hostname) {
  const host = String(hostname || '').replace(/^www\./i, '').toLowerCase();
  return host === 'wildberries.ru' || host.endsWith('.wildberries.ru') || host === 'wb.ru' || host.endsWith('.wb.ru');
}

function firstQueryArticle(searchParams) {
  for (const key of WB_QUERY_KEYS) {
    const value = searchParams.get(key);
    const match = String(value || '').match(WB_ARTICLE_RE);
    if (match) return match[0];
  }
  return '';
}

export function extractWbArticleFromInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const plainMatch = raw.match(/^\d{5,15}$/);
  if (plainMatch) return plainMatch[0];

  try {
    const url = new URL(normalizeUrlCandidate(raw));
    if (!isWildberriesHost(url.hostname)) return '';

    const pathMatch = url.pathname.match(WB_CATALOG_RE);
    if (pathMatch) return pathMatch[1];

    const queryArticle = firstQueryArticle(url.searchParams);
    if (queryArticle) return queryArticle;
  } catch {
    // Fall through to pasted text parsing.
  }

  const catalogMatch = raw.match(WB_CATALOG_RE);
  if (catalogMatch) return catalogMatch[1];

  const allNumbers = raw.match(WB_ARTICLE_GLOBAL_RE);
  return allNumbers?.[0] || '';
}
