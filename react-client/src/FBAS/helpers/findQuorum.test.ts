import 'jest';
import Slices from '../Slice';
import { NodeIdentifier } from '../NodeIdentifier';
import NodeState from '../NodeState';
import { findQuorum, Phase } from './findQuorum';

const NI = (label: string) => label;
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
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = findQuorum(a, state, true, Phase.ACCEPT);

        const expected = new Set([a, b, c, d]);

        expect(result!.nodes).toEqual(expected);

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
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = findQuorum(a, state, true, Phase.ACCEPT);

        const expected = new Set([a, b, c, d]);

        expect(result!.nodes).toEqual(expected);

    })


    test('should not find a quorum when depended node diagrees', () => {
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
        const dState = ST(false, dSlice);
        const eState = ST(false, eSlice);

        const state = new Map();
        state.set(a, aState);
        state.set(b, bState);
        state.set(c, cState);
        state.set(d, dState);
        state.set(e, eState);
        const result = findQuorum(a, state, true, Phase.ACCEPT);

        const expected = null;

        expect(result).toEqual(expected);

    })
})