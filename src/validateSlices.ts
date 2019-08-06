import { ScpSlices, PublicKey } from './types';

const arrayToMap = <T>(arr: T[]): Map<T, true> => arr.reduce((a, x) => a.set(x, true), new Map());

export const quorumThreshold = (
  nodeSlicesMap: Map<PublicKey, ScpSlices>,
  signers: PublicKey[],
  thisNode: PublicKey,
) => {
  const thisSlices = nodeSlicesMap.get(thisNode);
  if (!thisSlices) throw new Error('No slices for this node supplied ' + thisNode);
  const signerMap = arrayToMap(signers);
  if (!slicesThreshold(thisSlices, signerMap)) return false;
  const convincedNodes = [];
  for (const [node, slices] of nodeSlicesMap) {
    if (slicesThreshold(slices, signerMap)) convincedNodes.push(node);
  }
  const convincedNodesMap = arrayToMap(convincedNodes);
  return slicesThreshold(thisSlices, convincedNodesMap);
};

// stateMap is either a map of all nodes that have signed, or then a map of all nodes that are convinced
export const slicesThreshold = (slices: ScpSlices, stateMap: Map<PublicKey, true>): boolean => {
  const signedValidators = slices.validators.filter(x => stateMap.has(x));
  if (slices.innerSets) {
    const signedInnerSets = slices.innerSets.filter(x => slicesThreshold(x, stateMap));
    return signedValidators.length + signedInnerSets.length >= slices.threshold;
  } else {
    return signedValidators.length >= slices.threshold;
  }
};

export const blockingThreshold = (slices: ScpSlices, signers: PublicKey[]): boolean => {
  const stateMap = arrayToMap(signers);
  const signedValidators = slices.validators.filter(x => stateMap.has(x));
  if (slices.innerSets) {
    const n = slices.validators.length + slices.innerSets.length;
    const signedInnerSets = slices.innerSets.filter(x => slicesThreshold(x, stateMap));
    return signedValidators.length + signedInnerSets.length > n - slices.threshold;
  } else {
    const n = slices.validators.length;
    return signedValidators.length > n - slices.threshold;
  }
};
