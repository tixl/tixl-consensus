import 'jest';
import { ScpSlices } from './types';
import { amountSlices } from './neighbors';

const A = 'A';
const B = 'B';
const C = 'C';
const D = 'D';
const E = 'E';
const F = 'F';
const G = 'G';
const H = 'H';
const J = 'J';

const type = 'ScpSlices';

describe('amountSlices', () => {
    test('#1', () => {
        const slices: ScpSlices = {
            validators: [A, B, C, D],
            threshold: 3,
            type,
            innerSets: [],
        }

        const result = amountSlices(slices);
        expect(result).toEqual(4);
    })

    test('#2', () => {
        const slices: ScpSlices = {
            validators: [A, B, C],
            threshold: 3,
            type,
            innerSets: [{ type: 'ScpSlices1', threshold: 2, innerSets: [], validators: [D, E, F] }],
        }

        const result = amountSlices(slices);
        expect(result).toEqual(10);
    })

    test('#3', () => {
        const slices: ScpSlices = {
            validators: [A, B, C],
            threshold: 3,
            type,
            innerSets: [{
                type: 'ScpSlices1',
                threshold: 3,
                validators: [D, E, F],
                innerSets: [{ type: 'ScpSlices2', threshold: 2, validators: [G, H, J] }],
            },
            ],
        }

        const result = amountSlices(slices);
        expect(result).toEqual(31);
    })
})