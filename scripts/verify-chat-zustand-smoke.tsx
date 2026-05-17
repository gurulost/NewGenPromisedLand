import { JSDOM } from "jsdom";
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { useChatUIState } from "../client/src/hooks/useChatUIState";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://127.0.0.1/",
});

Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, "HTMLElement", { value: dom.window.HTMLElement, configurable: true });
Object.defineProperty(globalThis, "Node", { value: dom.window.Node, configurable: true });

let renderCount = 0;

function SmokeComponent() {
  renderCount += 1;
  const setLobbyOpen = useChatUIState((state) => state.setLobbyOpen);
  const consumePeek = useChatUIState((state) => state.consumePeek);
  const lobbyState = useChatUIState((state) => state.byLobby.SMOKE);

  useEffect(() => {
    setLobbyOpen("SMOKE", true);
    consumePeek("SMOKE");
  }, [consumePeek, setLobbyOpen]);

  return <div>{lobbyState?.isOpen ? "open" : "closed"}</div>;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("missing root");

const root = createRoot(rootEl);
root.render(<SmokeComponent />);

await new Promise((resolve) => setTimeout(resolve, 100));

if (renderCount > 10) {
  throw new Error(`chat store render loop suspected: renderCount=${renderCount}`);
}

if (!rootEl.textContent?.includes("open")) {
  throw new Error(`chat store did not settle open: ${rootEl.textContent}`);
}

root.unmount();
console.log(`chat store smoke passed renderCount=${renderCount}`);
