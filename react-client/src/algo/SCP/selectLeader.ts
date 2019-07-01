
import { toBigIntBE } from 'bigint-buffer';
import crypto from 'crypto';

const sha256 = (input: string): bigint => toBigIntBE(crypto.createHash('sha256').update(input, 'utf8'));
const hmax = BigInt(2) ** BigInt(256);



export const getNodeSliceCount = (slices: string[][]) => {
    const nodeSliceCount: Map<string, number> = new Map();
    slices.forEach(slice => slice.forEach(node => {
        if (nodeSliceCount.has(node)) nodeSliceCount.set(node, nodeSliceCount.get(node)! + 1)
        else nodeSliceCount.set(node, 1);
    }))
    return nodeSliceCount;
}

export const selectLeader = (round: number, slotId: number, ballotNumber: number, slices: string[][]) => {
    const isTimeout = false;
    const hX = (i: number) => (m: string) => sha256([String(i), String(slotId), String(isTimeout ? ballotNumber : 0), String(round), m].join(''))
    const h0 = hX(0);
    const h1 = hX(1);
    const nodeSliceCount = getNodeSliceCount(slices);
    const amountSlices = slices.length;
    const nodes = [...nodeSliceCount.keys()];
    const neighbors = nodes.filter(node => {
        const weightX1000 = BigInt(nodeSliceCount.get(node)! / amountSlices * 1000);
        const weightedMax = hmax / BigInt(1000) * weightX1000
        return (h0(node) < weightedMax);
    });
    if (neighbors.length) {
        let highestPrio: bigint = BigInt(0);
        let leader = neighbors[0]
        neighbors.forEach(node => {
            const prio = h1(node);
            if (prio > highestPrio) {
                highestPrio = prio;
                leader = node;
            }
        })
        return leader;
    }
    else {
        let lowestValue = hmax;
        let selectedNode = nodes[0];
        nodes.forEach(node => {
            const weightX1000 = BigInt(nodeSliceCount.get(node)! / amountSlices * 1000);
            const value = h0(node) / weightX1000 / BigInt(1000);
            if (value < lowestValue) {
                lowestValue = value;
                selectedNode = node;
            }
        })
        return selectedNode;
    }
}