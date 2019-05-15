import 'jest';
import NodeIdentifier from '../NodeIdentifier';
import { setDifference } from './setDifference';

describe('setDifference', () => {
    test('should return difference', () => {
        const a = new NodeIdentifier("a", "a");
        const b = new NodeIdentifier("b", "b");
        const c = new NodeIdentifier("c", "c");
        const sliceA = new Set([a, b, c]);
        const sliceB = new Set([a, b]);

        const result = setDifference(sliceA, sliceB);

        const expected = new Set([c]);

        expect(result).toEqual(expected);
    })
})