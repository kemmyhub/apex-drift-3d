const STORAGE_WARNING_EVENT = "apex-storage-warning";

function getLocalStorageItem(key) {
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function setLocalStorageItem(key, value) {
    try {
        const storage = globalThis.localStorage;
        if (!storage) throw new Error("Browser storage is unavailable.");
        storage.setItem(key, String(value));
        return true;
    } catch {
        try {
            const notify = () => {
                if (typeof CustomEvent !== "function") return;
                const event = new CustomEvent(STORAGE_WARNING_EVENT, {
                    detail: { message: "Progress could not be saved. Browser storage is unavailable or full." }
                });
                globalThis.window?.dispatchEvent(event);
            };
            if (typeof queueMicrotask === "function") queueMicrotask(notify);
            else setTimeout(notify, 0);
        } catch {
            // Storage warnings must never turn a recoverable save failure into a crash.
        }
        return false;
    }
}

export { getLocalStorageItem, setLocalStorageItem, STORAGE_WARNING_EVENT };
