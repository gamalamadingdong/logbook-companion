// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    auth: {user:{id:'owner'},isCoach:true},
    context: {activeTeam:{team_id:'team-a',team_name:'Winter squad',role:'coach',org_id:null} as {team_id:string;team_name:string;role:string;org_id:null}|null,isLoadingTeam:false},
    workouts:vi.fn(), blocks:vi.fn(), templates:vi.fn(), team:vi.fn(),
}));
vi.mock('../hooks/useAuth',()=>({useAuth:()=>mocks.auth}));
vi.mock('../hooks/useCoachingContext',()=>({useCoachingContext:()=>mocks.context}));
vi.mock('../search/contentSearch',()=>({searchWorkouts:mocks.workouts,searchBlocks:mocks.blocks,searchTemplates:mocks.templates}));
vi.mock('../search/teamSearch',()=>({searchTeam:mocks.team}));
import { CommandPalette } from './CommandPalette';
let host: HTMLDivElement, root:Root;
const empty = {items:[],hasMore:false};
const workout = {id:'workout:one',group:'workouts',title:'4x500m',subtitle:'Nov 10, 2026 · 2,000 m · 8:12',href:'/workout/one'};
function Probe(){return <output data-location>{useLocation().pathname}</output>;}
function render(onClose=()=>{}){return act(async()=>root.render(<MemoryRouter><CommandPalette open onClose={onClose}/><Probe/></MemoryRouter>));}
async function type(query:string) {
    const input = document.querySelector('input')!;
    await act(async()=>{
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,query);
        input.dispatchEvent(new Event('input',{bubbles:true}));
    });
}
beforeEach(()=>{
    Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,ResizeObserver:class {observe(){} unobserve(){} disconnect(){}}});
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
    mocks.auth.user.id='owner';mocks.context.activeTeam={team_id:'team-a',team_name:'Winter squad',role:'coach',org_id:null};
    for (const fn of [mocks.workouts,mocks.blocks,mocks.templates,mocks.team]) fn.mockReset().mockResolvedValue(empty);
    mocks.workouts.mockResolvedValue({items:[workout],hasMore:false});
    host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());document.body.replaceChildren();vi.useRealTimers();});
describe('content search dialog',()=>{
    it('shows grouped content with distinguishing context and opens a workout',async()=>{
        const close=vi.fn(); await render(close); await type('500m');
        await act(async()=>vi.advanceTimersByTimeAsync(300));
        expect(document.body.textContent).toContain('2,000 m');
        expect(document.body.textContent).toContain('Training blocks');
        expect(document.body.textContent).toContain('Team: Winter squad');
        const option=document.querySelector('[cmdk-item][data-value="workout:one"]')!;
        await act(async()=>option.dispatchEvent(new MouseEvent('click',{bubbles:true})));
        expect(close).toHaveBeenCalledOnce();
        expect(document.querySelector('[data-location]')!.textContent).toBe('/workout/one');
    });
    it('opens the selected content using the keyboard',async()=>{
        const close=vi.fn();await render(close);await type('500m');
        await act(async()=>vi.advanceTimersByTimeAsync(300));
        const input=document.querySelector('input')!;
        await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
        await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
        expect(close).toHaveBeenCalledOnce();
        expect(document.querySelector('[data-location]')!.textContent).toBe('/workout/one');
    });
    it('immediately removes prior results after changing the query or active team',async()=>{
        await render();await type('500m');await act(async()=>vi.advanceTimersByTimeAsync(300));
        expect(document.querySelector('[data-value="workout:one"]')).not.toBeNull();
        await type('core');
        expect(document.querySelector('[data-value="workout:one"]')).toBeNull();
        await act(async()=>vi.advanceTimersByTimeAsync(300));
        mocks.context.activeTeam={team_id:'team-b',team_name:'Other squad',role:'member',org_id:null};
        await render();
        expect(document.querySelector('[data-value="workout:one"]')).toBeNull();
        expect(document.body.textContent).toContain('Team: Other squad');
    });
    it('retains workout matches and offers retry when another source fails',async()=>{
        mocks.blocks.mockRejectedValue(new Error('offline'));
        await render();await type('500m');await act(async()=>vi.advanceTimersByTimeAsync(300));
        expect(document.body.textContent).toContain('4x500m');
        expect(document.body.textContent).toContain('Could not search');
        expect(document.body.textContent).toContain('Retry search');
    });
    it('hides active-team group when no team is selected',async()=>{
        mocks.context.activeTeam=null;
        await render();await type('500m');await act(async()=>vi.advanceTimersByTimeAsync(300));
        expect(document.body.textContent).not.toContain('Active team');
        expect(mocks.team).not.toHaveBeenCalled();
    });
});
