// Static export: `npm run build` produces plain HTML/JS files in out/, which GitHub Pages can host.
// NEXT_PUBLIC_BASE_PATH is set by the GitHub workflow (e.g. "/call-journal"); it's empty locally.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};
