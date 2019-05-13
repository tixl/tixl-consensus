export default class NodeIdentifier {
    name: string;
    pk: string; // public key
    constructor(name: string, pk: string) {
        this.name = name;
        this.pk = pk;
    }
}