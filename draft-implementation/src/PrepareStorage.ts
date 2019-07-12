import { PublicKey } from "./types";

export type BallotHash = bigint;
export interface BallotState {
    voted: boolean;
    accepted: boolean;
}
type MessageType = 'vote' | 'accept';

export class PrepareStorage {
    voters: Map<BallotHash, Map<PublicKey, BallotState>>
    constructor() {
        this.voters = new Map();
    }

    set(hash: BallotHash, v: PublicKey, m: MessageType) {
        let ballotMap: Map<PublicKey, BallotState>;
        if (this.voters.has(hash)) ballotMap = this.voters.get(hash)!
        else ballotMap = new Map();

        let state: BallotState;
        if (ballotMap.has(v)) state = ballotMap.get(v)!;
        else state = { voted: false, accepted: false };
        switch (m) {
            case 'vote': state.voted = true; break;
            case 'accept': state.accepted = true; break;
        }
        ballotMap.set(v, state);
        this.voters.set(hash, ballotMap);
    }

    get(hash: BallotHash, ms: MessageType[]): PublicKey[] {
        if (this.voters.has(hash)) {
            const ballotMap = this.voters.get(hash)!;
            const nodes = [];
            for (const [node, value] of ballotMap) {
                if (ms.includes('vote') && value.voted === true) nodes.push(node);
                else if (ms.includes('accept') && value.accepted === true) nodes.push(node);
            }
            return nodes;
        }
        return [];
    }
}