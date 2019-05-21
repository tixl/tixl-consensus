import { InstanceState } from "../FBASInstance";
import { NodeIdentifier } from "../NodeIdentifier";
import { setDifference } from "./setDifference";
import { isSuperset } from "./isSuperset";
import Quorum from "../Quorum";

export enum Phase {
    ACCEPT = "ACCEPT",
    CONFIRM = "CONFIRM"
};

export const findQuorum = (node: NodeIdentifier, state: InstanceState, value: boolean, phase: Phase): Quorum | null => {

    const nodeAgrees = (node: NodeIdentifier) => {
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

    const nodesAgree = (nodes: Set<NodeIdentifier>) => {
        for (let node of nodes) {
            if (!nodeAgrees(node)) return false;
        }
        return true;
    }

    const getNodeSlices = (node: NodeIdentifier) => {
        const nodeState = state.get(node);
        if (nodeState && nodeState.slices) {
            return nodeState.slices.slices;
        }
        return null;
    }

    const setIncludesOneSlice = (nodes: Set<NodeIdentifier>, slices: Set<Set<NodeIdentifier>>): boolean => {
        for (let slice of slices) {
            if (isSuperset(nodes, slice)) return true;
        }
        return false;
    }

    const isQuorum = (nodes: Set<NodeIdentifier>): boolean => {
        for (let node of nodes) {
            let slices = getNodeSlices(node);
            if (slices && slices.size) {
                if (!setIncludesOneSlice(nodes, slices)) return false;
            }
        }
        return true;
    };

    const findQuorumForNodes = (nodes: Set<NodeIdentifier>): Quorum | null => {
        // Is not a quorum on the value we are looking for
        if (!nodesAgree(nodes)) return null;
        // Is a quorum
        if (isQuorum(nodes)) return new Quorum(nodes);
        // Not enough nodes for a quorum, add more to transitive hull
        for (let node of nodes) {
            let slices = getNodeSlices(node);
            if (slices) {
                for (let slice of slices) {
                    let diff = setDifference(slice, nodes)
                    if (diff.size) {
                        let quorumResult = findQuorumForNodes(new Set([...nodes, ...diff]))
                        if (quorumResult !== null) return quorumResult;
                    }
                }
            }
        }
        return null;
    }

    return findQuorumForNodes(new Set([node]));
}