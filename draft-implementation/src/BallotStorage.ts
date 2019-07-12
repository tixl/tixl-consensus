import { ScpBallot, PublicKey } from './types';
import { hash } from './helpers';

interface ScpBallotWithHash extends ScpBallot {
    hash: BallotHash;
}

export type BallotHash = bigint;
export interface BallotState {
    voted: boolean;
    accepted: boolean;
}
type MessageType = 'vote' | 'accept';

export default class BallotStorage {
    ballotList: ScpBallotWithHash[]
    hashes: Map<bigint, ScpBallotWithHash>
    signers: Map<BallotHash, Map<PublicKey, BallotState>>
    abortCounters: Array<{ node: PublicKey, counter: number }>;

    constructor() {
        this.ballotList = [];
        this.hashes = new Map();
        this.signers = new Map();
        this.abortCounters = [] // Stores aCounters of other nodes
    }

    setAbortCounter(node: PublicKey, counter: number) {
        const existing = this.abortCounters.find(x => x.node === node)
        if (existing) {
            existing.counter = Math.max(existing.counter, counter);
        }
        else this.abortCounters.push({ node, counter });
    }

    getAbortCounter(node: PublicKey) {
        return this.abortCounters.find(x => x.node === node);
    }

    getAllNodesWithAbortCounterHigherOrEqualThanALowerThanB(a: number, b: number) {
        return this.abortCounters.filter(x => x.counter >= a && x.counter < b);
    }

    setSigner(hash: BallotHash, v: PublicKey, m: MessageType) {
        let ballotMap: Map<PublicKey, BallotState>;
        if (this.signers.has(hash)) ballotMap = this.signers.get(hash)!
        else ballotMap = new Map();

        let state: BallotState;
        if (ballotMap.has(v)) state = ballotMap.get(v)!;
        else state = { voted: false, accepted: false };
        switch (m) {
            case 'vote': state.voted = true; break;
            case 'accept': state.accepted = true; break;
        }
        ballotMap.set(v, state);
        this.signers.set(hash, ballotMap);
    }

    getSigners(hash: BallotHash, ms: MessageType[]): PublicKey[] {
        if (this.signers.has(hash)) {
            const ballotMap = this.signers.get(hash)!;
            const nodes = [];
            for (const [node, value] of ballotMap) {
                if (ms.includes('vote') && value.voted === true) nodes.push(node);
                else if (ms.includes('accept') && value.accepted === true) nodes.push(node);
            }
            return nodes;
        }
        return [];
    }

    add(b: ScpBallot): BallotHash {
        const h = hash(b);
        this.hashes.set(h, { ...b, hash: h })
        const idx = this.ballotList.findIndex(x => x.hash === h);
        if (!idx) {
            this.ballotList.push({ ...b, hash: h })
        }
        return h;
    }

    getBallotFromHash(h: BallotHash) {
        return this.hashes.get(h);
    }

    getWithCountersEqualOrAbove(counter: number) {
        return this.ballotList.filter(b => b.counter >= counter) || [];
    }

    getWithCountersAbove(counter: number) {
        return this.ballotList.filter(b => b.counter > counter) || [];
    }

    getLowestCounterAbove(counter: number) {
        return Math.min(...this.getWithCountersAbove(counter).map(x => x.counter));
    }

    getAllVotersForBallotsWithCounterEqualOrAbove(counter: number) {
        const ballotsWithHigherOrEqualCounter = this.getWithCountersEqualOrAbove(counter);
        const voters = ballotsWithHigherOrEqualCounter.reduce((acc: string[], ballot) => {
            const votersForThisBallot = this.getSigners(ballot.hash, ['vote']);
            votersForThisBallot.forEach(voter => !votersForThisBallot.includes(voter) && acc.push(voter))
            return acc;
        }, [])
        return voters;
    }

    getAllVotersForBallotsWithCounterAbove(counter: number) {
        const ballotsWithHigherOrEqualCounter = this.getWithCountersAbove(counter);
        const voters = ballotsWithHigherOrEqualCounter.reduce((acc: string[], ballot) => {
            const votersForThisBallot = this.getSigners(ballot.hash, ['vote']);
            votersForThisBallot.forEach(voter => !votersForThisBallot.includes(voter) && acc.push(voter))
            return acc;
        }, [])
        return voters;
    }



}