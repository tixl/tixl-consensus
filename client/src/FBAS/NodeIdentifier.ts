export type NodePK = string;
export type NodeName = string;

export default class NodeIdentifier {
    name: NodeName;
    pk: NodePK; // public key
    constructor(name: NodeName, pk: NodePK) {
        this.name = name;
        this.pk = pk;
    }
}