import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorialManager, TUTORIAL_STEPS } from '../src/game/TutorialManager.js';

const tutorialCopy = TUTORIAL_STEPS.map(step => `${step.title} ${step.text}`).join(' ').toLowerCase();
for (const topic of ['accelerate', 'brake', 'steer', 'drift', 'nitro', 'homing pulse', 'phase shield', 'shockwave', 'turbo cell', 'credits', 'hud', 'results', 'garage']) {
  assert.ok(tutorialCopy.includes(topic), `tutorial should cover ${topic}`);
}

class FakeElement {
  constructor(document) { this.document = document; this.handlers = {}; this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.hidden = true; this.inert = true; this.classList = { add() {}, remove() {} }; }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  focus() { this.document.activeElement = this; }
  querySelector(id) { return this.document.elements.get(id.slice(1)); }
  querySelectorAll() { return [this.document.elements.get('tutorial-previous'), this.document.elements.get('tutorial-next'), this.document.elements.get('tutorial-start-practice'), this.document.elements.get('tutorial-skip')]; }
}
function fixture() {
  const document = { elements: new Map(), activeElement: null, getElementById(id) { return this.elements.get(id); } };
  for (const id of ['ui-tutorial','tutorial-content','tutorial-progress','tutorial-previous','tutorial-next','tutorial-start-practice','tutorial-skip','btn-pause-race','open-button']) document.elements.set(id, new FakeElement(document));
  const manager = new TutorialManager(document);
  return { document, manager };
}

test('tutorial presents required lesson topics, supports replay, and navigates within bounds', () => {
  const { document, manager } = fixture();
  const opener = document.getElementById('open-button');
  document.activeElement = opener;
  manager.open();
  assert.equal(manager.index, 0);
  assert.equal(document.getElementById('tutorial-progress').textContent, `Lesson 1 of ${TUTORIAL_STEPS.length}`);
  manager.showStep(1);
  assert.match(document.getElementById('tutorial-content').innerHTML, /accelerate|brake/i);
  manager.showStep(999);
  assert.equal(manager.index, TUTORIAL_STEPS.length - 1);
  manager.showStep(-1);
  assert.equal(manager.index, 0);
  manager.skip();
  assert.equal(document.getElementById('ui-tutorial').hidden, true);
  assert.equal(document.activeElement, opener);
  manager.open();
  assert.equal(manager.index, 0);
});

test('Escape skips and restores focus; Tab is trapped in both directions', () => {
  const { document, manager } = fixture();
  const opener = document.getElementById('open-button');
  document.activeElement = opener;
  manager.open();
  const buttons = document.getElementById('ui-tutorial').querySelectorAll();
  document.activeElement = buttons[0];
  let prevented = false;
  manager.handleDialogKeydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, buttons.at(-1));
  let escaped = false;
  manager.handleDialogKeydown({ key: 'Escape', preventDefault() { escaped = true; } });
  assert.equal(escaped, true);
  assert.equal(document.getElementById('ui-tutorial').hidden, true);
  assert.equal(document.activeElement, opener);
});

test('starting practice closes lessons, starts one solo practice callback, and focuses race control', () => {
  const { document, manager } = fixture();
  let starts = 0;
  manager.open({ onStart() { starts += 1; } });
  manager.startPractice();
  assert.equal(starts, 1);
  assert.equal(document.getElementById('ui-tutorial').hidden, true);
  assert.equal(document.activeElement, document.getElementById('btn-pause-race'));
});
