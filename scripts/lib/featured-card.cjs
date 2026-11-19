/**
 * featured-card.cjs
 *
 * Shared logic for building and posting the weekly "Featured Member" card.
 * Used by scripts/weekly-feature-card.js (local/manual runs) AND by the
 * weeklyFeaturedPost Cloud Function (functions/src/weeklyFeaturedPost.ts,
 * which gets an identical copy of this file via its prebuild step — see
 * functions/package.json). Keep this file the single source of truth for
 * the card's look and the Facebook posting logic; edit it here, not in two
 * places.
 *
 * Plain CommonJS (not ESM, not TypeScript) so it loads the same way from
 * the root package's ESM scripts (via dynamic/static `import` of a .cjs
 * file) and from functions' CommonJS TypeScript build (via `require`,
 * with allowJs enabled in functions/tsconfig.json).
 */

const PRIMARY = '#1e3a8a';
const PRIMARY_LIGHT = '#1e40af';
const PAGE_ID = '1061046777099271';
const SITE_URL = 'https://ctchickens.com';

function mapMemberToBreeder(member, id) {
  return {
    id,
    name: member.profile?.businessName || id,
    location: member.profile?.town || '',
    selling: member.offerings?.description || '',
    category: member.profile?.memberType || '',
    verified: member.account?.isVerified || false,
    founding_breeder: member.account?.foundingMember || null,
    logo: member.media?.logoUrl || null,
  };
}

// Mirrors getWeekNumber() in src/store/index.ts exactly.
function getWeekNumber(now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Mirrors the featuredBreeder getter in src/store/index.ts. `breeders` must
// already be in the same order as fetchDirectory's query (published,
// orderBy account.updatedAt desc) or the index picks a different member
// than what the live site currently shows as Featured.
function pickFeatured(breeders, forceSlug) {
  if (forceSlug) {
    return breeders.find((b) => b.id === forceSlug) || null;
  }
  const trusted = breeders.filter((b) => b.verified || b.founding_breeder);
  const pool = trusted.length > 0 ? trusted : breeders;
  if (pool.length === 0) return null;
  return pool[getWeekNumber() % pool.length];
}

// Rough greedy word-wrap using an average-character-width estimate (no real
// font metrics available at this stage) — good enough for a share card.
function wrapText(text, { fontSize, maxWidth, maxLines, avgCharWidthFactor = 0.55 }) {
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / (fontSize * avgCharWidthFactor)));
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  const consumedWords = lines.join(' ').split(/\s+/).length;
  const truncated = consumedWords < words.length;
  if (truncated) {
    let last = lines[lines.length - 1];
    while (last.length > maxCharsPerLine - 1 && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last.replace(/\s+$/, '') + '…';
  }
  return lines;
}

// The rendered font has no emoji/dingbat glyphs, and resvg renders the whole
// run as missing-glyph boxes when it hits one unsupported codepoint — so
// strip these out rather than escape them. Many real listings use emoji
// (✨🐓🧺♥️ etc.), so this isn't specific to one breeder.
function stripEmoji(text) {
  return String(text)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2190}-\u{2BFF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function measureTextWidth(text, fontSize, avgCharWidthFactor = 0.58) {
  return text.length * fontSize * avgCharWidthFactor;
}

// Drawn as plain vector shapes rather than icon-font glyphs (bi-check-circle-fill /
// bi-award-fill on the live site), so there's no font-glyph-coverage risk like the
// emoji bug above.
function checkCircleIcon(cx, cy, r, color) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />` +
    `<path d="M ${cx - r * 0.5} ${cy} L ${cx - r * 0.1} ${cy + r * 0.4} L ${cx + r * 0.55} ${cy - r * 0.35}" stroke="#ffffff" stroke-width="${Math.max(2, r * 0.26)}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
}

function awardIcon(cx, cy, r, color) {
  return `<circle cx="${cx}" cy="${cy - r * 0.15}" r="${r * 0.62}" fill="${color}" />` +
    `<path d="M ${cx - r * 0.32} ${cy + r * 0.15} L ${cx - r * 0.55} ${cy + r * 1.05} L ${cx} ${cy + r * 0.55} L ${cx + r * 0.55} ${cy + r * 1.05} L ${cx + r * 0.32} ${cy + r * 0.15} Z" fill="${color}" />`;
}

