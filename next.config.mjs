/** @type {import('next').NextConfig} */

// GitHub Pages 项目站点会部署在 https://<用户名>.github.io/<仓库名>/ 子路径下，
// 因此构建时需要设置 basePath。GitHub Actions 会注入 PAGES_BASE_PATH；
// 本地 `npm run dev` / `npm run build` 不设置该变量，即以根路径运行，方便调试。
const basePath = process.env.PAGES_BASE_PATH || '';

const nextConfig = {
  output: 'export', // 纯静态导出，产物在 out/，可直接托管到 GitHub Pages
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
