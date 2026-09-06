// adrian-inject-context client plugin — Settings section "Inject Context".
//
// Format: the installed-client `window.__ModuleLoader__.load` bundle (same
// shape as dsh-cost-meter's and @deepseek-ai/dsh-client-connection's client
// modules). The factory's `require` provides the browser's shared React and
// the official UI primitives package.
//
// Registers one Settings nav section via the standard settings.section slot —
// the same registry dshmarket ("Plugin Market", order 40) and dsh-cost-meter
// ("Cost", order 30) use — at order 50, i.e. directly under Plugin Market.
// Data flows exclusively through the EXISTING host routes
// GET /adrian-inject-context/data and POST /adrian-inject-context/save
// (store schema v2: { version, mode, simple, advanced } — the ACTIVE mode's
// dataset exclusively feeds the Remember: row).
//
// Two tabs — Simple and Advanced — each a complete editor bound to its OWN
// dataset (checkbox, textarea, #N, Delete, Add Context); the inactive tab's
// editor is unmounted. Save persists the whole v2 state; switching tabs
// persists the mode immediately. Styling mirrors the shell's own recipes
// (official _button_ family, official heading/muted typography, official tab
// accent) with --dsw-* tokens only; no hardcoded colors.
window.__ModuleLoader__.load({
	id: "dsh-adrian-inject-context",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const NS = "adrian-inject-context";
		const DATA_URL = "/" + NS + "/data";
		const SAVE_URL = "/" + NS + "/save";

		// The shell's own settings-gear glyph (what navIcon() renders for ids
		// without a dedicated icon); tolerate its absence without failing.
		let GearIcon = null;
		try {
			const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
			if (primitives !== null && typeof primitives === "object") GearIcon = primitives.IconSettingsOutline16 || null;
		} catch (error) {
			GearIcon = null;
		}

		const CSS = `
.aic-root { display: block; max-width: 720px; color: var(--dsw-alias-label-primary); }
.aic-head { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 16px; line-height: 24px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.aic-head svg { flex: none; }
.aic-tabs { display: flex; gap: 4px; margin: 0 0 14px; }
.aic-tab { border: none; background: transparent; cursor: pointer; font: inherit; font-size: 13px; line-height: 20px; height: 32px; padding: 0 12px; border-radius: 8px; color: var(--dsw-alias-label-secondary); }
.aic-tab:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
.aic-tab.active { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); font-weight: 600; }
.aic-sub { margin: 0 0 20px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.aic-row { display: grid; grid-template-columns: 1fr 64px; gap: 12px; align-items: stretch; padding: 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; margin-bottom: 10px; background: var(--dsw-alias-bg-layer-1); }
.aic-row.off { opacity: .55; }
.aic-main { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.aic-main input[type="checkbox"] { flex: none; width: 16px; height: 16px; margin: 11px 0 0; accent-color: var(--dsw-alias-button-primary-fill); cursor: pointer; }
.aic-main textarea { flex: 1; min-width: 0; min-height: 88px; resize: vertical; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l3); border-radius: 8px; padding: 8px 12px; font: inherit; font-size: 14px; line-height: 22px; }
.aic-main textarea:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.aic-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.aic-freq { display: flex; align-items: center; gap: 6px; margin: 6px 0 0 26px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.aic-freq input[type="checkbox"] { flex: none; width: 14px; height: 14px; margin: 0; accent-color: var(--dsw-alias-button-primary-fill); cursor: pointer; }
.aic-actions { display: grid; grid-template-rows: auto 1fr; justify-items: center; align-items: center; }
.aic-actions .aic-badge { align-self: start; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); font-family: var(--ds-font-family-code, ui-monospace, monospace); }
.aic-del { display: inline-flex; align-items: center; justify-content: center; align-self: center; min-width: 64px; height: 28px; padding: 0 10px; border-radius: 14px; cursor: pointer; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); background: transparent; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent); }
.aic-del:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.aic-del:disabled { cursor: not-allowed; opacity: .4; }
.aic-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: none; border-radius: 18px; cursor: pointer; font-size: 14px; line-height: 22px; height: 36px; padding: 0 14px; color: var(--dsw-alias-label-primary); background: transparent; }
.aic-btn:disabled { cursor: not-allowed; opacity: .4; }
.aic-btn.primary { background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.aic-btn.primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.aic-btn.outline { border: 1px solid var(--dsw-alias-border-l3); }
.aic-btn.outline:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.aic-btn.outline:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
.aic-bar { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
.aic-status { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-success-primary); opacity: 0; transition: opacity .25s ease; }
.aic-status.err { color: var(--dsw-alias-state-error-primary); }
.aic-status.show { opacity: 1; }
.aic-meta { margin-top: 14px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.aic-error { color: var(--dsw-alias-state-error-primary); font-size: 13px; line-height: 20px; }
`;

		let styleEl = null;
		function ensureStyles() {
			if (styleEl !== null || typeof document === "undefined") return;
			styleEl = document.createElement("style");
			styleEl.textContent = CSS;
			document.head.appendChild(styleEl);
		}
		function dropStyles() {
			if (styleEl !== null) {
				styleEl.remove();
				styleEl = null;
			}
		}

		function countEnabled(entries) {
			let enabled = 0;
			for (const entry of entries) {
				if (entry.enabled === true && typeof entry.text === "string" && entry.text.trim() !== "") enabled += 1;
			}
			return enabled;
		}

		function InjectContextSection() {
			const [store, setStore] = React.useState(null);
			const [tab, setTab] = React.useState("simple");
			const [loadError, setLoadError] = React.useState(null);
			const [status, setStatus] = React.useState(null);
			const [saving, setSaving] = React.useState(false);
			const statusTimer = React.useRef(null);

			React.useEffect(function () {
				ensureStyles();
				let alive = true;
				fetch(DATA_URL, { cache: "no-store" })
					.then(function (res) { return res.json(); })
					.then(function (value) {
						if (!alive) return;
						if (value !== null && typeof value === "object" && value.version === 2) {
							setStore(value);
							setTab(value.mode === "advanced" ? "advanced" : "simple");
						} else {
							setLoadError("unexpected store payload");
						}
					})
					.catch(function (error) {
						if (!alive) return;
						setLoadError(error && error.message ? error.message : String(error));
					});
				return function () {
					alive = false;
					if (statusTimer.current !== null) {
						clearTimeout(statusTimer.current);
						statusTimer.current = null;
					}
				};
			}, []);

			function flash(text, ok) {
				setStatus({ text: text, ok: ok === true });
				if (statusTimer.current !== null) clearTimeout(statusTimer.current);
				statusTimer.current = setTimeout(function () {
					statusTimer.current = null;
					setStatus(null);
				}, 2600);
			}

			function postStore(next) {
				return fetch(SAVE_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) })
					.then(function (res) {
						return res.json().then(function (value) { return { ok: res.ok, value: value }; });
					})
					.then(function (outcome) {
						if (!outcome.ok) throw new Error(outcome.value && outcome.value.error ? outcome.value.error : "save failed");
						return outcome.value;
					});
			}

			// Tab switch persists the mode immediately (carrying the current
			// editor state so nothing is lost even without a later Save).
			function switchTab(next) {
				if (store === null || next === tab) return;
				setTab(next);
				const nextStore = Object.assign({}, store, { mode: next });
				setStore(nextStore);
				postStore(nextStore)
					.then(function (saved) {
						setStore(saved);
						flash("mode: " + (saved.mode === "advanced" ? "Advanced" : "Simple") + " \u2713", true);
					})
					.catch(function (error) {
						flash("mode save failed: " + (error && error.message ? error.message : String(error)), false);
					});
			}

			function saveAll() {
				if (saving || store === null) return;
				setSaving(true);
				const next = Object.assign({}, store, { mode: tab });
				postStore(next)
					.then(function (saved) {
						setStore(saved);
						const lessons = saved[saved.mode] ? saved[saved.mode].lessons : [];
						flash("saved \u2713 (" + lessons.length + " context(s) in " + (saved.mode === "advanced" ? "Advanced" : "Simple") + ")", true);
					})
					.catch(function (error) {
						flash("save failed: " + (error && error.message ? error.message : String(error)), false);
					})
					.then(function () { setSaving(false); });
			}

			// ---- editor operations on the ACTIVE tab's dataset ----
			function lessonsOf() {
				const dataset = store !== null && store[tab] !== null && typeof store[tab] === "object" ? store[tab] : null;
				return dataset !== null && Array.isArray(dataset.lessons) ? dataset.lessons : [];
			}
			function replaceLessons(lessons) {
				setStore(Object.assign({}, store, { [tab]: { lessons: lessons } }));
			}
			function patchAt(index, patch) {
				replaceLessons(lessonsOf().map(function (entry, at) {
					return at === index ? Object.assign({}, entry, patch) : entry;
				}));
			}
			function removeAt(index) {
				replaceLessons(lessonsOf().filter(function (entry, at) { return at !== index; }));
			}
			function addEntry() {
				replaceLessons(lessonsOf().concat([{ text: "", enabled: true, everyTurn: true }]));
			}

			if (loadError !== null) {
				return React.createElement("div", { className: "aic-root" },
					React.createElement("p", { className: "aic-error" }, "load failed: " + loadError));
			}
			if (store === null) {
				return React.createElement("div", { className: "aic-root" },
					React.createElement("p", { className: "aic-meta" }, "loading\u2026"));
			}

			const heading = React.createElement("div", { className: "aic-head" },
				GearIcon !== null ? React.createElement(GearIcon, { size: 16 }) : null,
				"Inject Context");

			const tabs = React.createElement("div", { className: "aic-tabs" },
				React.createElement("button", {
					type: "button",
					className: "aic-tab" + (tab === "simple" ? " active" : ""),
					"aria-pressed": tab === "simple" ? "true" : "false",
					onClick: function () { switchTab("simple"); }
				}, "Simple"),
				React.createElement("button", {
					type: "button",
					className: "aic-tab" + (tab === "advanced" ? " active" : ""),
					"aria-pressed": tab === "advanced" ? "true" : "false",
					onClick: function () { switchTab("advanced"); }
				}, "Advanced"));

			const lessons = lessonsOf();
			const rows = lessons.map(function (entry, index) {
				return React.createElement("div", {
					key: typeof entry.id === "number" ? "id-" + entry.id : "row-" + index,
					className: "aic-row" + (entry.enabled === true ? "" : " off")
				},
					React.createElement("div", { className: "aic-main" },
						React.createElement("input", {
							type: "checkbox",
							title: "enabled",
							"aria-label": "Enabled",
							checked: entry.enabled === true,
							onChange: function (event) { patchAt(index, { enabled: event.target.checked }); }
						}),
						React.createElement("div", { className: "aic-col" },
							React.createElement("textarea", {
								placeholder: "Context text\u2026",
								"aria-label": "Context text",
								value: typeof entry.text === "string" ? entry.text : "",
								onChange: function (event) { patchAt(index, { text: event.target.value }); }
							}),
							React.createElement("label", { className: "aic-freq" },
								React.createElement("input", {
									type: "checkbox",
									title: "everyTurn",
									"aria-label": "Every turn",
									checked: entry.everyTurn !== false,
									onChange: function (event) { patchAt(index, { everyTurn: event.target.checked }); }
								}),
								React.createElement("span", null, "Every turn \u2014 ticked: before every message \u00b7 unticked: only the first message of a session")))),
					React.createElement("div", { className: "aic-actions" },
						React.createElement("span", { className: "aic-badge" }, "#" + (typeof entry.id === "number" ? entry.id : "new")),
						React.createElement("button", {
							type: "button",
							className: "aic-del",
							"aria-label": "Delete context",
							onClick: function () { removeAt(index); }
						}, "Delete")));
			});

			return React.createElement("div", { className: "aic-root" },
				heading,
				tabs,
				React.createElement("p", { className: "aic-sub" },
					"Two independent datasets. The ",
					React.createElement("b", null, tab === "advanced" ? "Advanced" : "Simple"),
					" dataset (the active mode) exclusively feeds the standalone ",
					React.createElement("b", null, "Remember:"),
					" row injected immediately before your message (per entry: every turn by default, or only the first message of a session when \u201cEvery turn\u201d is unticked); the other dataset is inert. Switching tabs persists the mode immediately; edits apply from the next request."),
				rows.length === 0
					? React.createElement("p", { className: "aic-meta" }, "No contexts in this dataset yet \u2014 add one below.")
					: rows,
				React.createElement("div", { className: "aic-bar" },
					React.createElement("button", { type: "button", className: "aic-btn outline", onClick: addEntry }, "Add Context"),
					React.createElement("button", { type: "button", className: "aic-btn primary", disabled: saving, onClick: saveAll }, saving ? "Saving\u2026" : "Save"),
					status !== null && status.text !== ""
						? React.createElement("span", { className: "aic-status" + (status.ok ? "" : " err") + " show" }, status.text)
						: null),
				React.createElement("p", { className: "aic-meta" },
					"Active mode: " + (tab === "advanced" ? "Advanced" : "Simple") + " \u2014 " + lessons.length + " context(s), " + countEnabled(lessons) + " enabled and injected. Store: ~/.dsh/adrian-inject-context.json"));
		}

		exports.name = NS;
		// Declare the client service we touch (canonical settings.section form:
		// inject: ['slots'] + ctx.slots). Without the declaration the plugin
		// starts before the slots service exists and a ctx.get() lookup silently
		// misses — the registration race that kept the nav entry from appearing.
		exports.inject = ["slots"];

		// Client plugin body: register the Settings section through the standard
		// settings.section slot (the registry dshmarket's "Plugin Market" at
		// order 40 and dsh-cost-meter's "Cost" at order 30 use), at order 50 so
		// the entry sits directly under Plugin Market in the nav rail.
		exports.apply = function (ctx) {
			const slots = ctx.slots;
			if (slots === undefined) {
				console.warn("[adrian-inject-context] settings section skipped: slots service unavailable");
				return;
			}
			ctx.effect(function () {
				ensureStyles();
				return slots.inject("settings.section", function () {
					return slots.register(
						{
							name: "settings.section",
							id: NS,
							order: 50,
							label: "Inject Context",
							inject: function () { return {}; }
						},
						function () {
							return React.createElement(InjectContextSection, null);
						}
					);
				});
			}, NS + ": settings section");
			return function () {
				dropStyles();
			};
		};

		return module.exports;
	}
});