// A pill badge like the ones on the live site (VerifiedBadge.vue,
// FoundingBreederBadge.vue, and how FeaturedBreederBanner.vue renders them).
// Returns its rendered width so the next pill can be placed after it.
function buildPill({ x, y, text, bg, color, fontSize = 22, paddingX = 22, height = 46, icon = null }) {
  const iconSize = 26;
  const iconGap = 10;
  const leadWidth = icon ? iconSize + iconGap : 0;
  const width = leadWidth + measureTextWidth(text, fontSize) + paddingX * 2;
  const cy = y + height / 2;
  const textY = cy + fontSize * 0.33;
  const textX = x + paddingX + leadWidth;
  const iconSvg = icon ? icon(x + paddingX + iconSize / 2, cy, iconSize / 2, color) : '';
  return {
    width,
    svg: `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${bg}" />` +
      iconSvg +
      `<text x="${textX}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="${color}">${escapeXml(text)}</text>`,
  };
}

// Truncates to a single line that fits maxWidth (used for the footer link,
// which shouldn't wrap).
function truncateToWidth(text, { fontSize, maxWidth, avgCharWidthFactor = 0.52 }) {
  const maxChars = Math.max(1, Math.floor(maxWidth / (fontSize * avgCharWidthFactor)));
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(1, maxChars - 1)) + '…';
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchImageAsDataUri(url, fallbackUrl) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn(`  (image fetch failed for ${url}: ${e.message})`);
    if (fallbackUrl) return fetchImageAsDataUri(fallbackUrl, null);
    return null;
  }
}

// Same navy gradient + diamond pattern used in the email header
// (functions/templates/_layout.html) and FeaturedBreederBanner.vue.
function buildSvg({
  name: rawName,
  location: rawLocation,
  category: rawCategory,
  blurb: rawBlurb,
  logoDataUri,
  verified,
  foundingMember,
  profilePath,
}) {
  const name = stripEmoji(rawName);
  const location = stripEmoji(rawLocation);
  const category = stripEmoji(rawCategory);
  const blurb = stripEmoji(rawBlurb);

  const W = 1200;
  const LOGO_X = 80;
  const LOGO_Y = 150;
  const LOGO_SIZE = 180;
  const TEXT_X = LOGO_X + LOGO_SIZE + 40; // 300
  const RIGHT_MARGIN = 80;
  const nameMaxWidth = W - TEXT_X - RIGHT_MARGIN;

  const subtext = [location, category].filter(Boolean).join('   ·   ');

  // Shrink the name font size for longer business names, then wrap what's left.
  const nameFontSize = name.length > 34 ? 38 : name.length > 22 ? 46 : 54;
  const nameLines = wrapText(name, { fontSize: nameFontSize, maxWidth: nameMaxWidth, maxLines: 2 });
  const nameLineHeight = nameFontSize * 1.12;
  const nameStartY = LOGO_Y + 52;
  const nameTspans = nameLines
    .map((line, i) => `<tspan x="${TEXT_X}" y="${nameStartY + i * nameLineHeight}">${escapeXml(line)}</tspan>`)
    .join('');
  const subtextY = nameStartY + nameLines.length * nameLineHeight + 14;

  const blurbLines = blurb
    ? wrapText(blurb, { fontSize: 25, maxWidth: W - LOGO_X - RIGHT_MARGIN, maxLines: 4, avgCharWidthFactor: 0.5 })
    : [];
  const blurbStartY = LOGO_Y + LOGO_SIZE + 70;
  const blurbLineHeight = 36;
  const blurbTspans = blurbLines
    .map((line, i) => `<tspan x="${LOGO_X}" y="${blurbStartY + i * blurbLineHeight}">${escapeXml(line)}</tspan>`)
    .join('');
  const afterBlurbY = blurbLines.length > 0
    ? blurbStartY + (blurbLines.length - 1) * blurbLineHeight
    : subtextY;

  // Footer link: the actual profile URL instead of just the generic domain.
  // Must keep the "/#/" — the site uses hash-based routing (createWebHashHistory
  // in src/router/index.ts), so the path-only form without the hash just
  // redirects to the homepage instead of the profile.
  const footerLinkFontSize = 24;
  const footerLinkText = profilePath
    ? truncateToWidth(`ctchickens.com/#/directory/${profilePath}`, {
        fontSize: footerLinkFontSize,
        maxWidth: W - LOGO_X - RIGHT_MARGIN - 320,
      })
    : 'ctchickens.com';

  // Badge row: Featured (always) + Verified / Founding Member when applicable,
  // mirroring FeaturedBreederBanner.vue's badge styling.
  const badgeY = 70;
  let badgeX = LOGO_X;
  const badgePills = [];
  const featuredPill = buildPill({ x: badgeX, y: badgeY, text: '★ Featured Member of the Week', bg: '#ffffff', color: PRIMARY });
  badgePills.push(featuredPill.svg);
  badgeX += featuredPill.width + 16;
  if (verified) {
    const p = buildPill({ x: badgeX, y: badgeY, text: 'Verified', bg: '#ffffff', color: PRIMARY, icon: checkCircleIcon });
    badgePills.push(p.svg);
    badgeX += p.width + 16;
  }
  if (foundingMember) {
    const p = buildPill({ x: badgeX, y: badgeY, text: `Founding Member #${foundingMember}`, bg: '#f59e0b', color: '#1f2937', icon: awardIcon });
    badgePills.push(p.svg);
    badgeX += p.width + 16;
  }

  // Height adapts to how much content there actually is, instead of a fixed
  // canvas leaving a lot of dead blue space under a short blurb.
  const logoBottom = LOGO_Y + LOGO_SIZE;
  const textBottom = afterBlurbY + 20;
  const FOOTER_HEIGHT = 80;
  const BOTTOM_PADDING = 50;
  const H = Math.max(Math.max(logoBottom, textBottom) + BOTTOM_PADDING + FOOTER_HEIGHT, 460);

  const logoImage = logoDataUri
    ? `<image href="${logoDataUri}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoClip)" />`
    : '';

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}" />
      <stop offset="100%" stop-color="${PRIMARY_LIGHT}" />
    </linearGradient>
    <pattern id="diamonds" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z" fill="#ffffff" fill-opacity="0.05"/>
    </pattern>
    <clipPath id="logoClip"><rect x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" rx="16" /></clipPath>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)" />
  <rect width="${W}" height="${H}" fill="url(#diamonds)" />

  <!-- badges -->
  ${badgePills.join('\n  ')}

  <!-- logo chip -->
  <rect x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" rx="16" fill="rgba(255,255,255,0.15)" />
  ${logoImage}

  <!-- name + subtext -->
  <text font-family="Arial, Helvetica, sans-serif" font-size="${nameFontSize}" font-weight="700" fill="#ffffff">${nameTspans}</text>
  <text x="${TEXT_X}" y="${subtextY}" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="rgba(255,255,255,0.78)">${escapeXml(subtext)}</text>

  <!-- blurb -->
  <text font-family="Arial, Helvetica, sans-serif" font-size="25" fill="rgba(255,255,255,0.88)">${blurbTspans}</text>

  <!-- footer -->
  <rect x="0" y="${H - 80}" width="${W}" height="80" fill="rgba(0,0,0,0.18)" />
  <text x="${LOGO_X}" y="${H - 30}" font-family="Arial, Helvetica, sans-serif" font-size="${footerLinkFontSize}" font-weight="700" fill="#ffffff">${escapeXml(footerLinkText)}</text>
  <text x="${W - RIGHT_MARGIN}" y="${H - 30}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="rgba(255,255,255,0.78)" text-anchor="end">Connecticut Backyard Chickens</text>
