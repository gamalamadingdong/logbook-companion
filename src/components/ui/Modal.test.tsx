// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT:true});
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {await act(async () => root.unmount()); document.body.replaceChildren();});
describe('accessible dialog', () => {
    it('does not hide the dialog from assistive technology', async () => {
        await act(async () => root.render(<Modal open onClose={()=>{}} title="Search"><input aria-label="Search" /></Modal>));
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog?.closest('[aria-hidden="true"]')).toBeNull();
        expect(document.getElementById(dialog!.getAttribute('aria-labelledby')! )?.textContent).toBe('Search');
    });
    it('restores the trigger focus even when closing unmounts the dialog', async () => {
        const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
        await act(async () => root.render(<Modal open onClose={()=>{}} title="Search"><input aria-label="Search" /></Modal>));
        await new Promise(resolve => requestAnimationFrame(resolve));
        document.querySelector('input')!.focus();
        await act(async () => root.render(null));
        expect(document.activeElement).toBe(trigger);
    });
    it('closes with Escape and traps tab at the end of the dialog', async () => {
        const onClose = vi.fn();
        await act(async () => root.render(<Modal open onClose={onClose} title="Search"><input aria-label="Search" /><button>Last</button></Modal>));
        const buttons = document.querySelectorAll('button');
        const last = buttons[buttons.length-1]; last.focus();
        await act(async () => last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));
        expect(document.activeElement).toBe(buttons[0]);
        await act(async () => document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
