import 'jest';
import Slices from '../../common/Slices';
import { NodeIdentifier } from '../../common/NodeIdentifier';
import NodeState from '../NodeState';
import { findBlockingValues, getBlockingSet } from './getBlockingSet';

const NI = (label: string) => label;
const SL = (slices: NodeIdentifier[][]) =>
    new Slices(new Set(slices.map(slice => new Set(slice))));
const ST = (val: boolean, slices: Slices) => {
    const state = new NodeState(slices);
    state.setVote(val);
    state.setAccept(val);
    return state;
}
describe('findBlockingValues', () => {
    test('should find both values', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c], [d, e]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(false, bSlice);
        const cState = ST(true, cSlice);
        const dState = ST(false, dSlice);
        const eState = ST(true, eSlice);

        const state = new Map();
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = findBlockingValues(a, state);

        expect(result).toContain(true);
        expect(result).toContain(false);
    })

    test('should find only true', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c], [d, e]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(true, bSlice);
        const cState = ST(true, cSlice);
        const dState = ST(false, dSlice);
        const eState = ST(true, eSlice);

        const state = new Map();
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = findBlockingValues(a, state);

        expect(result).toContain(true);
    })

    test('should find only false', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c], [d, e]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(false, bSlice);
        const cState = ST(false, cSlice);
        const dState = ST(false, dSlice);
        const eState = ST(true, eSlice);

        const state = new Map();
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = findBlockingValues(a, state);

        expect(result).toContain(false);
    })


})

describe('getBlockingSet', () => {
    test('should find both values', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c], [d, e]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(false, bSlice);
        const cState = ST(true, cSlice);
        const dState = ST(false, dSlice);
        const eState = ST(true, eSlice);

        const state = new Map();
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = getBlockingSet(a, state);

        expect(result).toBeNull()
    })

    test('should find only true', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c], [d, e]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(true, bSlice);
        const cState = ST(true, cSlice);
        const dState = ST(false, dSlice);
        const eState = ST(true, eSlice);

        const state = new Map();
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = getBlockingSet(a, state);

        expect(result).toBeTruthy()
        expect(result!.value).toBe(true);
        expect(result!.blockingSet).toEqual([[b, c], [e]]);
    })

    test('should find only false', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c], [d, e]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(false, bSlice);
        const cState = ST(false, cSlice);
        const dState = ST(false, dSlice);
        const eState = ST(true, eSlice);

        const state = new Map();
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);

        const result = getBlockingSet(a, state);
        expect(result).toBeTruthy();
        expect(result!.value).toBe(false);
        expect(result!.blockingSet).toEqual([[b, c], [d]]);
    })
})