</svg>`;
}

function buildCaption(featured) {
  const profileUrl = `ctchickens.com/#/directory/${featured.id}`;
  // Business name without the "(Owner Name)" suffix, same split FeaturedBreederBanner.vue uses.
  const displayName = featured.name.replace(/\s*\([^)]*\)\s*$/, '').trim() || featured.name;
  return [
    `This week's Featured Member is ${displayName}!`,
    '',
    'Profile link 🔗',
    profileUrl,
  ].join('\n');
}

// Posts the rendered PNG + caption to the Page, using a System User token
// (or any token with pages_manage_posts on PAGE_ID). Returns the created
// post's id and permalink_url.
async function postFeaturedPhoto(pngBuffer, caption, systemToken) {
  const accountsRes = await fetch('https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token', {
    headers: { Authorization: `Bearer ${systemToken}` },
  });
  const accountsJson = await accountsRes.json();
  const pageToken = accountsJson.data?.find((p) => p.id === PAGE_ID)?.access_token;
  if (!pageToken) {
    throw new Error('Could not resolve a Page access token for PAGE_ID from the system user token.');
  }

  const form = new FormData();
  form.append('caption', caption);
  form.append('access_token', pageToken);
  form.append('source', new Blob([pngBuffer], { type: 'image/png' }), 'featured.png');

  const postRes = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/photos`, {
    method: 'POST',
    body: form,
  });
  const postJson = await postRes.json();
  if (postJson.error) {
    throw new Error(`Facebook API error: ${postJson.error.message}`);
  }

  const postId = `${PAGE_ID}_${postJson.post_id || postJson.id}`;
  const permalinkRes = await fetch(`https://graph.facebook.com/v21.0/${postId}?fields=permalink_url`, {
    headers: { Authorization: `Bearer ${pageToken}` },
  });
  const permalinkJson = await permalinkRes.json();

  return { ...postJson, id: postId, permalink_url: permalinkJson.permalink_url };
}

module.exports = {
  PAGE_ID,
  SITE_URL,
  mapMemberToBreeder,
  getWeekNumber,
  pickFeatured,
  fetchImageAsDataUri,
  buildSvg,
  buildCaption,
  postFeaturedPhoto,
};
