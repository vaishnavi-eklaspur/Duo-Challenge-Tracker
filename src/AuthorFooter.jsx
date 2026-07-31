import React from "react";

/**
 * AuthorFooter — a uniform personal-branding footer to drop into any project.
 * Self-contained: no Tailwind, no icon library, no external CSS.
 * Usage: <AuthorFooter productName="My App" tagline="Python · FastAPI · Next.js" />
 */

// ── Brand identity: keep IDENTICAL across every project.
//    (tagline is NOT here — it's this project's stack, passed via the prop.) ──
export const AUTHOR = {
  name: "Vaishnavi Eklaspur",
  initials: "VE",
  portfolio: "https://vaishnavieklaspur-portfolio.vercel.app/",
  github: "https://github.com/vaishnavi-eklaspur",
  linkedin: "https://www.linkedin.com/in/vaishnavi-eklaspur/",
};

const ICONS = {
  portfolio: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  ),
};

// Themed for Duo Challenge Tracker's dark palette (bg #0a0a0a, amber accent,
// Syne + DM Mono). Recolor this block per project; markup + brand stay fixed.
const CSS = `
.af-footer{background:#0a0a0a;border-top:1px solid #1e1e1e;padding:24px 0;font-family:'Syne',system-ui,-apple-system,sans-serif;}
.af-row{max-width:1152px;margin:0 auto;padding:0 24px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px;}
.af-id{display:flex;align-items:center;gap:12px;text-decoration:none;}
.af-avatar{width:36px;height:36px;border-radius:9999px;background:#f5a623;color:#0a0a0a;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;letter-spacing:.02em;transition:opacity .15s;}
.af-id:hover .af-avatar{opacity:.85;}
.af-name{margin:0;font-size:12px;font-weight:600;color:#f0ece4;line-height:1.2;transition:color .15s;}
.af-id:hover .af-name{color:#f5a623;}
.af-tag{margin:0;font-size:11px;color:#6b6660;line-height:1.2;font-family:'DM Mono',monospace;}
.af-links{display:flex;align-items:center;gap:4px;}
.af-icon{width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#6b6660;transition:color .15s,background .15s;}
.af-icon:hover{color:#f0ece4;background:#1e1e1e;}
.af-text{padding:0 8px;font-size:11px;font-weight:600;color:#6b6660;text-decoration:none;transition:color .15s;font-family:'DM Mono',monospace;}
.af-text:hover{color:#f0ece4;}
.af-div{display:inline-block;margin:0 4px;height:16px;width:1px;background:#1e1e1e;}
.af-copy-wrap{max-width:1152px;margin:16px auto 0;padding:12px 24px 0;border-top:1px solid #1e1e1e;}
.af-copy{margin:0;font-size:11px;color:#6b6660;font-family:'DM Mono',monospace;}
`;

const SOCIALS = [
  { label: "Portfolio", href: AUTHOR.portfolio, icon: ICONS.portfolio },
  { label: "GitHub", href: AUTHOR.github, icon: ICONS.github },
  { label: "LinkedIn", href: AUTHOR.linkedin, icon: ICONS.linkedin },
];

export default function AuthorFooter({ productName = "", tagline = "", children }) {
  return (
    <footer className="af-footer">
      <style>{CSS}</style>
      <div className="af-row">
        <a className="af-id" href={AUTHOR.portfolio} target="_blank" rel="noopener noreferrer">
          <span className="af-avatar">{AUTHOR.initials}</span>
          <span>
            <span className="af-name" style={{ display: "block" }}>Built by {AUTHOR.name}</span>
            {tagline && <span className="af-tag" style={{ display: "block" }}>{tagline}</span>}
          </span>
        </a>
        <div className="af-links">
          {children}
          {SOCIALS.map((s) => (
            <a key={s.label} className="af-icon" href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}>
              {s.icon}
            </a>
          ))}
        </div>
      </div>
      <div className="af-copy-wrap">
        <p className="af-copy">
          © {new Date().getFullYear()} {productName ? productName + " — " : ""}a portfolio project by {AUTHOR.name}.
        </p>
      </div>
    </footer>
  );
}
