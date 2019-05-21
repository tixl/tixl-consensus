import 'jest';
import Slices from '../Slice';
import { removeSupersetSlices } from './removeSupersetSlices';

describe('removeSupersetSlices', () => {
    test('should remove superset slice', () => {
        const a = "a";
        const b = "b";
        const c = "c";
        const sliceA = new Set([a, b]);
        const sliceB = new Set([a, b, c]);
        const slices = new Set([sliceA, sliceB]);
        const slicesObj = new Slices(slices);

        const result = removeSupersetSlices(slicesObj);

        const expected = new Slices(new Set([sliceA]));

        expect(result.slices).toEqual(expected.slices);

    })
})