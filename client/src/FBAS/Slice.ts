import NodeIdentifier from "./NodeIdentifier";

export default class Slices {
    slices: NodeIdentifier[][];
    constructor(slices: NodeIdentifier[][]) {
        this.slices = slices;
    }

    addSlice(slice: NodeIdentifier[]) {
        this.slices.push(slice);
    }
}