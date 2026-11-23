import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeTrace } from "./trace.mjs";

const require = createRequire(import.meta.url);
const paired = process.argv.includes("--paired");
const [output, mode = "all"] = process.argv
  .slice(2)
  .filter((arg) => arg !== "--paired");
const compilerVersion =
  require("babel-plugin-react-compiler/package.json").version;
const destination = path.resolve(
  output ??
    fileURLToPath(
      new URL(paired ? "./compiler-results" : "./results", import.meta.url),
    ),
);
const baseSession = execFileSync(
  "agent-browser",
  ["session", "id", "--scope", "worktree", "--prefix", "desktop-validation"],
  { encoding: "utf8" },
).trim();
const kinds = mode === "all" ? ["time", "detail", "regular", "trace"] : [mode];
const ports = { time: 4185, detail: 4186, regular: 4187, trace: 4187 };
const traceDirectory = kinds.includes("trace")
  ? mkdtempSync(path.join(os.tmpdir(), "desktop-traces-"))
  : "";
const rounds = 5;
assert.ok(kinds.every((kind) => kind in ports));
mkdirSync(destination, { recursive: true });
if (paired) mkdirSync(path.join(destination, "control"), { recursive: true });

let session;
function browser(...args) {
  return execFileSync(
    "agent-browser",
    ["--session", session, ...args.map(String)],
    { encoding: "utf8", timeout: 45000, maxBuffer: 12 * 1024 * 1024 },
  ).trim();
}
function read(js) {
  const result = JSON.parse(
    browser("eval", "-b", Buffer.from(js).toString("base64"), "--json"),
  );
  assert.ok(result.success, JSON.stringify(result.error));
  return result.data.result;
}
function save(dir, name, data) {
  writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + "\n");
}
function waitFor(condition) {
  browser("wait", "--fn", condition);
}
function frames() {
  read(
    "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
  );
}
function open(url, kind) {
  const flags =
    kind === "detail"
      ? ["--enable", "react-devtools"]
      : kind === "regular"
        ? [
            "--args",
            "--js-flags=--expose-gc,--enable-precise-memory-info,--disable-features=BackForwardCache",
          ]
        : [];
  browser("--idle-timeout", "1m", "open", ...flags, url);
}
function close() {
  browser("close");
}
function actOn(role, action, name) {
  browser("find", "role", role, action, "--name", name, "--exact");
}
function folderOpen() {
  const { refs } = JSON.parse(browser("snapshot", "-i", "--json")).data;
  const photos = Object.entries(refs).find(
    ([, el]) => el.role === "option" && el.name === "Photos , folder",
  );
  assert.ok(photos, "Photos folder must be visible");
  browser("dblclick", "@" + photos[0]);
}

const folderBox = '[role="listbox"][aria-label="Photos contents"]';
const count = (selector) =>
  `document.querySelectorAll(${JSON.stringify(selector)}).length`;
const options = count(folderBox + ' [role="option"]');
const selected = count(folderBox + ' [aria-selected="true"]');
const checked = (label) =>
  `document.querySelector('[aria-label="${label} view"]')?.getAttribute('aria-checked') === 'true'`;
const visibleWindow = '[data-slot="window"][aria-label="Photos"]';
const details =
  "({ components:desktopProfile.components, memo:desktopProfile.memo, callback:desktopProfile.callback, comparator:desktopProfile.comparator, autoCache:desktopProfile.autoCache })";

function totals(current, previous = {}) {
  const delta = (a, b) =>
    Object.fromEntries(
      Object.entries(a).map(([k, v]) => [k, v - (b?.[k] ?? 0)]),
    );
  const components = {};
  for (const [name, row] of Object.entries(current.components)) {
    const change = delta(row, previous.components?.[name]);
    if (change.calls) components[name] = change;
  }
  return {
    components,
    memo: delta(current.memo, previous.memo),
    callback: delta(current.callback, previous.callback),
    comparator: delta(current.comparator, previous.comparator),
    autoCache: delta(current.autoCache, previous.autoCache),
  };
}

