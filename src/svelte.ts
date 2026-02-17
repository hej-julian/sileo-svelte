import {
	AUTO_COLLAPSE_DELAY,
	AUTO_EXPAND_DELAY,
	DEFAULT_TOAST_DURATION,
	EXIT_DURATION,
} from "./constants";
import "./styles.css";

export type SileoState =
	| "success"
	| "loading"
	| "error"
	| "warning"
	| "info"
	| "action";

export const SILEO_POSITIONS = [
	"top-left",
	"top-center",
	"top-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
] as const;

export type SileoPosition = (typeof SILEO_POSITIONS)[number];
export type SileoOffsetValue = number | string;
export type SileoOffsetConfig = Partial<
	Record<"top" | "right" | "bottom" | "left", SileoOffsetValue>
>;

export interface SileoStyles {
	title?: string;
	description?: string;
	button?: string;
}

export interface SileoButton {
	title: string;
	onClick: () => void;
}

export interface SileoOptions {
	title?: string;
	description?: string;
	position?: SileoPosition;
	duration?: number | null;
	styles?: SileoStyles;
	state?: SileoState;
	autopilot?: boolean | { expand?: number; collapse?: number };
	button?: SileoButton;
	id?: string;
}

export interface SileoToasterProps {
	position?: SileoPosition;
	offset?: SileoOffsetValue | SileoOffsetConfig;
	options?: Partial<SileoOptions>;
}

export interface RegisterSileoElementOptions {
	tagName?: string;
}

interface SileoItem extends SileoOptions {
	id: string;
	instanceId: string;
	exiting?: boolean;
	autoExpandDelayMs?: number;
	autoCollapseDelayMs?: number;
}

const DEFAULT_TAG = "sileo-toaster";

const isPosition = (value: string | null): value is SileoPosition =>
	Boolean(value && (SILEO_POSITIONS as readonly string[]).includes(value));

const parseJson = <T,>(value: string | null): T | undefined => {
	if (!value) return undefined;
	try {
		return JSON.parse(value) as T;
	} catch {
		return undefined;
	}
};

const px = (v: SileoOffsetValue) => (typeof v === "number" ? `${v}px` : v);

const resolveViewportStyle = (
	position: SileoPosition,
	offset?: SileoOffsetValue | SileoOffsetConfig,
) => {
	if (offset === undefined) return {};
	const cfg =
		typeof offset === "object"
			? offset
			: { top: offset, right: offset, bottom: offset, left: offset };

	const style: Partial<CSSStyleDeclaration> = {};
	if (position.startsWith("top") && cfg.top !== undefined) style.top = px(cfg.top);
	if (position.startsWith("bottom") && cfg.bottom !== undefined)
		style.bottom = px(cfg.bottom);
	if (position.endsWith("left") && cfg.left !== undefined) style.left = px(cfg.left);
	if (position.endsWith("right") && cfg.right !== undefined)
		style.right = px(cfg.right);
	return style;
};

const applyOffset = (
	el: HTMLElement,
	position: SileoPosition,
	offset?: SileoOffsetValue | SileoOffsetConfig,
) => {
	const style = resolveViewportStyle(position, offset);
	el.style.top = style.top ?? "";
	el.style.right = style.right ?? "";
	el.style.bottom = style.bottom ?? "";
	el.style.left = style.left ?? "";
};

