import 'jest';
import Slices from '../Slice';
import NodeIdentifier from '../NodeIdentifier';
import { removeSupersetSlices } from './removeSupersetSlices';

describe('removeSupersetSlices', () => {
    test('should remove superset slice', () => {
        const a = new NodeIdentifier("a", "a");
        const b = new NodeIdentifier("b", "b");
        const c = new NodeIdentifier("c", "c");
        const sliceA = new Set([a, b]);
        const sliceB = new Set([a, b, c]);
        const slices = new Set([sliceA, sliceB]);
        const slicesObj = new Slices(slices);

        const result = removeSupersetSlices(slicesObj);

        const expected = new Slices(new Set([sliceA]));

        expect(result.slices).toEqual(expected.slices);

    })
})