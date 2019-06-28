import { NodeIdentifier } from "../../common/NodeIdentifier";
import { InstanceState } from "../FBASInstance";

export const findBlockingValues = (node: NodeIdentifier, state: InstanceState) => {
    const nodeState = state.get(node);
    if (!nodeState || !nodeState.slices) return [];
    const slices = nodeState.slices.toArray();
    const states = slices.map(slice => slice.filter(n => n !== node).map(n => {
        const nState = state.get(n);
        if (!nState || nState.accept === null) return null;
        return nState.accept;
    }));

    return [true, false].filter(value => states.every(slice => slice.includes(value)));
}

// 
export const getBlockingSet = (node: NodeIdentifier, state: InstanceState) => {
    const blockingValues = findBlockingValues(node, state);
    if (blockingValues.length === 0) return null;
    if (blockingValues.length === 2) return null;
    const value = blockingValues[0];
    const nodeState = state.get(node);
    if (!nodeState || !nodeState.slices) return null;
    const slices = nodeState.slices.toArray();
    const blockingSet = slices.map(slice => slice.filter(n => n !== node).filter(n => {
        const nState = state.get(n);
        if (!nState) return false;
        if (nState.accept !== null) {
            if (nState.accept === value) return true;
            else return false;
        }
        else return false;
    }))
    return {
        value,
        blockingSet
    }
}