import NodeIdentifier from "./NodeIdentifier";

export default class Quorum {
    nodes: NodeIdentifier[];
    constructor(nodes: NodeIdentifier[]) {
        this.nodes = nodes;
    }
}