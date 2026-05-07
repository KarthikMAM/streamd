/**
 * Entry point for the React Native web demo — mounts the App component
 * into the DOM root element using React 19's `createRoot` API.
 *
 * @module apps/react-native-demo/src/main
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

/** DOM element that hosts the React tree — must exist in `index.html`. */
const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
