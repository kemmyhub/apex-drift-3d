const TUTORIAL_STEPS = [
    { title: "Choose your line", text: "Practice uses your selected car and current circuit in the existing three-lap Single Player race against three AI rivals. This gives you opponents for combat pickups; you can skip the briefing and start any normal race from the garage." },
    { title: "Accelerate and brake", text: "Hold W or ↑ to accelerate. Hold S or ↓ to brake, then reverse when stopped. On touch screens, hold GAS or BRAKE." },
    { title: "Steer and drift", text: "Use A/D or ←/→ to steer. Hold SPACE to drift through a corner and build nitro charge; release the drift control to regain grip." },
    { title: "Boost and recover", text: "Press or hold LEFT SHIFT to spend 25% nitro for a speed burst. Press R to reset your car onto the circuit if you get stuck." },
    { title: "Pickups and counters", text: "Collect the glowing pickups across four types: Homing Pulse targets a rival ahead and Shockwave disrupts nearby rivals, so each needs opponents in range; Phase Shield counters incoming hits; Turbo Cell grants an instant boost. Press F or FIRE to use a pickup. The combat slot and shield/stun feedback are shown in the HUD." },
    { title: "Tune your car", text: "Back in the garage, spend race credits on Engine for speed and acceleration, Handling for cornering and grip, or Nitro for longer boost duration. Each upgrade belongs to the selected car and can reach level 5; the performance bars preview your selected car's stats." },
    { title: "Read the race HUD", text: "Watch position, lap, lap time, best lap, speed, nitro, drift points, and your current weapon. Practice is a three-lap race against three AI rivals on the selected circuit; finish the laps to see your results." },
    { title: "Finish and return", text: "At the finish, review your lap and rewards. Choose Return to Garage to select another car or circuit, adjust graphics, or replay this tutorial at any time." }
];

class TutorialManager {
    constructor(documentRef = document) {
        this.document = documentRef;
        this.dialog = this.document.getElementById("ui-tutorial");
        this.index = 0;
        this.returnFocus = null;
        this.onStart = null;
        this.onSkip = null;
        this.bind();
    }

    bind() {
        if (!this.dialog) return;
        this.content = this.dialog.querySelector("#tutorial-content");
        this.progress = this.dialog.querySelector("#tutorial-progress");
        this.previousButton = this.dialog.querySelector("#tutorial-previous");
        this.nextButton = this.dialog.querySelector("#tutorial-next");
        this.startButton = this.dialog.querySelector("#tutorial-start-practice");
        this.skipButton = this.dialog.querySelector("#tutorial-skip");
        this.previousButton?.addEventListener("click", () => this.showStep(this.index - 1));
        this.nextButton?.addEventListener("click", () => this.showStep(this.index + 1));
        this.startButton?.addEventListener("click", () => this.startPractice());
        this.skipButton?.addEventListener("click", () => this.skip());
        this.dialog.addEventListener("keydown", event => this.handleDialogKeydown(event));
    }

    open({ onStart, onSkip } = {}) {
        if (!this.dialog) return;
        this.returnFocus = this.document.activeElement;
        this.onStart = onStart;
        this.onSkip = onSkip;
        this.showStep(0);
        this.dialog.classList?.remove("hidden");
        this.dialog.hidden = false;
        this.dialog.inert = false;
        this.dialog.focus();
        this.nextButton?.focus();
    }

    showStep(index) {
        this.index = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, index));
        const step = TUTORIAL_STEPS[this.index];
        if (this.content) this.content.innerHTML = `<h3>${step.title}</h3><p>${step.text}</p>`;
        if (this.progress) this.progress.textContent = `Lesson ${this.index + 1} of ${TUTORIAL_STEPS.length}`;
        if (this.previousButton) this.previousButton.disabled = this.index === 0;
        if (this.nextButton) this.nextButton.disabled = this.index === TUTORIAL_STEPS.length - 1;
        if (this.nextButton) this.nextButton.textContent = this.index === TUTORIAL_STEPS.length - 1 ? "All lessons shown" : "Next lesson";
    }

    handleDialogKeydown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            this.skip();
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...this.dialog.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length) { event.preventDefault(); this.dialog.focus(); return; }
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && this.document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && this.document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    close({ restoreFocus = true } = {}) {
        if (!this.dialog) return;
        this.dialog.hidden = true;
        this.dialog.inert = true;
        this.dialog.classList?.add("hidden");
        if (restoreFocus) this.returnFocus?.focus?.();
        this.returnFocus = null;
    }

    startPractice() {
        const callback = this.onStart;
        this.close({ restoreFocus: false });
        callback?.();
        this.document.getElementById("btn-pause-race")?.focus?.();
    }

    skip() {
        const callback = this.onSkip;
        this.close();
        callback?.();
    }
}

export { TutorialManager, TUTORIAL_STEPS };
