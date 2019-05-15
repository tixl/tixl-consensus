import 'jest';
import Slices from '../Slice';
import NodeIdentifier from '../NodeIdentifier';
import NodeState from '../NodeState';
import { findQuorum } from './findQuorum';

const NI = (label: string) => new NodeIdentifier(label, label);
const SL = (slices: NodeIdentifier[][]) =>
    new Slices(new Set(slices.map(slice => new Set(slice))));
const ST = (val: boolean, slices: Slices) => {
    const state = new NodeState(slices);
    state.setVote(val);
    return state;
}
describe('findQuorum', () => {
    test('should find a quorum when all nodes voted true', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(true, bSlice);
        const cState = ST(true, cSlice);
        const dState = ST(true, dSlice);
        const eState = ST(true, eSlice);

        const state = new Map();
        state.set(a.pk, aState);
        state.set(b.pk, bState);
        state.set(c.pk, cState);
        state.set(d.pk, dState);
        state.set(e.pk, eState);
        const result = findQuorum(a, state, true);

        const expected = new Set([a, b, c, d]);

        expect(result).toEqual(expected);

    })

    test('should find a quorum regardless when a node, that is included in nones slices is false', () => {
        const a = NI('a');
        const b = NI('b');
        const c = NI('c');
        const d = NI('d');
        const e = NI('e');

        const aSlice = SL([[b, c]]);
        const bSlice = SL([[d]]);
        const cSlice = SL([[b]]);
        const dSlice = SL([[]]);
        const eSlice = SL([[d]]);

        const aState = ST(true, aSlice);
        const bState = ST(true, bSlice);
        const cState = ST(true, cSlice);
        const dState = ST(true, dSlice);
        const eState = ST(false, eSlice);

        const state = new Map();
        state.set(a.pk, aState);
        state.set(b.pk, bState);
        state.set(c.pk, cState);
        state.set(d.pk, dState);
        state.set(e.pk, eState);
        const result = findQuorum(a, state, true);

        const expected = new Set([a, b, c, d]);

        expect(result).toEqual(expected);

    })
})