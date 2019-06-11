import { NodeIdentifier } from "../NodeIdentifier";
import { InstanceState } from "../FBASInstance";

export const findBlockingValues = (node: NodeIdentifier, state: InstanceState) => {
    const nodeState = state.get(node);
    if (!nodeState || !nodeState.slices) return [];
    const slices = nodeState.slices.toArray();
    const states = slices.map(slice => slice.filter(n => n !== node).map(n => {
        const nState = state.get(n);
        if (!nState || (nState.vote === null && nState.accept === null)) return null;
        return (nState.accept !== null) ? nState.accept : nState.vote;
    }));

    return [true, false].filter(value => states.every(slice => slice.includes(value)));
}