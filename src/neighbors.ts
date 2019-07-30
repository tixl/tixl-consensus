
import { toBigIntBE } from 'bigint-buffer';
import * as crypto from 'crypto';
import { PublicKey, ScpSlices } from './types';
import { flatten } from 'lodash';

export const sha256 = (input: BigInt | string | number): bigint => toBigIntBE(crypto.createHash('sha256').update(String(input), 'utf8').digest());
const hmax = 2n ** 256n;
const G = (i: bigint) => (m: bigint) => sha256(BigInt(i + '' + m));


const weight = (v: PublicKey, slices: ScpSlices) => {
    const [num, denom] = nodeFrac(v, slices);
    return num / denom;
}

// n: round
export const getNeighbors = (slot: number, n: number, slices: ScpSlices) => {
    return allNodesInSlices(slices).filter(v => {
        const w = BigInt(Math.round(weight(v, slices) * 1000));
        const h = G(BigInt(slot))(BigInt(1 + '' + sha256(n) + '' + sha256(v)));
        return h < (hmax * w / 1000n)
    })
}

// n: round
export const getPriority = (slot: number, n: number, v: PublicKey) => {
    return G(BigInt(slot))(BigInt(2 + '' + sha256(n) + '' + sha256(v)))
}


const len = (slices: ScpSlices) => {
    return slices.validators.length + ((slices.innerSets) ? slices.innerSets.length : 0)
}

const nodeFrac = (v: PublicKey, slices: ScpSlices): [number, number] => {
    for (const validator of slices.validators) {
        if (validator === v) return [slices.threshold, len(slices)];
    }
    if (slices.innerSets) {
        for (const innerSet of slices.innerSets) {
            const [num, denom] = nodeFrac(v, innerSet);
            if (num > 0) return [slices.threshold * num, len(innerSet) * denom]
        }
    }
    return [0, 1];
}

const allNodesInSlices = (slices: ScpSlices): PublicKey[] => {
    const nested = slices.innerSets ? flatten(slices.innerSets.map(allNodesInSlices)) : []
    return [...slices.validators, ...nested];
}

// export const amountSlices = (slices: ScpSlices): number => {
//     const k = slices.threshold
//     if (slices.innerSets) {
//         const n = slices.validators.length + slices.innerSets.length;
//         const nk = nChooseK(n, k);
//         if (!slices.innerSets.length) return nk;
//         const c = nk * k / n; // Amount of tuples every element appears in  
//         return slices.innerSets.reduce((acc, set) => acc + c * (amountSlices(set) - 1), nk)
//     }
//     else {
//         const n = slices.validators.length;
//         return nChooseK(n, k);
//     }
// }
