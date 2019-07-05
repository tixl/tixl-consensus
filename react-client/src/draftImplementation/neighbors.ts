
import { toBigIntBE } from 'bigint-buffer';
import crypto from 'crypto';
import { PublicKey, ScpSlices } from './types';
import { nChooseK } from './helpers';
import Slices from '../algo/common/Slices';
import { flatten } from 'lodash';

const sha256 = (input: string): bigint => toBigIntBE(crypto.createHash('sha256').update(input, 'utf8').digest());
const hmax = BigInt(2) ** BigInt(256);
const G = (i: bigint) => (m: bigint) => BigInt(i + '' + m);
const G1 = G(BigInt(1));
const G2 = G(BigInt(2));

const weight = (v: PublicKey, slices: ScpSlices) => {
    const [num, denom] = nodeFrac(v, slices);
    return num / denom;
}

export const neighbors = (n: PublicKey, slices: ScpSlices) => {
    return allNodesInSlices(slices).filter(v => {
        const w = BigInt(weight(v, slices) * 1000);
        const h = G1(BigInt(n + '' + v));
        return h < (hmax * w / BigInt(1000))
    })
}

export const priority = (n: PublicKey, v: PublicKey) => {
    return G2(BigInt(n + '' + v))
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
            if (num > 0) return [slices.threshold * num, len(innerSet)]
        }
    }
    return [0, 1];
}

const allNodesInSlices = (slices: ScpSlices): PublicKey[] => {
    const nested = slices.innerSets ? flatten(slices.innerSets.map(allNodesInSlices)) : []
    return [...slices.validators, ...nested];
}

export const amountSlices = (slices: ScpSlices): number => {
    const k = slices.threshold
    if (slices.innerSets) {
        const n = slices.validators.length + slices.innerSets.length;
        const nk = nChooseK(n, k);
        if (!slices.innerSets.length) return nk;
        const c = nk * k / n; // Amount of tuples every element appears in  
        return slices.innerSets.reduce((acc, set) => acc + c * (amountSlices(set) - 1), nk)
    }
    else {
        const n = slices.validators.length;
        return nChooseK(n, k);
    }
}
