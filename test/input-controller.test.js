import test from 'node:test';
import assert from 'node:assert/strict';
import { GamepadInputController, mergeActionState } from '../src/game/InputController.js';

const gamepad = (overrides = {}) => ({
  id: 'Standard Controller', connected: true,
  axes: [0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  ...overrides
});

test('Gamepad API is optional and unavailable APIs produce neutral controls', () => {
  const state = new GamepadInputController({}).poll();
  assert.equal(state.connected, false);
  assert.deepEqual(state.actions, { up: false, down: false, left: false, right: false, drift: false, boost: false });
  assert.deepEqual(state.pressed, { fire: false, reset: false, pause: false });
});

test('standard analog stick and D-pad map to the existing six-action input state', () => {
  const pad = gamepad({ axes: [-0.8, -0.7] });
  pad.buttons[15] = { pressed: true, value: 1 };
  const state = new GamepadInputController({ getGamepads: () => [pad] }).poll();
  assert.deepEqual(state.actions, { up: true, down: false, left: true, right: true, drift: false, boost: false });
});

test('A/B are held drift/boost actions and X/Y/Start are one-shot fire/reset/pause presses', () => {
  const pad = gamepad();
  const controller = new GamepadInputController({ getGamepads: () => [pad] });
  pad.buttons[0] = { pressed: true, value: 1 };
  pad.buttons[1] = { pressed: true, value: 1 };
  pad.buttons[2] = { pressed: true, value: 1 };
  pad.buttons[3] = { pressed: true, value: 1 };
  pad.buttons[9] = { pressed: true, value: 1 };
  let state = controller.poll();
  assert.equal(state.actions.drift, true);
  assert.equal(state.actions.boost, true);
  assert.deepEqual(state.pressed, { fire: true, reset: true, pause: true });
  state = controller.poll();
  assert.deepEqual(state.pressed, { fire: false, reset: false, pause: false });
  pad.buttons.forEach((_, index) => { pad.buttons[index] = { pressed: false, value: 0 }; });
  controller.poll();
  pad.buttons[2] = { pressed: true, value: 1 };
  assert.equal(controller.poll().pressed.fire, true);
});

test('disconnected controllers release all controls and only report one disconnect edge', () => {
  let pads = [gamepad({ axes: [1, 1] })];
  const controller = new GamepadInputController({ getGamepads: () => pads });
  assert.equal(controller.poll().actions.right, true);
  pads = [];
  let state = controller.poll();
  assert.equal(state.disconnected, true);
  assert.deepEqual(state.actions, { up: false, down: false, left: false, right: false, drift: false, boost: false });
  state = controller.poll();
  assert.equal(state.disconnected, false);
});

test('Gamepad API exceptions are contained and cannot prevent keyboard/touch play', () => {
  const state = new GamepadInputController({ getGamepads() { throw new Error('blocked'); } }).poll();
  assert.equal(state.connected, false);
});

test('gamepad actions merge with keyboard/touch and release independently', () => {
  const deviceActions = { up: true, left: false, drift: false };
  const padActions = { up: false, left: true, drift: true, boost: true };
  assert.deepEqual(mergeActionState(deviceActions, padActions), {
    up: true, down: false, left: true, right: false, drift: true, boost: true
  });
  assert.deepEqual(mergeActionState(deviceActions, {}), {
    up: true, down: false, left: false, right: false, drift: false, boost: false
  });
});
