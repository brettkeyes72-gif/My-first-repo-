// Builds every article under content/articles into content/dist:
//   dist/<slug>/index.html                  the full article
//   dist/<slug>/modules/<id>.html           each module as a standalone page
//   dist/<slug>/fragments/<id>.html         each module as a bare fragment to embed
//   dist/<slug>/modules.json                index of the pieces (for serving them separately)
// Usage: node content/build.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const css = readFileSync(join(root, "shared/truck-content.css"), "utf8");
const js = readFileSync(join(root, "shared/truck-content.js"), "utf8");
const fonts = "https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Poppins:wght@400;500;600&display=swap";

const fill = (html, vars) => html.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const head = (title, desc, base) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} | TRUCK Gloves</title><meta name="description" content="${esc(desc)}">
<link rel="icon" href="${base}assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}"><style>${css}</style></head>`;

const header = (base) => `<header style="padding:14px 16px 12px;border-bottom:1px solid #e5e5e5;text-align:center;background:#fff"><a href="https://www.truckgloves.com"><img src="${base}assets/truck-logo-black.png" alt="TRUCK" width="500" height="90" style="height:30px;width:auto"></a></header>`;

rmSync(dist, { recursive: true, force: true });
const articlesDir = join(root, "articles");
for (const dir of readdirSync(articlesDir)) {
  const src = join(articlesDir, dir);
  const meta = JSON.parse(readFileSync(join(src, "article.json"), "utf8"));
  const vars = { ...meta, ...meta.links };
  const out = join(dist, meta.slug);
  mkdirSync(join(out, "modules"), { recursive: true });
  mkdirSync(join(out, "fragments"), { recursive: true });
  cpSync(join(root, "../assets"), join(out, "assets"), { recursive: true });
  if (existsSync(join(src, "img"))) cpSync(join(src, "img"), join(out, "img"), { recursive: true });

  const index = [];
  const parts = meta.modules.map((id) => {
    const file = join(src, "modules", `${id}.html`);
    if (!existsSync(file)) throw new Error(`Missing module: ${id}`);
    const html = fill(readFileSync(file, "utf8"), vars).trim();
    const title = (html.match(/data-title="([^"]*)"/) || [])[1] || id;
    writeFileSync(join(out, "fragments", `${id}.html`), html + "\n");
    writeFileSync(join(out, "modules", `${id}.html`),
      `${head(title, meta.description, "../")}<body class="tg-page">${html}<script>${js}</script></body></html>`);
    index.push({ id, title, page: `modules/${id}.html`, fragment: `fragments/${id}.html` });
    return html;
  });

  writeFileSync(join(out, "modules.json"), JSON.stringify({ slug: meta.slug, title: meta.title, modules: index }, null, 2));
  writeFileSync(join(out, "index.html"),
    `${head(meta.title, meta.description, "")}<body class="tg-page">${header("")}${parts.join("\n")}<script>${js}</script></body></html>`);
  console.log(`built ${meta.slug}: ${parts.length} modules`);
}
