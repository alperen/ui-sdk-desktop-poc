import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

// Nested input dispatch and rendering events can cover some of the same time.
function covered(intervals) {
  let total = 0,
    end = -Infinity;
  for (const [from, to] of intervals.sort((a, b) => a[0] - b[0])) {
    total += Math.max(0, to - Math.max(from, end));
    end = Math.max(end, to);
  }
  return total;
}
assert.equal(
  covered([
    [1, 2],
    [0, 8],
    [6, 10],
    [12, 13],
  ]),
  11,
);

const inputs = new Set([
  "pointerdown",
  "pointerup",
  "pointermove",
  "mousedown",
  "mouseup",
  "mousemove",
  "click",
  "dblclick",
  "contextmenu",
  "keydown",
  "keypress",
  "keyup",
  "input",
  "beforeinput",
]);
const rendering = new Set(["UpdateLayoutTree", "Layout", "PrePaint", "Paint"]);
const mainThreadTasks = new Set([
  ...rendering, "FunctionCall", "RunTask", "HitTest", "Layerize", "ScrollLayer",
  "FireAnimationFrame", "TimerFire", "FireIdleCallback", "MinorGC", "MajorGC",
]);
const phases = [
  "start", "desktop-selection", "lasso", "item-drag", "menu", "open-folder",
  "folder-selection", "rename", "grid", "columns", "deep-columns",
  "maximize-restore", "close", "end",
];

// Export relative timings and known event types. Raw trace arguments can contain paths, URLs and input.
function writeExample(file, marks, work) {
  const origin = marks[0].ts;
  const end = marks.at(-1).ts;
  const thread = { pid: 1, tid: 1 };
  const traceEvents = [
    { ...thread, ts: 0, ph: "M", cat: "__metadata", name: "process_name", args: { name: "Renderer" } },
    { ...thread, ts: 0, ph: "M", cat: "__metadata", name: "thread_name", args: { name: "CrRendererMain" } },
    ...marks.map(mark => ({
      ...thread, ts: mark.ts - origin, ph: "I", s: "t", cat: "blink.user_timing",
      name: mark.name, args: {},
    })),
  ];

  for (const event of work) {
    const type = event.args?.data?.type;
    const isInput = event.name === "EventDispatch" && inputs.has(type);
    if (!isInput && !mainThreadTasks.has(event.name)) continue;

    const from = Math.max(origin, event.ts);
    const to = Math.min(end, event.ts + event.dur);
    if (to <= from) continue;

    traceEvents.push({
      ...thread, ts: from - origin, dur: to - from, ph: "X", cat: "devtools.timeline",
      name: event.name, args: isInput ? { data: { type } } : {},
    });
  }

  traceEvents.sort((a, b) => a.ts - b.ts);
  writeFileSync(file, gzipSync(JSON.stringify({ traceEvents })));
}

export function summarizeTrace(file, example) {
  const bytes = readFileSync(file);
  const trace = JSON.parse(file.endsWith(".gz") ? gunzipSync(bytes) : bytes);
  const events = trace.traceEvents ?? trace;
  const marks = events
    .filter(
      (e) =>
        e.cat?.includes("blink.user_timing") &&
        e.name.startsWith("desktop-bench/"),
    )
    .sort((a, b) => a.ts - b.ts);
  assert.deepEqual(marks.map(mark => mark.name), phases.map(name => "desktop-bench/" + name));
  const { pid, tid } = marks[0];
  const work = events.filter(
    (e) => e.pid === pid && e.tid === tid && e.ph === "X" && e.dur > 0,
  );

  function summarize(from, to) {
    const input = [],
      paint = [],
      types = {};
    for (const event of work) {
      if (event.ts >= to || event.ts + event.dur <= from) continue;
      const range = [
        Math.max(from, event.ts),
        Math.min(to, event.ts + event.dur),
      ];
      const type = event.args?.data?.type;
      if (event.name === "EventDispatch" && inputs.has(type)) {
        input.push(range);
        types[type] = (types[type] ?? 0) + 1;
      } else if (rendering.has(event.name)) {
        paint.push(range);
      }
    }
    return {
      inputMs: covered(input) / 1000,
      renderingMs: covered(paint) / 1000,
      eventTypes: types,
    };
  }

  const all = summarize(marks[0].ts, marks.at(-1).ts);
  assert.ok(
    all.inputMs > 0 &&
      all.renderingMs > 0 &&
      all.eventTypes.dblclick &&
      all.eventTypes.keydown,
    "Expected main renderer thread input, layout and paint events",
  );
  const steps = marks.slice(1, -1).map((mark, i) => ({
    name: mark.name.split("/")[1],
    ...summarize(mark.ts, marks[i + 2].ts),
  }));
  assert.equal(steps.length, 12);
  if (example) writeExample(example, marks, work);
  return { ...all, steps };
}
