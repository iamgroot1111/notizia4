import { pwaStore } from "../pwaStore";
import { electronStore } from "../electronStore";

type MaybeWithApi = Window & { api?: unknown };
const hasApi: boolean = typeof (window as MaybeWithApi).api !== "undefined";

export const store = hasApi ? electronStore : pwaStore;
