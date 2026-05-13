import { onCleanup, onMount } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

export default function TerminalView() {
  let host!: HTMLDivElement;
  let term: Terminal;
  let fit: FitAddon;
  let unlisten: UnlistenFn | undefined;
  let resizeObserver: ResizeObserver | undefined;

  onMount(async () => {
    term = new Terminal({
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
      },
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    unlisten = await listen<string>("pty-output", (event) => {
      term.write(event.payload);
    });

    term.onData((data) => {
      invoke("pty_write", { data });
    });

    await invoke("pty_open", { rows: term.rows, cols: term.cols });

    resizeObserver = new ResizeObserver(() => {
      fit.fit();
      invoke("pty_resize", { rows: term.rows, cols: term.cols });
    });
    resizeObserver.observe(host);
  });

  onCleanup(() => {
    unlisten?.();
    resizeObserver?.disconnect();
    term?.dispose();
  });

  return <div ref={host} style={{ width: "100%", height: "100%" }} />;
}
