// 构建脚本：把正式静态资源复制到 dist/，供 Cloudflare Pages 部署。
// 明确排除开发/敏感文件，避免误发布。

import { cpSync, rmSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

// 按顶层条目名排除；.env* 前缀单独处理
const EXCLUDE = new Set([
  '.git',
  'node_modules',
  'dist',
  '.wrangler',
  'functions',
  'migrations',
  'scripts',
  'tests',
  '.claude',
  '.claude.json',
  '.DS_Store',
  '.nojekyll',
  '.gitignore',
  '.gitattributes',
  'index.backup-before-stardew-merge.html',
  'mobile-preview.html',
  'package.json',
  'package-lock.json',
  'wrangler.jsonc',
  'wrangler.toml',
  '.dev.vars'
]);

function shouldExclude(name) {
  if (EXCLUDE.has(name)) return true;
  if (name.startsWith('.env')) return true;
  return false;
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (shouldExclude(entry)) continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

// —— 静态媒体资源迁至阿里云 OSS ——
// 把 dist 里 .html/.css/.js 中引用的图片/音频等媒体文件，从相对路径重写为 OSS 绝对地址。
// 只重写媒体扩展名；字体(woff2/ttf)留在 Cloudflare，避免跨域 CORS 配置。
// 若需回退：删除下面这段重写逻辑（以及 rewriteAssets 调用），重新构建即可。
const ASSET_BASE = 'https://df-wedding-invitation.oss-cn-hangzhou.aliyuncs.com/invitation/dist';
const MEDIA_RE = /\.(png|jpe?g|gif|webp|webm|mp4|mp3|ico)$/i;

function toOssUrl(url, relDir) {
  if (!MEDIA_RE.test(url)) return null;
  const rel = url.replace(/^\.\/+/, '');
  const full = relDir ? `${relDir}/${rel}` : rel;
  return `${ASSET_BASE}/${encodeURI(full)}`;
}

function rewriteAssets(dir, relDir = '') {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      rewriteAssets(p, relDir ? `${relDir}/${entry}` : entry);
      continue;
    }
    if (!/\.(html|css|js)$/i.test(entry)) continue;
    let s = readFileSync(p, 'utf8');

    // CSS: url('./x.png') / url("x.png") / url(x.png)
    s = s.replace(/url\((['"]?)([^)'"]+?)\1\)/gi, (m, q, u) => {
      const oss = toOssUrl(u, relDir);
      return oss ? `url(${q}${oss}${q})` : m;
    });

    // HTML/JS: src="./x.png" / href="./x.png" / poster / data-src
    s = s.replace(/(src|href|poster|data-src)=(['"])([^'"]+?)\2/gi, (m, attr, q, u) => {
      const oss = toOssUrl(u, relDir);
      return oss ? `${attr}=${q}${oss}${q}` : m;
    });

    writeFileSync(p, s);
  }
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
copyDir(root, dist);
rewriteAssets(dist);
console.log('Build complete -> dist/ (媒体已重写至 OSS)');