function exercise(kind, app, size, round, compiled, dir) {
  const states = [];
  const diagnostic = kind === "detail";
  const tracing = kind === "trace";
  const desktop = '[role="listbox"][aria-label="Files"]';
  const desktopSelected = count(desktop + ' [aria-selected="true"]');
  const initial = diagnostic ? read(details) : undefined;
  let previous = initial;
  const steps = [];
  if (diagnostic) browser("react", "renders", "start");
  if (tracing) {
    browser(
      "profiler",
      "start",
      "--categories",
      "devtools.timeline,blink.user_timing",
    );
    read('performance.mark("desktop-bench/start"); true');
  }

  function check(condition) {
    waitFor(condition);
    states.push(condition);
  }
  function step(name, action) {
    if (tracing)
      read(
        `performance.mark(${JSON.stringify("desktop-bench/" + name)}); true`,
      );
    else read(`desktopProfile.step = ${JSON.stringify(name)}`);
    action();
    frames();
    if (diagnostic) {
      const current = read(details);
      steps.push({ name, ...totals(current, previous) });
      previous = current;
    }
  }

  step("desktop-selection", () => {
    browser("press", "Control+a");
    check(desktopSelected + " === 3");
    browser("press", "Escape");
    check(desktopSelected + " === 0");
  });
  step("lasso", () => {
    browser("mouse", "move", 10, 78);
    browser("mouse", "down");
    browser("mouse", "move", 175, 200);
    browser("mouse", "up");
    check(desktopSelected + " === 1");
  });
  step("item-drag", () => {
    browser("mouse", "move", 84, 140);
    browser("mouse", "down");
    browser("mouse", "move", 100, 155);
    browser("mouse", "move", 114, 165);
    browser("mouse", "up");
    check(
      `document.querySelector('${desktop} [role=option]').getBoundingClientRect().left === 50`,
    );
  });
  step("menu", () => {
    browser("mouse", "move", 114, 165);
    browser("mouse", "down", "right");
    browser("mouse", "up", "right");
    check(
      "!!document.querySelector('[role=\"menuitem\"]')?.getClientRects().length",
    );
    browser("press", "Escape");
    check(
      "!document.querySelector('[role=\"menu\"]')?.getClientRects().length",
    );
  });
  step("open-folder", () => {
    folderOpen();
    check(options + " === " + size);
    check(checked("List"));
  });
  step("folder-selection", () => {
    browser("press", "Control+a");
    check(selected + " === " + size);
    browser("press", "Escape");
    check(selected + " === 0");
  });
  step("rename", () => {
    actOn("option", "click", "Beach.jpg , file");
    browser("press", "F2");
    check(
      'document.activeElement?.getAttribute("aria-label") === "Rename Beach.jpg"',
    );
    browser("keyboard", "type", "Coast.jpg");
    check('document.activeElement?.value === "Coast.jpg"');
    browser("press", "Enter");
    check(
      `document.querySelector('${folderBox} [role=option]').textContent.includes('Coast.jpg')`,
    );
  });
  step("grid", () => {
    actOn("radio", "click", "Grid view");
    check(checked("Grid"));
    check(options + " === " + size);
  });
  step("columns", () => {
    actOn("radio", "click", "Columns view");
    check(checked("Columns"));
    check(options + " === " + size);
  });
  step("deep-columns", () => {
    for (const name of ["Trips", "2026", "Turkey", "Istanbul", "Day 1"]) {
      actOn("option", "click", name + " , folder");
      check(
        count(`[role="listbox"][aria-label="${name} contents"]`) + " === 1",
      );
    }
    actOn("option", "click", "Galata.jpg , file");
    check(
      `document.querySelector('[aria-label="Day 1 contents"] [aria-selected=true]')?.textContent.includes('Galata.jpg')`,
    );
  });
  step("maximize-restore", () => {
    const width = read(
      `document.querySelector('${visibleWindow}').getBoundingClientRect().width`,
    );
    actOn("button", "click", "Maximize Photos");
    check(
      `document.querySelector('${visibleWindow}').hasAttribute("data-maximized")`,
    );
    actOn("button", "click", "Restore Photos");
    check(
      `document.querySelector('${visibleWindow}').getBoundingClientRect().width === ${width}`,
    );
  });
  step("close", () => {
    actOn("button", "click", "Close Photos");
    check(count(visibleWindow) + " === 0");
  });

  if (tracing) {
    read('performance.mark("desktop-bench/end"); true');
    const file = path.join(traceDirectory, `${round}-${size}-${app}.json`);
    try {
      browser("profiler", "stop", file);
      const example =
        round === 3 && size === 100
          ? path.join(dir, app + ".trace.json.gz")
          : undefined;
      return { checks: states.length, ...summarizeTrace(file, example) };
    } finally {
      rmSync(file, { force: true });
    }
  }
  const commits = read("desktopProfile.commits");
  assert.ok(
    commits.some(
      (row) => row.step === "mount" && row.phase === "mount" && row.actual > 0,
    ),
  );
  for (const name of [
    "open-folder",
    "rename",
    "columns",
    "deep-columns",
    "close",
  ])
    assert.ok(
      commits.some((row) => row.step === name && row.actual > 0),
      `missing render for ${name}`,
    );
  if (!diagnostic) return { checks: states.length, commits };

  const { data } = JSON.parse(browser("react", "renders", "stop", "--json"));
  const native =
    /([\d,]+) renders \(([\d,]+) mounts \+ ([\d,]+) re-renders\) across ([\d,]+) components/.exec(
      data.report,
    );
  assert.ok(native, data.report);
  const profile = totals(previous, initial);
  assert.ok(profile.components["App.Item"]?.calls > 0);
  if (compiled) {
    assert.ok(
      profile.autoCache.calls > 0 &&
        profile.autoCache.guards > profile.autoCache.misses &&
        profile.autoCache.misses > 0,
    );
  } else {
    assert.equal(profile.autoCache.calls, 0);
    assert.ok(profile.callback.calls > 0);
  }
  if (app === "sdk")
    assert.ok(
      profile.memo.calls > profile.memo.factories && profile.memo.factories > 0,
    );
  const sum = (key) =>
    Object.values(profile.components).reduce(
      (total, row) => total + row[key],
      0,
    );
  assert.equal(sum("memoCalls"), profile.memo.calls);
  assert.equal(sum("memoFactories"), profile.memo.factories);
  assert.equal(sum("callbackCalls"), profile.callback.calls);
  assert.equal(sum("cacheCalls"), profile.autoCache.calls);
  assert.equal(sum("cacheGuards"), profile.autoCache.guards);
  assert.equal(sum("cacheMisses"), profile.autoCache.misses);

  const clock = read(`(() => {
    let bracketMs = 0, tickMs = Infinity;
    const samples = 50000;
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      const elapsed = performance.now() - start;
      bracketMs += elapsed;
      if (elapsed > 0) tickMs = Math.min(tickMs, elapsed);
    }
    return {samples, bracketMs, tickMs};
  })()`);

  return {
    checks: states.length,
    mount: initial,
    profile,
    steps,
    clock,
    agent: native.slice(1).map((n) => Number(n.replaceAll(",", ""))),
  };
}

