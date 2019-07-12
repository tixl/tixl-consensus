import 'jest';
import { ScpSlices } from './types';
import { quorumThreshold } from './validateSlices';

const SL = (threshold: number, ...nodes: string[]): ScpSlices => ({ validators: nodes, threshold })

describe('quorumThreshhold', () => {
    test('should find no quorum', () => {
        const nodeSlicesMap = new Map();
        nodeSlicesMap.set('A', SL(2, 'B', 'C', 'D'))
        nodeSlicesMap.set('B', SL(2, 'A', 'C', 'D'))
        nodeSlicesMap.set('C', SL(2, 'B', 'A', 'D'))
        nodeSlicesMap.set('D', SL(2, 'B', 'C', 'A'))
        const result = quorumThreshold(nodeSlicesMap, ['A', 'B'], 'A');
        expect(result).toBe(false);
    })

    test('should find a quorum for A', () => {
        const nodeSlicesMap = new Map();
        nodeSlicesMap.set('A', SL(2, 'B', 'C'))
        nodeSlicesMap.set('B', SL(2, 'C', 'D'))
        nodeSlicesMap.set('C', SL(2, 'B', 'D'))
        nodeSlicesMap.set('D', SL(2, 'B', 'C'))
        const result = quorumThreshold(nodeSlicesMap, ['A', 'B', 'C', 'D'], 'A');
        expect(result).toBe(true);
    })

    test('should not find a quorum for A without D', () => {
        const nodeSlicesMap = new Map();
        nodeSlicesMap.set('A', SL(2, 'B', 'C'))
        nodeSlicesMap.set('B', SL(2, 'C', 'D'))
        nodeSlicesMap.set('C', SL(2, 'B', 'D'))
        nodeSlicesMap.set('D', SL(2, 'B', 'C'))
        const result = quorumThreshold(nodeSlicesMap, ['A', 'B', 'C'], 'A');
        expect(result).toBe(false);
    })

    test('should find a quorum for B without A', () => {
        const nodeSlicesMap = new Map();
        nodeSlicesMap.set('A', SL(2, 'B', 'C'))
        nodeSlicesMap.set('B', SL(2, 'C', 'D'))
        nodeSlicesMap.set('C', SL(2, 'B', 'D'))
        nodeSlicesMap.set('D', SL(2, 'B', 'C'))
        const result = quorumThreshold(nodeSlicesMap, ['C', 'D', 'B'], 'B');
        expect(result).toBe(true);
    })

});