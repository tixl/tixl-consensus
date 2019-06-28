import { NodeIdentifier } from "./NodeIdentifier";

export default class Slices {
    slices: Set<Set<NodeIdentifier>>;
    constructor(slices?: Set<Set<NodeIdentifier>>) {
        this.slices = slices || new Set(new Set());
    }

    addSlice(slice: Set<NodeIdentifier>) {
        this.slices.add(slice);
    }

    static fromSingleArray(slices: NodeIdentifier[]) {
        return this.fromArray([slices]);
    }

    static fromArray(slices: NodeIdentifier[][]) {
        return new Slices(new Set(slices.map(x => new Set(x))))
    }

    toArray() {
        return Array.from(this.slices).map(x => Array.from(x));
    }
}