import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(
	process.argv[2] ?? fileURLToPath(new URL("./results", import.meta.url)),
);
const sizes = [4, 100],
	apps = ["sdk", "react"];
const labels = { sdk: "UI SDK", react: "React only" };
const auditPath = path.join(dir, "compilation.json");
const audit = existsSync(auditPath)
	? JSON.parse(readFileSync(auditPath, "utf8"))
	: null;

function readRuns(folder, compiler) {
	const runs = new Map();
	for (const kind of ["time", "detail", "trace", "regular"]) {
		const { environment, results } = JSON.parse(
			readFileSync(path.join(folder, kind + ".json"), "utf8"),
		);
		assert.equal(results.length, 20);
		if (compiler) assert.equal(environment.compiler, compiler);
		for (const row of results) {
			const key = [row.size, row.app, row.round].join("-");
			const run = runs.get(key) ?? {};
			assert.ok(!run[kind], "Duplicate sample " + key);
			run[kind] = row;
			runs.set(key, run);
		}
	}
	return runs;
}
const runs = readRuns(dir, audit?.version);

function group(size, app, samples = runs) {
	return Array.from({ length: 5 }, (_, i) => {
		const row = samples.get([size, app, i + 1].join("-"));
		assert.ok(row?.time && row.detail && row.regular && row.trace);
		assert.equal(row.time.checks, row.detail.checks);
		assert.equal(row.time.checks, row.trace.checks);
		assert.equal(row.trace.steps.length, row.detail.steps.length);
		assert.deepEqual(
			row.trace.steps.map((s) => s.name),
			row.detail.steps.map((s) => s.name),
		);
		return row;
	});
}
const median = (rows, value) => rows.map(value).sort((a, b) => a - b)[2];
const sum = (rows, value) => rows.reduce((total, row) => total + value(row), 0);
const ms = (v, digits = 2) =>
	v.toLocaleString("en-US", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
const integer = (v) => v.toLocaleString("en-US");
const updates = (row) => row.time.commits.filter((c) => c.step !== "mount");
const render = (row) => sum(updates(row), (c) => c.actual);
const groups = sizes.flatMap((size) =>
	apps.map((app) => ({ size, app, rows: group(size, app) })),
);
const title = audit
	? `React Compiler ${audit.version} enabled measurements`
	: "Benchmark measurements";
const escape = (value) =>
	String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
const document = [
	`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.55 system-ui;max-width:76rem;margin:2rem auto;padding:0 1rem;color:#19342c}section{overflow-x:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:.45rem;text-align:right;border-bottom:1px solid #ccd5cf}th:first-child,td:first-child{text-align:left}a{color:#00654d}</style><h1>${escape(title)}</h1>`,
	"<p>Times are in milliseconds and memory is in MiB. The rounds table shows individual runs. Other tables show five-run medians. Interaction totals exclude the initial desktop mount.</p>",
];

function table(title, header, rows) {
	document.push(
		`<section><h2>${escape(title)}</h2><table><thead><tr>${header.map((c) => `<th scope="col">${escape(c)}</th>`).join("")}</tr></thead><tbody>`,
	);
	for (const row of rows)
		document.push(
			`<tr>${row.map((c) => `<td>${escape(c)}</td>`).join("")}</tr>`,
		);
	document.push("</tbody></table></section>");
}

if (audit) {
	const control = readRuns(path.join(dir, "control"), "off");
	table(
		"Compiler effect within the same session",
		[
			"Items",
			"Application",
			"Render (off)",
			"Render (on)",
			"Median time reduction",
			"Rounds faster with compiler on",
			"Input processing (off)",
			"Input processing (on)",
			"Heap (off) (MiB)",
			"Heap (on) (MiB)",
		],
		groups.map(({ size, app, rows }) => {
			const off = group(size, app, control);
			const before = median(off, render);
			const after = median(rows, render);
			const faster = rows.filter((r, i) => render(r) < render(off[i])).length;
			return [
				size,
				labels[app],
				ms(before),
				ms(after),
				ms((1 - after / before) * 100, 1) + "%",
				faster + "/5",
				ms(median(off, (r) => r.trace.inputMs)),
				ms(median(rows, (r) => r.trace.inputMs)),
				ms(median(off, (r) => r.regular.folder / 1048576)),
				ms(median(rows, (r) => r.regular.folder / 1048576)),
			];
		}),
	);
	document.push(
		"Percentages use the compiler-off median as the baseline. The win count compares paired rounds. <a href='control/summary.html'>All compiler-off control rounds</a>",
		"",
	);
}

table(
	"Paired rounds",
	[
		"Round",
		"Items",
		"First to run",
		"SDK render",
		"React render",
		"Faster render",
		"SDK input processing",
		"React input processing",
	],
	sizes.flatMap((size) =>
		group(size, "sdk").map((sdk, i) => {
			const react = group(size, "react")[i];
			return [
				i + 1,
				size,
				i % 2 ? labels.react : labels.sdk,
				ms(render(sdk)),
				ms(render(react)),
				render(sdk) === render(react)
					? "Tie"
					: render(sdk) < render(react)
						? labels.sdk
						: labels.react,
				ms(sdk.trace.inputMs),
				ms(react.trace.inputMs),
			];
		}),
	),
);

table(
	"Full interaction sequence",
	[
		"Items",
		"Application",
		"Render",
		"React commit",
		"Function body calls",
		"agent-browser render records",
		"Recorded mounts / updates",
		"Input processing",
		"Style, layout and paint",
	],
	groups.map(({ size, app, rows }) => [
		size,
		labels[app],
		ms(median(rows, render)),
		median(rows, (r) => updates(r).length),
		integer(
			median(rows, (r) =>
				sum(Object.values(r.detail.profile.components), (c) => c.calls),
			),
		),
		integer(median(rows, (r) => r.detail.agent[0])),
		integer(median(rows, (r) => r.detail.agent[1])) +
			" / " +
			integer(median(rows, (r) => r.detail.agent[2])),
		ms(median(rows, (r) => r.trace.inputMs)),
		ms(median(rows, (r) => r.trace.renderingMs)),
	]),
);

const phases = {
	mount: "Initial desktop mount",
	"desktop-selection": "Select all desktop items and clear selection",
	lasso: "Marquee selection",
	"item-drag": "Drag the selected file",
	menu: "Open and close the context menu",
	"open-folder": "Open the Photos folder",
	"folder-selection": "Select all folder items and clear selection",
	rename: "Rename a file with the keyboard and save",
	grid: "Switch to grid view",
	columns: "Switch to column view",
	"deep-columns": "Open five nested folders and select the file",
	"maximize-restore": "Maximize and restore the window",
	close: "Close the window",
};
table(
	"React render time by interaction",
	["Step", "SDK · 4", "React · 4", "SDK · 100", "React · 100"],
	Object.entries(phases).map(([id, title]) => [
		title,
		...groups.map(({ rows }) =>
			ms(
				median(rows, (r) =>
					sum(
						r.time.commits.filter((c) => c.step === id),
						(c) => c.actual,
					),
				),
				3,
			),
		),
	]),
);

table(
	"Memoization",
	[
		"Items",
		"Application",
		"useMemo calls",
		"Hits",
		"Calculations",
		"useMemo ms",
		"Calculation time (ms)",
		"useCallback calls",
		"Hits",
		"useCallback ms",
		"React.memo comparisons",
		"Comparison time (ms)",
	],
	groups.map(({ size, app, rows }) => {
		const m = (fn) => median(rows, (r) => fn(r.detail.profile));
		return [
			size,
			labels[app],
			integer(m((p) => p.memo.calls)),
			integer(m((p) => p.memo.calls - p.memo.factories)),
			integer(m((p) => p.memo.factories)),
			ms(
				m((p) => p.memo.ms),
				3,
			),
			ms(
				m((p) => p.memo.factoryMs),
				3,
			),
			integer(m((p) => p.callback.calls)),
			integer(m((p) => p.callback.hits)),
			ms(
				m((p) => p.callback.ms),
				3,
			),
			integer(m((p) => p.comparator.calls)),
			ms(
				m((p) => p.comparator.ms),
				3,
			),
		];
	}),
);

if (audit) {
	table(
		"Compiler-generated cache",
		[
			"Items",
			"Application",
			"Cache accesses",
			"Access time (ms)",
			"Block checks",
			"Hits",
			"Recomputations",
			"Hit rate",
			"Guard time (ms)",
		],
		groups.map(({ size, app, rows }) => {
			const m = (f) => median(rows, (r) => f(r.detail.profile.autoCache));
			return [
				size,
				labels[app],
				integer(m((p) => p.calls)),
				ms(
					m((p) => p.accessMs),
					3,
				),
				integer(m((p) => p.guards)),
				integer(m((p) => p.guards - p.misses)),
				integer(m((p) => p.misses)),
				ms(
					m((p) => 100 * (1 - p.misses / p.guards)),
					1,
				) + "%",
				ms(
					m((p) => p.guardMs),
					3,
				),
			];
		}),
	);
}

table(
	"Component calls and body time with 100 items",
	["Component", "SDK calls", "SDK ms", "React calls", "React ms"],
	[
		"App.Item",
		"FileListItem",
		"FileListView",
		"FileIcon",
		"ItemIcon",
		"ItemLabel",
		"ItemInput",
		"App.Window",
		"ColumnView",
		"HandleScope",
		"ContextTriggerPart",
	].map((name) => [
		name,
		...apps.flatMap((app) => {
			const g = group(100, app),
				find = (r) => r.detail.profile.components[name];
			return g.some(find)
				? [
						integer(median(g, (r) => find(r)?.calls ?? 0)),
						ms(
							median(g, (r) => find(r)?.selfMs ?? 0),
							3,
						),
					]
				: ["—", "—"];
		}),
	]),
);

table(
	"Memory and folder opening in the production build",
	[
		"Items",
		"Application",
		"Desktop heap",
		"Open-folder heap",
		"Heap increase on open",
		"Heap after closing",
		"Double-click to first paint opportunity (ms)",
	],
	groups.map(({ size, app, rows }) => {
		const mib = (fn) => ms(median(rows, (r) => fn(r.regular) / 1048576));
		return [
			size,
			labels[app],
			mib((r) => r.desktop),
			mib((r) => r.folder),
			mib((r) => r.folder - r.desktop),
			mib((r) => r.closed),
			ms(median(rows, (r) => r.regular.openFrameMs)),
		];
	}),
);

document.push(
	`<p><a href="components.csv">Component data (CSV)</a> · <a href="${audit ? "./" : "../"}index.html">Methodology</a></p></html>`,
);
writeFileSync(path.join(dir, "summary.html"), document.join("\n"));

const fields = [
	"calls",
	"mounts",
	"selfMs",
	"memoCalls",
	"memoFactories",
	"memoMs",
	"callbackCalls",
	"callbackMs",
];
if (audit) fields.push("cacheCalls", "cacheGuards", "cacheMisses");
const csv = [
	["folder_items", "app", "component", "desktop_mount_calls", ...fields],
];
for (const { size, app, rows } of groups) {
	const names = new Set(
		rows.flatMap((r) => [
			...Object.keys(r.detail.profile.components),
			...Object.keys(r.detail.mount.components),
		]),
	);
	for (const name of [...names].sort()) {
		const mountCalls = median(
			rows,
			(r) => r.detail.mount.components[name]?.calls ?? 0,
		);
		csv.push([
			size,
			app,
			name,
			mountCalls,
			...fields.map((key) =>
				Number(
					median(
						rows,
						(r) => r.detail.profile.components[name]?.[key] ?? 0,
					).toFixed(4),
				),
			),
		]);
	}
}
writeFileSync(
	path.join(dir, "components.csv"),
	csv
		.map((row) =>
			row
				.map((value) =>
					typeof value === "string"
						? '"' + value.replaceAll('"', '""') + '"'
						: value,
				)
				.join(","),
		)
		.join("\n") + "\n",
);