function production(size) {
  const heap = () =>
    read(`(async () => {
    window.gc();
    await new Promise(resolve => setTimeout(resolve, 0));
    window.gc();
    return performance.memory.usedJSHeapSize;
  })()`);
  const desktop = heap();
  read(`document.addEventListener("dblclick", event => {
    const start = event.timeStamp;
    const check = () => {
      if (!(document.querySelector('${folderBox}')?.getClientRects().length && ${options} === ${size}))
        return requestAnimationFrame(check);
      setTimeout(() => { window.folderFrameMs = performance.now() - start; }, 0);
    };
    requestAnimationFrame(check);
  }, { once: true, capture: true }); true`);
  folderOpen();
  waitFor(`window.folderFrameMs > 0 && ${options} === ${size}`);
  frames();
  const folder = heap();
  const openFrameMs = read("window.folderFrameMs");

  actOn("button", "click", "Close Photos");
  waitFor(count(visibleWindow) + " === 0");
  frames();
  const closed = heap();
  assert.ok(desktop > 0 && folder > 0 && closed > 0);
  return { desktop, folder, closed, openFrameMs };
}

const environment = {
  react: require("react/package.json").version,
  sdk: require("@ui-sdk/react/package.json").version,
  agentBrowser: execFileSync("agent-browser", ["--version"], {
    encoding: "utf8",
  }).trim(),
  viewport: [1000, 700],
};

