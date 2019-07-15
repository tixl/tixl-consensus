import { PublicKey, ScpCommit } from "./types";

export class CommitStorage {
    data: Map<PublicKey, ScpCommit>
    latestTimestamps: Map<PublicKey, number>
    constructor() {
        this.data = new Map();
        this.latestTimestamps = new Map();
    }

    set(node: PublicKey, commit: ScpCommit, timestamp: number) {
        if ((this.latestTimestamps.has(node) && this.latestTimestamps.get(node)! < timestamp) || !this.latestTimestamps.has(node)) {
            this.data.set(node, commit);
            this.latestTimestamps.set(node, timestamp);
        }
    }

    getAllCommitsAsArray() {
        const values = [];
        for (const [node, value] of this.data) {
            values.push({ ...value, node })
        }
        return values;
    }

}