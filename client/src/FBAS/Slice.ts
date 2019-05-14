import NodeIdentifier from "./NodeIdentifier";

export default class Slices {
    slices: Set<Set<NodeIdentifier>>;
    constructor(slices: Set<Set<NodeIdentifier>>) {
        this.slices = slices;
    }

    addSlice(slice: Set<NodeIdentifier>) {
        this.slices.add(slice);
    }
}