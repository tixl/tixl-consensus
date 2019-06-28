import 'jest';
import { setDifference } from './setDifference';

describe('setDifference', () => {
    test('should return difference', () => {
        const a = "a";
        const b = "b";
        const c = "c";
        const sliceA = new Set([a, b, c]);
        const sliceB = new Set([a, b]);

        const result = setDifference(sliceA, sliceB);

        const expected = new Set([c]);

        expect(result).toEqual(expected);
    })
})