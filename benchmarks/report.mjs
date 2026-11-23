import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function generate() {
	const dir = fileURLToPath(new URL("./compiler-results/", import.meta.url));
	const variants = [
		{ name: "UI SDK", app: "sdk", folder: "control", color: "#995134" },
		{ name: "Plain React", app: "react", folder: "control", color: "#326995" },
		{ name: "React Compiler", app: "react", folder: ".", color: "#087258" },
	];
	const steps = {
		"desktop-selection": "Select all desktop items and clear selection",
		lasso: "Marquee selection",
		"item-drag": "Drag the selected file",
		menu: "Open and close the context menu",
		"open-folder": "Open Photos",
		"folder-selection": "Select all folder items and clear selection",
		rename: "Rename a file with the keyboard",
		grid: "Switch to grid view",
		columns: "Switch to column view",
		"deep-columns": "Open five nested folders and select the final file",
		"maximize-restore": "Maximize and restore the window",
		close: "Close the window",
	};
	const datasets = variants.map(({ app, folder }) => {
		const data = {};
		for (const kind of ["time", "detail", "regular", "trace"]) {
			const file = JSON.parse(
				readFileSync(join(dir, folder, kind + ".json"), "utf8"),
			);
			assert.equal(
				file.environment.compiler,
				folder === "control" ? "off" : "1.0.0",
			);
			data[kind] = file.results.filter((row) => row.app === app);
		}
		return data;
	});
	const sum = (nums) => nums.reduce((a, b) => a + b, 0);
	const median = (nums) => {
		assert.equal(nums.length, 5);
		assert.ok(nums.every(Number.isFinite));
		return [...nums].sort((a, b) => a - b)[2];
	};
	const number = (n, d) =>
		n.toLocaleString("en-US", {
			minimumFractionDigits: d,
			maximumFractionDigits: d,
		});
	const escape = (s) =>
		String(s)
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;");
	function table(title, label, rows, rank = false) {
		const headers = [
			label,
			...variants.map((v) => v.name),
			...(rank ? ["Fastest"] : []),
		];
		return `<div class="scroll"><table><caption>${escape(title)}</caption><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows
			.map(([name, values, d]) => {
				const rounded = values.map((n) =>
					n === null ? null : Number(n.toFixed(d)),
				);
				const best = Math.min(...rounded.filter((n) => n !== null));
				const winners = variants
					.filter((_, i) => rounded[i] === best)
					.map((v) => v.name);
				const winner =
					winners.length === 1 ? winners[0] : "Tie: " + winners.join(" / ");
				return `<tr><th scope="row">${escape(name)}</th>${values.map((n) => `<td>${n === null ? "—" : number(n, d)}</td>`).join("")}${rank ? `<td class="winner">${winner}</td>` : ""}</tr>`;
			})
			.join("\n")}</tbody></table></div>`;
	}
	function view(size) {
		const groups = datasets.map((data) =>
			Array.from({ length: 5 }, (_, i) =>
				Object.fromEntries(
					Object.entries(data).map(([kind, rows]) => {
						const matches = rows.filter(
							(r) => r.size === size && r.round === i + 1,
						);
						assert.equal(matches.length, 1);
						return [kind, matches[0]];
					}),
				),
			),
		);
		const values = (fn) => groups.map((rs) => median(rs.map(fn)));
		const metric = (label, fn, d = 0) => [label, values(fn), d];
		const updates = (r) => r.time.commits.filter((c) => c.step !== "mount");
		const duration = (r) => sum(updates(r).map((c) => c.actual));
		const medians = values(duration);
		const scale = size === 100 ? 40 : 12;
		assert.ok(Math.max(...medians) <= scale);
		const bars = variants
			.map(
				(v, i) =>
					`<div class="bar"><span>${v.name}</span><span class="rail"><i style="width:${(100 * medians[i]) / scale}%;background:${v.color}"></i></span><b>${number(medians[i], 2)} ms</b></div>`,
			)
			.join("");
		const rounds = Array.from({ length: 5 }, (_, i) => [
			"Round " + (i + 1),
			groups.map((rs) => duration(rs[i])),
			2,
		]);
		const phases = Object.entries(steps).map(([step, label]) =>
			metric(
				label,
				(r) =>
					sum(
						updates(r)
							.filter((c) => c.step === step)
							.map((c) => c.actual),
					),
				3,
			),
		);
		const profile = (label, fn, d = 0) =>
			metric(label, (r) => fn(r.detail.profile), d);
		const metrics = [
			metric("Total React render time · ms", duration, 2),
			metric("Update commits", (r) => updates(r).length),
			profile("Component function calls", (p) =>
				sum(Object.values(p.components).map((c) => c.calls)),
			),
			metric("Input event processing · ms", (r) => r.trace.inputMs, 2),
			metric("Style, layout and paint · ms", (r) => r.trace.renderingMs, 2),
			metric("Desktop JS heap · MiB", (r) => r.regular.desktop / 1048576, 2),
			metric("Open-folder JS heap · MiB", (r) => r.regular.folder / 1048576, 2),
			metric("Heap after closing · MiB", (r) => r.regular.closed / 1048576, 2),
			metric(
				"Double-click to first paint opportunity · ms",
				(r) => r.regular.openFrameMs,
				2,
			),
		];
		const memo = [
			profile("useMemo calls", (p) => p.memo.calls),
			profile("useMemo hits", (p) => p.memo.calls - p.memo.factories),
			profile("useMemo computations", (p) => p.memo.factories),
			profile("useMemo total · ms", (p) => p.memo.ms, 3),
			profile("Factory time · ms", (p) => p.memo.factoryMs, 3),
			profile("useCallback calls", (p) => p.callback.calls),
			profile("useCallback hits", (p) => p.callback.hits),
			profile("useCallback total · ms", (p) => p.callback.ms, 3),
			profile("React.memo comparisons", (p) => p.comparator.calls),
			profile("Comparison time · ms", (p) => p.comparator.ms, 3),
			profile("Compiler cache accesses", (p) => p.autoCache.calls),
			profile("Cache access time · ms", (p) => p.autoCache.accessMs, 3),
			profile("Compiler block checks", (p) => p.autoCache.guards),
			profile("Block check time · ms", (p) => p.autoCache.guardMs, 3),
			profile("Cache hits", (p) => p.autoCache.guards - p.autoCache.misses),
			profile("Recomputations", (p) => p.autoCache.misses),
		];
		const names = [
			...new Set(
				groups.flat(1).flatMap((r) => Object.keys(r.detail.profile.components)),
			),
		].sort();
		const componentRows = (field) =>
			names.map((name) => [
				name,
				groups.map((rs) =>
					rs.some((r) => r.detail.profile.components[name])
						? median(
								rs.map((r) => r.detail.profile.components[name]?.[field] ?? 0),
							)
						: null,
				),
				field === "calls" ? 0 : 3,
			]);
		return `<section class="sample" id="items-${size}"><h2>${size}-item folder</h2><div class="hero"><h3>Median render time</h3><p>All 12 interactions · five rounds · lower is faster</p>${bars}<small>Bar scale: 0–${scale} ms</small></div>
${table("Five individual rounds", "Render time · ms", rounds, true)}
${table("Render time by interaction", "Five-round median · ms", phases, true)}
${table("Rendering, input and memory", "Measurement", metrics)}
<details><summary>Memoization costs and cache hits</summary>${table("Memoization", "Measurement", memo)}</details>
<details><summary>Component calls and render time</summary><p>A dash means the component was absent from that implementation’s records.</p>${table("Function body calls", "Component", componentRows("calls"))}${table("Function body time (ms)", "Component", componentRows("selfMs"))}</details></section>`;
	}
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Same desktop, three implementations</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f6f5ef;color:#18362f;font:16px/1.55 system-ui,sans-serif}main{max-width:1060px;margin:auto;padding:clamp(16px,4vw,52px)}header{border-bottom:1px solid #cbd3c9;padding-bottom:20px}header small{font:600 .8rem monospace;letter-spacing:.1em;color:#175d4c}h1,h2{font-family:Georgia,serif;line-height:1.07;letter-spacing:-.035em}h1{font-size:clamp(2.6rem,6vw,5rem);margin:.25em 0}h2{font-size:2.3rem;margin:24px 0 12px}p{max-width:80ch}fieldset{border:0;padding:0;margin:22px 0}legend{font-weight:650}label{display:inline-block;padding:.45em .8em .45em 0;cursor:pointer}input{accent-color:#08664d}.hero{background:#15382e;color:#effbf2;padding:clamp(16px,3vw,32px);border-radius:12px}.hero h3,.hero p{margin:0 0 8px}.hero small{color:#c2d4c6}.bar{display:grid;grid-template-columns:8em 1fr 6em;gap:10px;align-items:center;margin:10px 0;font-variant-numeric:tabular-nums}.bar b{text-align:right}.rail{background:#49645b;height:12px;display:block}.rail i{display:block;height:100%;filter:brightness(1.65)}.scroll{overflow-x:auto;margin:24px 0}table{border-collapse:collapse;width:100%;background:#fcfcf8;font-size:.9rem;font-variant-numeric:tabular-nums}caption{text-align:left;font-size:1.18rem;font-weight:700;padding:0 0 8px}td,th{padding:8px;border-bottom:1px solid #d5dcd2;text-align:right}th:first-child{text-align:left}tbody th{font-weight:500}.winner{color:#06644b;font-weight:650}summary{cursor:pointer;font-weight:650;padding:.6em 0}details{border-top:1px solid #cbd3c9}body:has(#size4:checked) #items-100,body:has(#size100:checked) #items-4{display:none}@media(max-width:540px){.bar{font-size:.8rem;grid-template-columns:7.2em 1fr 5em}td,th{padding:5px}table{font-size:.8rem}}</style></head><body><main>
<header><small>DESKTOP PERFORMANCE BENCHMARK</small><h1>Same desktop, three implementations</h1><p><b>UI SDK</b> uses the SDK with the compiler off. <b>Plain React</b> uses the independent React implementation with the compiler off. <b>React Compiler</b> uses that same independent implementation with compilation enabled.</p></header>
<fieldset><legend>Photos folder size</legend><label><input id="size4" name="size" type="radio"> 4 items</label><label><input id="size100" name="size" type="radio" checked> 100 items</label></fieldset>
${view(4)}${view(100)}
<h2>Method</h2><p>The three series come from the same paired measurement session. The compiler-off controls and the compiled React build ran the same 12 interactions in Chromium 158 at 1000 × 700. Warm-ups were excluded. Each sequence included 26 behavior checks.</p><p>Render time sums the root Profiler’s actualDuration after the initial mount. Each interaction has its own five-round median. The full-sequence median uses each round’s total. Winners use the precision shown in the table. Small differences can vary between runs.</p><p>Input processing and rendering come from production Chrome traces and can overlap. Heap was measured after garbage collection. The first paint opportunity follows the folder double-click. Memoization and component counters ran in a separate diagnostic build, where clock reads affect short timings.</p></main></body></html>`;
	writeFileSync(join(dir, "report.html"), html);
}

generate();