let idCounter = 0;
const generateId = () =>
	`${++idCounter}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const resolveAutopilot = (
	opts: SileoOptions,
	duration: number | null,
): { expandDelayMs?: number; collapseDelayMs?: number } => {
	if (opts.autopilot === false || !duration || duration <= 0) return {};
	const cfg = typeof opts.autopilot === "object" ? opts.autopilot : undefined;
	const clamp = (v: number) => Math.min(duration, Math.max(0, v));
	return {
		expandDelayMs: clamp(cfg?.expand ?? AUTO_EXPAND_DELAY),
		collapseDelayMs: clamp(cfg?.collapse ?? AUTO_COLLAPSE_DELAY),
	};
};

const hosts = new Set<SileoToasterElement>();

const store = {
	toasts: [] as SileoItem[],
	defaultOptions: undefined as Partial<SileoOptions> | undefined,

	emit() {
		for (const host of hosts) host.renderStore(this.toasts);
	},

	update(fn: (prev: SileoItem[]) => SileoItem[]) {
		this.toasts = fn(this.toasts);
		this.emit();
	},
};

const dismissToast = (id: string) => {
	const item = store.toasts.find((t) => t.id === id);
	if (!item || item.exiting) return;

	store.update((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
	setTimeout(() => {
		store.update((prev) => prev.filter((t) => t.id !== id));
	}, EXIT_DURATION);
};

const mergeOptions = (options: SileoOptions): SileoOptions => ({
	...store.defaultOptions,
	...options,
	styles: { ...store.defaultOptions?.styles, ...options.styles },
});

const buildItem = (merged: SileoOptions, id: string): SileoItem => {
	const duration = merged.duration ?? DEFAULT_TOAST_DURATION;
	const auto = resolveAutopilot(merged, duration);
	return {
		...merged,
		id,
		instanceId: generateId(),
		position: merged.position ?? "top-right",
		autoExpandDelayMs: auto.expandDelayMs,
		autoCollapseDelayMs: auto.collapseDelayMs,
	};
};

const createToast = (options: SileoOptions) => {
	const merged = mergeOptions(options);
	const id = merged.id ?? "sileo-default";
	const prev = store.toasts.find((t) => t.id === id && !t.exiting);
	const item = buildItem(merged, id);

	if (prev) {
		store.update((p) => p.map((t) => (t.id === id ? item : t)));
	} else {
		store.update((p) => [...p.filter((t) => t.id !== id), item]);
	}

	return { id, duration: merged.duration ?? DEFAULT_TOAST_DURATION };
};

const updateToast = (id: string, options: SileoOptions) => {
	const existing = store.toasts.find((t) => t.id === id);
	if (!existing) return;
	const item = buildItem(mergeOptions({ ...options, id }), id);
	store.update((prev) => prev.map((t) => (t.id === id ? item : t)));
};

export interface SileoPromiseOptions<T = unknown> {
	loading: Pick<SileoOptions, "title">;
	success: SileoOptions | ((data: T) => SileoOptions);
	error: SileoOptions | ((err: unknown) => SileoOptions);
	action?: SileoOptions | ((data: T) => SileoOptions);
	position?: SileoPosition;
}

export const sileo = {
	show: (opts: SileoOptions) => createToast(opts).id,
	success: (opts: SileoOptions) => createToast({ ...opts, state: "success" }).id,
	error: (opts: SileoOptions) => createToast({ ...opts, state: "error" }).id,
	warning: (opts: SileoOptions) => createToast({ ...opts, state: "warning" }).id,
	info: (opts: SileoOptions) => createToast({ ...opts, state: "info" }).id,
	action: (opts: SileoOptions) => createToast({ ...opts, state: "action" }).id,

	promise: <T,>(
		promise: Promise<T> | (() => Promise<T>),
		opts: SileoPromiseOptions<T>,
	): Promise<T> => {
		const { id } = createToast({
			...opts.loading,
			state: "loading",
			duration: null,
			position: opts.position,
		});

		const p = typeof promise === "function" ? promise() : promise;

		p.then((data) => {
			if (opts.action) {
				const actionOpts =
					typeof opts.action === "function" ? opts.action(data) : opts.action;
				updateToast(id, { ...actionOpts, state: "action", id });
			} else {
				const successOpts =
					typeof opts.success === "function" ? opts.success(data) : opts.success;
				updateToast(id, { ...successOpts, state: "success", id });
			}
		}).catch((err) => {
			const errorOpts =
				typeof opts.error === "function" ? opts.error(err) : opts.error;
			updateToast(id, { ...errorOpts, state: "error", id });
		});

		return p;
	},

	dismiss: dismissToast,

	clear: (position?: SileoPosition) =>
		store.update((prev) => (position ? prev.filter((t) => t.position !== position) : [])),
};

const stateSymbol = (state: SileoState | undefined) => {
	switch (state) {
		case "success":
			return "✓";
		case "loading":
			return "◌";
		case "error":
			return "×";
		case "warning":
			return "!";
		case "info":
			return "i";
		case "action":
			return "→";
		default:
			return "✓";
	}
};

class SileoToasterElement extends HTMLElement {
	private viewport?: HTMLElement;
	private timers = new Map<string, number>();

	static get observedAttributes() {
		return ["position", "offset", "options"];
	}

	connectedCallback() {
		hosts.add(this);
		this.ensureViewport();
		this.applyConfig();
		this.renderStore(store.toasts);
	}

	attributeChangedCallback() {
		this.applyConfig();
		this.renderStore(store.toasts);
	}

	disconnectedCallback() {
		hosts.delete(this);
		for (const timer of this.timers.values()) window.clearTimeout(timer);
		this.timers.clear();
	}

	private ensureViewport() {
		if (this.viewport) return;
		const section = document.createElement("section");
		section.setAttribute("data-sileo-viewport", "");
		section.setAttribute("aria-live", "polite");
		this.appendChild(section);
		this.viewport = section;
	}

	private getPosition(): SileoPosition {
		const raw = this.getAttribute("position");
		return isPosition(raw) ? raw : "top-right";
	}

	private getOffset(): SileoOffsetValue | SileoOffsetConfig | undefined {
		const raw = this.getAttribute("offset");
		if (!raw) return undefined;
		const json = parseJson<SileoOffsetValue | SileoOffsetConfig>(raw);
		if (json !== undefined) return json;
		const num = Number(raw);
		return Number.isNaN(num) ? raw : num;
	}

	private applyConfig() {
		const options = parseJson<Partial<SileoOptions>>(this.getAttribute("options"));
		if (hosts.values().next().value === this) {
			store.defaultOptions = options;
		}

		if (!this.viewport) return;
		const position = this.getPosition();
		this.viewport.dataset.position = position;
		applyOffset(this.viewport, position, this.getOffset());
	}

	renderStore(toasts: SileoItem[]) {
		if (!this.viewport) return;
		const position = this.getPosition();
		const scoped = toasts.filter((t) => (t.position ?? "top-right") === position);

		for (const key of this.timers.keys()) {
			if (!scoped.some((t) => `${t.id}:${t.instanceId}` === key)) {
				window.clearTimeout(this.timers.get(key));
				this.timers.delete(key);
			}
		}

		this.viewport.textContent = "";

		for (const item of scoped) {
			const toast = document.createElement("button");
			toast.type = "button";
			toast.setAttribute("data-sileo-toast", "");
			toast.dataset.state = item.state ?? "success";
			toast.dataset.ready = "true";
			toast.dataset.exiting = item.exiting ? "true" : "false";
			toast.onclick = () => dismissToast(item.id);

			const header = document.createElement("div");
			header.setAttribute("data-sileo-header", "");
			header.dataset.edge = position.startsWith("top") ? "top" : "bottom";

			const title = document.createElement("div");
			title.setAttribute("data-sileo-title", "");
			title.dataset.state = item.state ?? "success";
			if (item.styles?.title) title.className = item.styles.title;
			title.textContent = item.title ?? item.state ?? "toast";

			const badge = document.createElement("span");
			badge.setAttribute("data-sileo-badge", "");
			badge.dataset.state = item.state ?? "success";
			badge.textContent = stateSymbol(item.state);

			header.appendChild(badge);
			header.appendChild(title);
			toast.appendChild(header);

			if (item.description || item.button) {
				const content = document.createElement("div");
				content.setAttribute("data-sileo-content", "");
				content.dataset.edge = position.startsWith("top") ? "top" : "bottom";
				content.dataset.visible = "true";

				if (item.description) {
					const desc = document.createElement("div");
					desc.setAttribute("data-sileo-description", "");
					if (item.styles?.description) desc.className = item.styles.description;
					desc.textContent = item.description;
					content.appendChild(desc);
				}

				if (item.button) {
					const action = document.createElement("button");
					action.type = "button";
					action.setAttribute("data-sileo-button", "");
					action.dataset.state = item.state ?? "success";
					if (item.styles?.button) action.className = item.styles.button;
					action.textContent = item.button.title;
					action.onclick = (event) => {
						event.stopPropagation();
						item.button?.onClick();
					};
					content.appendChild(action);
				}

				toast.appendChild(content);
			}

			this.viewport.appendChild(toast);

			const key = `${item.id}:${item.instanceId}`;
			if (!item.exiting && !this.timers.has(key)) {
				const dur = item.duration ?? DEFAULT_TOAST_DURATION;
				if (dur !== null && dur > 0) {
					this.timers.set(
						key,
						window.setTimeout(() => {
							this.timers.delete(key);
							dismissToast(item.id);
						}, dur),
					);
				}
			}
		}
	}
}

export const registerSileoElement = ({
	tagName = DEFAULT_TAG,
}: RegisterSileoElementOptions = {}) => {
	if (typeof window === "undefined") return;
	if (!customElements.get(tagName)) {
		customElements.define(tagName, SileoToasterElement);
	}
};
