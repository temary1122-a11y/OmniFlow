// Renamed from postcss.config.js — this config is orphaned for the host build.
// The host is built with `tsc` (not vite) and does not use Tailwind/PostCSS.
// It was moved out of the way so vite (run from the nested `webview-ui` folder)
// does not discover a parent PostCSS config during the Tailwind v4 webview build.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
