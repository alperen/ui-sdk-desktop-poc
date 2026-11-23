import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const provider = createRequire(
  require.resolve("@vitest/browser-playwright/package.json"),
);
const browserPackage = createRequire(
  provider.resolve("@vitest/browser/package.json"),
);
const { PNG } = browserPackage("pngjs");
const output = fileURLToPath(
  new URL("../tests/__screenshots__/parity/", import.meta.url),
);
const base = process.argv[2] ?? "http://127.0.0.1:5173";
const session = `${execFileSync(
  "agent-browser",
  ["session", "id", "--scope", "worktree", "--prefix", "desktop-validation"],
  { encoding: "utf8" },
).trim()}-comparison`;
const states = new Map();
mkdirSync(output, { recursive: true });

function browser(...args) {
  return execFileSync(
    "agent-browser",
    ["--session", session, ...args.map(String)],
    { encoding: "utf8", timeout: 30000 },
  ).trim();
}
function ref(role, name) {
  const snapshot = JSON.parse(browser("snapshot", "-i", "--json"));
  const match = Object.entries(snapshot.data.refs).find(
    ([, entry]) => entry.role === role && entry.name === name,
  );
  assert.ok(match, `Missing ${role}: ${name}\n${snapshot.data.snapshot}`);
  return `@${match[0]}`;
}
function evalRead(code) {
  const response = JSON.parse(browser("eval", code, "--json"));
  assert.ok(response.success, JSON.stringify(response.error));
  return response.data.result;
}
function capture(implementation, name) {
  browser("mouse", "move", 960, 620);
  browser(
    "wait",
    "--fn",
    'document.getAnimations().every(animation => animation.playState !== "running")',
  );
  evalRead(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
  );
  browser(
    "wait",
    "--fn",
    'document.getAnimations().every(animation => animation.playState !== "running")',
  );
  const screenshot = path.join(output, `${implementation}-${name}.png`);
  let previous;
  let stable = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    browser(
      "wait",
      "--fn",
      'document.getAnimations().every(animation => animation.playState !== "running")',
    );
    browser("screenshot", screenshot);
    const pixels = PNG.sync.read(readFileSync(screenshot)).data;
    if (previous?.equals(pixels)) {
      stable = true;
      break;
    }
    previous = pixels;
  }
  assert.ok(
    stable,
    `${implementation}-${name} did not settle to two identical frames`,
  );
  const state =
    evalRead(`Array.from(document.querySelectorAll('.desktop-item,[role="listbox"],[data-slot="window"],[role="radio"],[role="menu"],[role="menuitem"],input:not([type="radio"])')).map(el => ({
    role: el.getAttribute('role') || (el.matches('[data-slot="window"]') ? 'region' : 'textbox'),
    name: el.getAttribute('aria-label') || el.textContent.replace(/\\s+/g,' ').trim(),
    selected: el.getAttribute('aria-selected'), checked: el.getAttribute('aria-checked'), disabled: el.getAttribute('aria-disabled'),
    focused: document.activeElement === el, focusVisible: el.matches(':focus-visible'),
    box: Array.from(['x','y','width','height'], key => el.getBoundingClientRect()[key]),
  }))`);
  states.set(`${implementation}-${name}`, state);
  console.log(`${implementation}: ${name}`);
}

try {
  for (const [implementation, suffix] of [
    ["sdk", "/src/ui-sdk/"],
    ["react", "/src/plain-react/"],
  ]) {
    browser("--idle-timeout", "1m", "open", base + suffix);
    browser("set", "viewport", 1000, 700);
    // Reload after viewport changes so opening geometry is identical.
    browser("--idle-timeout", "1m", "open", base + suffix);
    capture(implementation, "desktop");
    browser("press", "Control+a");
    capture(implementation, "selection");
    browser("press", "Escape");
    browser("click", ref("option", "Document , file"));
    browser("press", "F2");
    browser("type", ref("textbox", "Rename Document"), "Report.txt");
    capture(implementation, "rename");
    browser("press", "Escape");
    browser("mouse", "move", 84, 140);
    browser("mouse", "down", "right");
    browser("mouse", "up", "right");
    capture(implementation, "menu");
    browser("press", "Escape");
    browser("dblclick", ref("option", "Photos , folder"));
    capture(implementation, "list");
    browser("click", ref("radio", "Grid view"));
    capture(implementation, "grid");
    browser("click", ref("radio", "Columns view"));
    capture(implementation, "columns");
    for (const name of ["Trips", "2026", "Turkey", "Istanbul", "Day 1"])
      browser("click", ref("option", `${name} , folder`));
    browser("click", ref("option", "Galata.jpg , file"));
    capture(implementation, "deep-columns");
    browser("click", ref("button", "Maximize Photos"));
    capture(implementation, "maximized");
    browser("click", ref("button", "Restore Photos"));
    capture(implementation, "restored");
    browser("set", "viewport", 640, 480);
    browser("--idle-timeout", "1m", "open", base + suffix);
    browser("dblclick", ref("option", "Photos , folder"));
    capture(implementation, "small-window");
  }
  const results = [];
  for (const key of states.keys()) {
    if (!key.startsWith("sdk-")) continue;
    const name = key.slice(4);
    const sdk = PNG.sync.read(
      readFileSync(path.join(output, `sdk-${name}.png`)),
    );
    const react = PNG.sync.read(
      readFileSync(path.join(output, `react-${name}.png`)),
    );
    assert.equal(sdk.width, react.width);
    assert.equal(sdk.height, react.height);
    let differentPixels = 0;
    for (let i = 0; i < sdk.data.length; i += 4) {
      if (!sdk.data.subarray(i, i + 4).equals(react.data.subarray(i, i + 4)))
        differentPixels++;
    }
    const sdkState = states.get(key),
      reactState = states.get(`react-${name}`);
    const geometryAndStateMatch =
      JSON.stringify(sdkState) === JSON.stringify(reactState);
    results.push({
      name,
      differentPixels,
      totalPixels: sdk.width * sdk.height,
      geometryAndStateMatch,
    });
  }
  writeFileSync(
    path.join(output, "comparison.json"),
    JSON.stringify({ results, states: Object.fromEntries(states) }, null, 2) +
      "\n",
  );
  console.table(results);
  if (
    results.some((result) => result.differentPixels || !result.geometryAndStateMatch)
  ) {
    console.error("See tests/__screenshots__/parity/comparison.json for remaining differences");
    process.exitCode = 1;
  }
} finally {
  browser("close");
}
