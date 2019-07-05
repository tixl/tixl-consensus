import uuid from "uuid/v4";
import Network from "../common/Network";
import { Message, MessageReturnType } from "../common/messages/Message";
import { FBASInstance, FBASEvents, VotingType } from '../FBAS/FBASInstance';
import { EventEmitter } from 'events';
import { NominateMessageReturnType, NominatePayload } from "../common/messages/NominateMessage";
import { TransactionReturnType } from "./Transaction";
import { selectLeader } from "./selectLeader";
import crypto from 'crypto';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export interface Ballot {
    n: number;
    x: TransactionReturnType[]
};

export interface PreparePayload {
    ballot: Ballot;
}

export interface CommitPayload {
    ballot: Ballot;
}

const hashBallot = (ballot: Ballot): string => crypto.createHash('sha256').update(JSON.stringify(ballot)).digest('hex');

export interface BallotState {
    ballot: Ballot,
    votedPrepare: boolean,
    confirmedPrepare: boolean,
    votedCommit: boolean,
    confirmedCommit: boolean;
}
export default class SCPInstance {
    nodeId: string;
    scpId: string;
    slotId: number;
    quorumSlices: string[][];
    suggestedTransactions: TransactionReturnType[] | null; // not yet voted for
    confirmedNominations: TransactionReturnType[][];
    leaders: string[];
    ballotNumber: number;
    leaderSelectionRound: number;
    network: Network;
    hasNominatedOwnValues: boolean;
    eventEmitter: EventEmitter;
    fbasMap: Map<string, FBASInstance>;
    ballots: Ballot[];
    ballotStateMap: Map<string, BallotState>

    constructor(nodeId: string, slotId: number, slices: string[][], network: Network) {
        this.nodeId = nodeId;
        this.quorumSlices = slices;
        this.leaders = []
        this.suggestedTransactions = null;
        this.confirmedNominations = [];
        this.slotId = slotId;
        this.ballotNumber = 0;
        this.leaderSelectionRound = 0;
        this.scpId = uuid() // How to get the same id in a distributed way?
        this.network = network;
        this.hasNominatedOwnValues = false;
        this.eventEmitter = new EventEmitter();
        this.fbasMap = new Map();
        this.ballots = [];
        this.ballotStateMap = new Map();
    }

    setSuggestedTransactions(transactions: TransactionReturnType[]) {
        this.suggestedTransactions = transactions;
    }

    receiveMessage(msg: MessageReturnType) {
        let fbas;
        if (this.fbasMap.has(msg.votingId)) fbas = this.fbasMap.get(msg.votingId)!;
        else {
            fbas = new FBASInstance(msg.votingId, this.nodeId, this.quorumSlices, this.network, this.slotId, msg.votingType, msg.payload)
            this.fbasMap.set(msg.votingId, fbas);
            switch (msg.votingType) {
                case VotingType.NOMINATE: this.receiveNominateMessage(msg, fbas); break;
                case VotingType.PREPARE: this.receiveNominateMessage(msg, fbas); break;
                case VotingType.COMMIT: this.receiveNominateMessage(msg, fbas); break;
            }
        }
        fbas.receiveMessage(msg);

    }

    receiveNominateMessage(msg: Overwrite<MessageReturnType, { payload: NominatePayload }>, fbas: FBASInstance) {
        // TODO: should I only vote if message from leader?
        if (this.confirmedNominations.length === 0) {
            // TODO: Validate transactions
            fbas.castVote(true);
        }
        fbas.subscribeConfirm(this.onNominateConfirm(fbas))
    }

    receivePrepareMessage(msg: Overwrite<MessageReturnType, { payload: PreparePayload }>, fbas: FBASInstance) {
        // Can I vote for Ballots, of that I didn't confirm the value?
        const { ballot } = msg.payload;
        const hash = hashBallot(ballot);
        let ballotState: BallotState;
        if (this.ballotStateMap.has(hash)) ballotState = this.ballotStateMap.get(hash)!
        else {
            ballotState = {
                ballot,
                votedPrepare: false,
                confirmedPrepare: false,
                votedCommit: false,
                confirmedCommit: false,
            }
            this.ballotStateMap.set(hash, ballotState)
        }
        // if transactions valid
        // if not conflicting with commits
        fbas.castVote(true);
        this.onStateUpdated();
    }

    receiveCommitMessage(msg: Overwrite<MessageReturnType, { payload: CommitPayload }>, fbas: FBASInstance) {
        this.onStateUpdated();
    }

    onStateUpdated() {

    }

    run() {
        this.addNewLeader();
        this.nominate();
        setTimeout(() => {
            if (this.confirmedNominations.length === 0) {
                this.leaderSelectionRound++;
                this.run();
            }
        }, (this.leaderSelectionRound + 1) * 500)
    }

    startBalloting() {
        // start balloting

    }

    onNominateConfirm(fbas: FBASInstance) {
        return ({ value }: { value: boolean }) => {
            if (value !== true) return;
            const transactions = (fbas.messagePayload as NominatePayload).transactions
            const confirmedNominationsLength = this.confirmedNominations.length;
            this.confirmedNominations.push(transactions);
            console.log('Nomination confirmed for ', fbas.votingId)
            if (confirmedNominationsLength === 0) this.startBalloting();
            this.onStateUpdated();
        }
    }

    nominate() {
        if (this.hasNominatedOwnValues) {
            console.log('already nominated values');
            return;
        }
        if (this.leaders.includes(this.nodeId)) {
            if (this.suggestedTransactions === null) { console.log('no transactions'); return; }
            const payload: NominatePayload = { transactions: this.suggestedTransactions };
            const fbas = new FBASInstance(uuid(), this.nodeId, this.quorumSlices, this.network, this.slotId, VotingType.NOMINATE, payload);
            fbas.castVote(true);
            this.fbasMap.set(fbas.votingId, fbas);
            this.hasNominatedOwnValues = true;
            fbas.subscribeConfirm(this.onNominateConfirm(fbas))
        } else {
            console.log('Do not nominate anything, because not a leader')
        }
    }


    addNewLeader() {
        const newLeader = selectLeader(this.leaderSelectionRound, this.slotId, this.ballotNumber, this.quorumSlices);
        this.leaderSelectionRound++;
        if (!this.leaders.includes(newLeader)) {
            this.leaders.push(newLeader);
        }
        console.log('New leader added ', newLeader)
    }

}