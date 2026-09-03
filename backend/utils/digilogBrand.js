const APP_VERSION = 'v1';

function brandTitleHtml({
  color = '#1d4ed8',
  fontSize = '16px',
  align = 'left',
  versionColor = '#94a3b8',
} = {}) {
  return `<span style="font-weight:700;color:${color};font-size:${fontSize};text-align:${align};">
    DigiLog <span style="font-size:0.62em;font-weight:600;color:${versionColor};">${APP_VERSION}</span>
  </span>`;
}

function emailLogoBlockHtml(logoUrl, {
  width = 64,
  centered = true,
  withTitle = true,
  withTagline = false,
  linkHref = '',
} = {}) {
  const align = centered ? 'center' : 'left';
  const img = `<img src="${logoUrl}" alt="DigiLog" width="${width}" height="${width}"
    style="display:block;${centered ? 'margin:0 auto 8px;' : 'margin:0 0 8px;'}border:0;" />`;
  const wrappedImg = linkHref
    ? `<a href="${linkHref}" style="text-decoration:none;color:inherit;">${img}</a>`
    : img;
  const title = withTitle
    ? `<div style="text-align:${align};margin:0 0 ${withTagline ? '2px' : '12px'};">
        ${brandTitleHtml({ color: '#1d4ed8', fontSize: centered ? '18px' : '16px', align, versionColor: '#94a3b8' })}
      </div>`
    : '';
  const tagline = withTagline
    ? `<p style="color:#6b7280;font-size:14px;margin:0 0 12px;text-align:${align};">Your digital logbook</p>`
    : '';

  return `${wrappedImg}${title}${tagline}`;
}

function inlineBrandHeaderHtml(logoUrl, publicBase) {
  return `
    <div style="display:inline-flex;align-items:center;gap:10px;">
      <img src="${logoUrl}" alt="DigiLog" width="44" height="44" style="object-fit:contain;border:0;" />
      <span style="display:flex;flex-direction:column;line-height:1.2;">
        ${brandTitleHtml({ color: '#1d4ed8', fontSize: '16px' })}
        <span style="font-size:11px;color:#6b7280;">Your digital logbook</span>
      </span>
    </div>
  `;
}

module.exports = {
  APP_VERSION,
  brandTitleHtml,
  emailLogoBlockHtml,
  inlineBrandHeaderHtml,
};
