import test from 'node:test';
import assert from 'node:assert/strict';
import { DialogFocusManager } from '../src/utils/DialogFocusManager.js';

class FakeElement {
  constructor(name, document) { this.name = name; this.document = document; this.handlers = {}; this.disabled = false; this.hidden = false; this.parentHidden = false; this.isConnected = true; }
  focus() { this.document.activeElement = this; }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  removeEventListener(type) { delete this.handlers[type]; }
  closest() { return this.parentHidden ? {} : null; }
}
function fixture() {
  const document = { activeElement: null };
  const opener = new FakeElement('opener', document);
  const first = new FakeElement('first', document);
  const last = new FakeElement('last', document);
  const hidden = new FakeElement('hidden', document); hidden.parentHidden = true;
  const dialog = new FakeElement('dialog', document);
  dialog.querySelector = selector => selector === '#first' ? first : null;
  dialog.querySelectorAll = () => [first, last, hidden];
  dialog.contains = element => [first, last, hidden, dialog].includes(element);
  document.activeElement = opener;
  return { document, opener, first, last, hidden, dialog, manager: new DialogFocusManager(document) };
}

test('dialog opening moves focus inside and Tab wraps around visible dialog controls', () => {
  const { document, first, last, dialog, manager } = fixture();
  manager.open(dialog, { initialFocusSelector: '#first' });
  assert.equal(document.activeElement, first);
  let prevented = false;
  document.activeElement = last;
  dialog.handlers.keydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, first);
  document.activeElement = first;
  dialog.handlers.keydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
  assert.equal(document.activeElement, last);
});

test('Escape closes a dialog, prevents background propagation, and restores opener focus', () => {
  const { document, opener, first, dialog, manager } = fixture();
  let closeCount = 0;
  manager.open(dialog, { initialFocusSelector: '#first', onEscape: () => { closeCount += 1; manager.close(); } });
  let stopped = false;
  dialog.handlers.keydown({ key: 'Escape', preventDefault() {}, stopPropagation() { stopped = true; } });
  assert.equal(closeCount, 1);
  assert.equal(stopped, true);
  assert.equal(manager.dialog, null);
  assert.equal(document.activeElement, opener);
  assert.equal(dialog.handlers.keydown, undefined);
});

test('Tab returns focus to the dialog if focus was programmatically moved outside it', () => {
  const { document, opener, first, dialog, manager } = fixture();
  manager.open(dialog);
  document.activeElement = opener;
  dialog.handlers.keydown({ key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(document.activeElement, first);
});
