import { NodeIdentifier } from "./NodeIdentifier";

export default class Quorum {
    nodes: Set<NodeIdentifier>;
    constructor(nodes: Set<NodeIdentifier>) {
        this.nodes = nodes;
    }

    print() {
        for (let node of this.nodes) {
            console.log(node);
        }
    }
}