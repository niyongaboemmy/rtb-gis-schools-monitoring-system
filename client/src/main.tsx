import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Font files, self-hosted (no Google Fonts call). The typography system that
// uses them — and how to swap in genuine AeroCircle files — is in
// styles/typography.css. Google Sans Flex: weight build, ~50 KB Latin, 1–1000.
// Maple Mono: 400/700 only (~75 KB each); other weights use the nearest.
import "@fontsource-variable/google-sans-flex/wght.css";
import "@fontsource/maple-mono/400.css";
import "@fontsource/maple-mono/700.css";
import "./index.css";
import App from "./App.tsx";
import { installScrollbars } from "./lib/scrollbars";
import { ThemeProvider } from "./components/ThemeProvider.tsx";

installScrollbars();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="rtb-gis-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
