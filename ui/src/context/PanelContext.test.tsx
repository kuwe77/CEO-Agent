// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PanelProvider, usePanel } from "./PanelContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = "paperclip:panel-visible";

let capturedValue: ReturnType<typeof usePanel> | null = null;

function Capture() {
  capturedValue = usePanel();
  return null;
}

describe("PanelContext", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(async () => {
    localStorage.clear();
    capturedValue = null;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <PanelProvider>
          <Capture />
        </PanelProvider>,
      );
    });
  });

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    host?.remove();
    root = null;
    host = null;
    capturedValue = null;
    localStorage.clear();
  });

  it("can temporarily hide the panel without overwriting the saved desktop preference", async () => {
    localStorage.setItem(STORAGE_KEY, "true");

    await act(async () => capturedValue?.setPanelVisible(false, { persist: false }));

    expect(capturedValue?.panelVisible).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });
});
