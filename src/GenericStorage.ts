import { PublicKey } from "./types";

export class GenericStorage<T> {
    data: Map<PublicKey, T>
    latestTimestamps: Map<PublicKey, number>
    constructor() {
        this.data = new Map();
        this.latestTimestamps = new Map();
    }

    set(node: PublicKey, value: T, timestamp: number) {
        if ((this.latestTimestamps.has(node) && this.latestTimestamps.get(node)! < timestamp) || !this.latestTimestamps.has(node)) {
            this.data.set(node, value);
            this.latestTimestamps.set(node, timestamp);
        }
    }

    getAllValuesAsArary() {
        const values = [];
        for (const [node, value] of this.data) {
            values.push({ ...value, node })
        }
        return values;
    }

    getValueFromNode(node: PublicKey) {
        return this.data.get(node) || null;
    }

}