const ACTIONS = ['up', 'down', 'left', 'right', 'drift', 'boost'];
const EMPTY_ACTIONS = () => Object.fromEntries(ACTIONS.map(action => [action, false]));
const DEADZONE = 0.32;
const BUTTON_THRESHOLD = 0.55;

function mergeActionState(...sources) {
    return Object.fromEntries(ACTIONS.map(action => [action, sources.some(source => Boolean(source?.[action]))]));
}

function readButton(pad, index) {
    const button = pad?.buttons?.[index];
    if (typeof button === 'boolean') return button;
    return Boolean(button?.pressed || (Number(button?.value) || 0) >= BUTTON_THRESHOLD);
}

function axisActive(value, positive) {
    const numeric = Number(value) || 0;
    return positive ? numeric >= DEADZONE : numeric <= -DEADZONE;
}

class GamepadInputController {
    constructor(navigatorRef = globalThis.navigator) {
        this.navigator = navigatorRef;
        this.previousButtons = Object.create(null);
        this.previousPadId = null;
    }

    poll() {
        let pads;
        try { pads = this.navigator?.getGamepads?.(); } catch { pads = null; }
        const pad = pads ? Array.from(pads).find(candidate => candidate?.connected) : null;
        if (!pad) {
            const wasConnected = this.previousPadId !== null;
            this.previousPadId = null;
            this.previousButtons = Object.create(null);
            return { connected: false, id: null, actions: EMPTY_ACTIONS(), pressed: { fire: false, reset: false, pause: false }, disconnected: wasConnected };
        }

        const changedPad = this.previousPadId !== pad.id;
        if (changedPad) this.previousButtons = Object.create(null);
        const buttonStates = {
            drift: readButton(pad, 0),
            boost: readButton(pad, 1),
            fire: readButton(pad, 2),
            reset: readButton(pad, 3),
            pause: readButton(pad, 9)
        };
        const pressed = {
            fire: buttonStates.fire && !this.previousButtons.fire,
            reset: buttonStates.reset && !this.previousButtons.reset,
            pause: buttonStates.pause && !this.previousButtons.pause
        };
        this.previousButtons = buttonStates;
        this.previousPadId = pad.id;

        const axisX = Number(pad.axes?.[0]) || 0;
        const axisY = Number(pad.axes?.[1]) || 0;
        const actions = {
            up: axisActive(axisY, false) || readButton(pad, 12),
            down: axisActive(axisY, true) || readButton(pad, 13),
            left: axisActive(axisX, false) || readButton(pad, 14),
            right: axisActive(axisX, true) || readButton(pad, 15),
            drift: buttonStates.drift,
            boost: buttonStates.boost
        };
        return { connected: true, id: pad.id, actions, pressed, disconnected: false };
    }
}

export { ACTIONS, DEADZONE, GamepadInputController, mergeActionState };
