import { PublicKey, ScpPrepare } from "./types";

export type BallotHash = bigint;
export class PrepareStorage {
    data: Map<PublicKey, ScpPrepare>
    latestTimestamps: Map<PublicKey, number>
    constructor() {
        this.data = new Map();
        this.latestTimestamps = new Map();
    }

    set(node: PublicKey, prepare: ScpPrepare, timestamp: number) {
        if ((this.latestTimestamps.has(node) && this.latestTimestamps.get(node)! < timestamp) || !this.latestTimestamps.has(node)) {
            this.data.set(node, prepare);
            this.latestTimestamps.set(node, timestamp);
        }
    }

    getAllPreparesAsArray() {
        const values = [];
        for (const [node, value] of this.data) {
            values.push({ ...value, node })
        }
        return values;
    }

}