for (const kind of kinds) {
  session = baseSession + (paired ? "-paired-" : "-benchmark-") + kind;
  assert.ok(kind in ports);
  const samples = { on: [], off: [] };
  if (paired && kind === "detail") {
    const response = await fetch(
      `http://127.0.0.1:${ports[kind] + 3}/desktop-compiler.json`,
    );
    assert.ok(response.ok);
    const audit = await response.json();
    assert.equal(audit.version, compilerVersion);
    save(destination, "compilation.json", audit);
  }
  let live = false;
  try {
    // Round zero exercises every path for both builds before collecting samples.
    for (let round = 0; round <= rounds; round++) {
      const sizes = round % 2 ? [4, 100] : [100, 4];
      const order = round % 2 ? ["sdk", "react"] : ["react", "sdk"];
      const variants = paired
        ? round % 2
          ? [false, true]
          : [true, false]
        : [false];
      for (const size of sizes) {
        for (const app of order) {
          for (const compiled of variants) {
            const port = ports[kind] + (compiled ? 3 : 0);
            const dir =
              paired && !compiled
                ? path.join(destination, "control")
                : destination;
            if (!live) {
              open("about:blank", kind);
              live = true;
              browser("set", "viewport", 1000, 700);
            }
            open(
              "http://127.0.0.1:" +
                port +
                (app === "sdk" ? "/src/ui-sdk/" : "/src/plain-react/") +
                "?size=" +
                size,
              kind,
            );
            waitFor(
              count('[role="listbox"][aria-label="Files"] [role="option"]') +
                " === 3",
            );
            frames();
            assert.ok(
              read(
                "crossOriginIsolated && innerWidth === 1000 && innerHeight === 700",
              ),
            );
            environment.browser = "Chromium " + read(
              String.raw`navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/)[1]`,
            );
            const compiler = read(
              "document.querySelector('meta[name=\"desktop-react-compiler\"]')?.content",
            );
            assert.equal(
              compiler,
              compiled ? compilerVersion : "off",
              "Wrong compiler build",
            );
            const metrics =
              kind === "regular"
                ? production(size)
                : exercise(kind, app, size, round, compiled, dir);
            if (round) {
              const results = samples[compiled ? "on" : "off"];
              results.push({ round, size, app, ...metrics });
              save(dir, kind + ".json", {
                environment: { ...environment, compiler },
                results,
              });
            }
            const summary =
              kind === "time"
                ? metrics.commits
                    .filter((c) => c.step !== "mount")
                    .reduce((n, c) => n + c.actual, 0)
                    .toFixed(2) + " ms"
                : kind === "detail"
                  ? metrics.agent[0] + " recorded renders"
                  : kind === "trace"
                    ? metrics.inputMs.toFixed(2) + " ms input dispatch"
                    : (metrics.folder / 1048576).toFixed(2) + " MiB";
            console.log(
              `${kind} ${round || "warm-up"} ${size} ${app} ${compiler}: ${summary}`,
            );
            if (kind === "regular") {
              close();
              live = false;
            }
          }
        }
      }
    }
  } finally {
    if (live) close();
  }
}
