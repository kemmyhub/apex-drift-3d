function bootstrapGame({ documentRef, windowRef, createApp }) {
    try {
        if (!windowRef?.THREE?.WebGLRenderer) {
            throw new Error("Three.js failed to load.");
        }

        windowRef.apexGame = createApp();
        return true;
    } catch (error) {
        console.error("APEX DRIFT 3D could not initialize graphics.", error);
        const panel = documentRef?.getElementById("game-startup-error");
        const canvas = documentRef?.getElementById("game-canvas");
        const menu = documentRef?.getElementById("ui-main-menu");
        const globalControls = documentRef?.getElementById("global-controls");

        if (canvas) canvas.style.display = "none";
        if (menu) {
            menu.setAttribute("aria-hidden", "true");
            menu.inert = true;
        }
        if (globalControls) {
            globalControls.setAttribute("aria-hidden", "true");
            globalControls.inert = true;
        }
        if (panel) {
            panel.hidden = false;
            panel.focus();
            const reload = panel.querySelector("[data-startup-reload]");
            if (reload && !reload.dataset.bound) {
                reload.dataset.bound = "true";
                reload.addEventListener("click", () => windowRef?.location?.reload());
            }
        }
        return false;
    }
}

export { bootstrapGame };
