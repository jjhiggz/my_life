import { onCleanup, onMount } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

type TerminalViewProps = {
  outputEvent?: string;
  openCommand?: string;
  writeCommand?: string;
  resizeCommand?: string;
  openArgs?: Record<string, unknown>;
};

function themeColor(variable: string): string {
  return `hsl(${getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim()})`;
}

export default function TerminalView(props: TerminalViewProps = {}) {
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
        background: themeColor("--background"),
        foreground: themeColor("--foreground"),
      },
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    const outputEvent = props.outputEvent ?? "pty-output";
    const openCommand = props.openCommand ?? "pty_open";
    const writeCommand = props.writeCommand ?? "pty_write";
    const resizeCommand = props.resizeCommand ?? "pty_resize";

    unlisten = await listen<string>(outputEvent, (event) => {
      term.write(event.payload);
    });

    term.onData((data) => {
      invoke(writeCommand, { data });
    });

    await invoke(openCommand, {
      ...(props.openArgs ?? {}),
      rows: term.rows,
      cols: term.cols,
    });

    resizeObserver = new ResizeObserver(() => {
      fit.fit();
      invoke(resizeCommand, { rows: term.rows, cols: term.cols });
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
