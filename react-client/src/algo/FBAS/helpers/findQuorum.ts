import { InstanceState } from "../FBASInstance";

export enum Phase {
    ACCEPT = "ACCEPT",
    CONFIRM = "CONFIRM"
};

// A - B
const arrayDifference = <T>(a: Array<T>, b: Array<T>) => a.filter(x => !b.includes(x));

const isSupersetArray = <T>(a: Array<T>, b: Array<T>) => b.every(x => a.includes(x));

export const findQuorum = (node: string, state: InstanceState, value: boolean, phase: Phase): string[] | null => {

    const nodeAgrees = (node: string) => {
        const nodeState = state.get(node);
        if (phase === Phase.ACCEPT) {
            if (nodeState && (nodeState.vote !== null || nodeState.accept !== null)) {
                let nodeValue = (nodeState.accept !== null) ? nodeState.accept : nodeState.vote;
                if (nodeValue === value) return true;
            }
            return false;
        }
        // phase === confirm
        else {
            if (nodeState && nodeState.accept !== null) {
                let nodeValue = nodeState.accept;
                if (nodeValue === value) return true;
            }
            return false;
        }
    }

    const nodesAgree = (nodes: string[]) => {
        return nodes.every(node => nodeAgrees(node));
    }

    const getNodeSlices = (node: string) => {
        const nodeState = state.get(node);
        if (nodeState && nodeState.slices) {
            return nodeState.slices;
        }
        return null;
    }

    const nodesIncludeOneSlice = (nodes: string[], slices: string[][]): boolean =>
        slices.some(slice => isSupersetArray(nodes, slice));

    const isQuorum = (nodes: string[]): boolean => nodes.every(node => {
        let slices = getNodeSlices(node);
        return slices && slices.length && nodesIncludeOneSlice(nodes, slices)
    })

    const findQuorumForNodes = (nodes: string[]): string[] | null => {
        // Is not a quorum on the value we are looking for
        if (!nodesAgree(nodes)) return null;
        // Is a quorum
        if (isQuorum(nodes)) return nodes;
        // Not enough nodes for a quorum, add more to transitive hull
        for (let node of nodes) {
            let slices = getNodeSlices(node);
            if (slices) {
                for (let slice of slices) {
                    let diff = arrayDifference(slice, nodes)
                    if (diff.length) {
                        let quorumResult = findQuorumForNodes([...nodes, ...diff])
                        if (quorumResult !== null) return quorumResult;
                    }
                }
            }
        }
        return null;
    }

    return findQuorumForNodes([node]);
}