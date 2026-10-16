// Local initials avatar: no third-party request, and the user's email is never sent anywhere (AUD-54).
const PALETTE = ['#fa9a1d', '#6366f1', '#10b981', '#0ea5e9', '#ec4899', '#8b5cf6'];

const escapeXml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const buildInitialsAvatar = (firstName: string, lastName: string, seed: string): string => {
    const initials = `${(firstName || '').trim().charAt(0)}${(lastName || '').trim().charAt(0)}`.toUpperCase() || '?';
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const color = PALETTE[hash % PALETTE.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">` +
        `<rect width="150" height="150" fill="${color}"/>` +
        `<text x="75" y="75" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#fff">${escapeXml(initials)}</text>` +
        `</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};
