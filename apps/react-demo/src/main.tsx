/**
 * Entry point for the React browser demo — mounts the App component
 * into the DOM root element.
 *
 * @module apps/react-demo/src/main
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/** DOM element that hosts the React tree — resolved once at startup. */
const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element in document");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
