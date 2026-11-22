const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

class DialogFocusManager {
    constructor(documentRef = document) {
        this.document = documentRef;
        this.dialog = null;
        this.opener = null;
        this.onEscape = null;
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    open(dialog, { initialFocusSelector, onEscape } = {}) {
        if (!dialog) return;
        if (this.dialog) this.close({ restoreFocus: false });
        this.dialog = dialog;
        this.opener = this.document.activeElement;
        this.onEscape = onEscape;
        dialog.addEventListener('keydown', this.handleKeydown);
        const target = initialFocusSelector ? dialog.querySelector(initialFocusSelector) : null;
        (target || this.getFocusable()[0] || dialog).focus?.();
    }

    getFocusable() {
        if (!this.dialog) return [];
        return [...this.dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter(element =>
            !element.disabled && !element.closest('[hidden], [inert], [aria-hidden="true"], .hidden')
        );
    }

    handleKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation?.();
            if (this.onEscape) this.onEscape();
            else this.close();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = this.getFocusable();
        if (!focusable.length) {
            event.preventDefault();
            this.dialog?.focus?.();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = this.document.activeElement;
        if (event.shiftKey && (active === first || !this.dialog.contains(active))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (active === last || !this.dialog.contains(active))) {
            event.preventDefault();
            first.focus();
        }
    }

    close({ restoreFocus = true } = {}) {
        if (!this.dialog) return;
        const dialog = this.dialog;
        const opener = this.opener;
        dialog.removeEventListener('keydown', this.handleKeydown);
        this.dialog = null;
        this.opener = null;
        this.onEscape = null;
        if (restoreFocus && opener?.isConnected !== false) opener?.focus?.();
    }

    closeIfOpen({ restoreFocus = true } = {}) {
        if (this.dialog) this.close({ restoreFocus });
    }
}

export { DialogFocusManager, FOCUSABLE_SELECTOR };
