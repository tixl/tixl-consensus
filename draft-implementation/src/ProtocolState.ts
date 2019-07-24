import { PublicKey, ScpSlices, ScpPrepare, ScpCommit, ScpExternalize, ScpBallot, ScpNominate, Value } from "./types";
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { GenericStorage } from './GenericStorage';
import { isBallotLower, hashBallot } from "./helpers";
import { ProtocolOptions } from "./protocol";

export type ProtocolPhase = 'NOMINATE' | 'PREPARE' | 'COMMIT' | 'EXTERNALIZE';


export default class ProtocolState {
    phase: ProtocolPhase;
    nominationTimeout: NodeJS.Timeout | null;
    prepareTimeout: NodeJS.Timeout | null;
    prepareTimeoutCounter: number;
    nominationRound: number;
    priorityNodes: PublicKey[];
    TNMS: TransactionNodeMessageStorage;
    nodeSliceMap: Map<PublicKey, ScpSlices>;
    nominateStorage: GenericStorage<ScpNominate>;
    prepareStorage: GenericStorage<ScpPrepare>;
    commitStorage: GenericStorage<ScpCommit>;
    externalizeStorage: GenericStorage<ScpExternalize>;
    acceptedPrepared: ScpBallot[];
    confirmedPrepared: ScpBallot[];
    acceptedCommitted: ScpBallot[];
    confirmedCommitted: ScpBallot[];
    commitBallot: ScpBallot | null;
    confirmedValues: Value[];
    nominate: ScpNominate;
    prepare: ScpPrepare;
    commit: ScpCommit;
    externalize: ScpExternalize;
    options: ProtocolOptions;

    constructor(options: ProtocolOptions) {
        this.options = options;
        this.phase = 'NOMINATE';
        this.nominationTimeout = null;
        this.prepareTimeout = null;
        this.prepareTimeoutCounter = 0;
        this.nominationRound = 1;
        this.priorityNodes = [];
        this.TNMS = new TransactionNodeMessageStorage();
        this.nodeSliceMap = new Map();
        this.nodeSliceMap.set(options.self, options.slices);
        this.nominateStorage = new GenericStorage<ScpNominate>();
        this.prepareStorage = new GenericStorage<ScpPrepare>();
        this.commitStorage = new GenericStorage<ScpCommit>();
        this.externalizeStorage = new GenericStorage<ScpExternalize>();
        this.acceptedPrepared = [];
        this.confirmedPrepared = [];
        this.acceptedCommitted = [];
        this.confirmedCommitted = [];
        this.commitBallot = null;
        this.confirmedValues = [];
        this.nominate = {
            voted: [],
            accepted: [],
        }
        this.prepare = {
            ballot: { counter: 1, value: [] },
            prepared: null,
            aCounter: 0,
            hCounter: 0,
            cCounter: 0
        }
        this.commit = {
            ballot: { counter: 1, value: [] },
            preparedCounter: 0,
            hCounter: 0,
            cCounter: 0,
        }
        this.externalize = {
            commit: { counter: 1, value: [] },
            hCounter: 0,
        }
    }

    log(...args: any[]) {
        this.options.enableLog && console.log(this.options.self + ': ', ...args);
    }

    getHighestConfirmedPreparedBallot() {
        if (this.confirmedPrepared.length) {
            const highestConfirmed = this.confirmedPrepared.reduce((acc, b) => {
                if (isBallotLower(acc, b)) acc = b;
                return acc;
            })
            return highestConfirmed;
        }
        return null;
    }

    getHighestAcceptedPreparedBallot() {
        if (this.acceptedPrepared.length) {
            const highestAccepted = this.acceptedPrepared.reduce((acc, b) => {
                if (isBallotLower(acc, b)) acc = b;
                return acc;
            })
            return highestAccepted;
        }
        return null;
    }

    addAcceptedPrepared(b: ScpBallot) {
        const h = hashBallot(b);
        if (this.acceptedPrepared.map(hashBallot).indexOf(h) < 0) {
            this.acceptedPrepared.push(b)
            return true;
        }
        return false;
    }
}