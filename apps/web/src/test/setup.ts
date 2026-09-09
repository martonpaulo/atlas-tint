import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom implements no scrolling, and the region list calls scrollIntoView to keep the
// keyboard-active row visible. A no-op keeps that behavior testable without a layout engine.
if (!Element.prototype.scrollIntoView)
	Element.prototype.scrollIntoView = () => undefined;

afterEach(() => cleanup());
