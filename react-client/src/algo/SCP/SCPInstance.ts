import uuid from "uuid/v4";
import Network from "../common/Network";
import { Message, MessageReturnType } from "../common/messages/Message";
import { FBASInstance, FBASEvents, VotingType } from '../FBAS/FBASInstance';
import { EventEmitter } from 'events';
import { NominateMessageReturnType, NominatePayload } from "../common/messages/NominateMessage";
import { Transaction, TransactionReturnType } from "./Transaction";
import { selectLeader } from "./selectLeader";

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
    }

    setSuggestedTransactions(transactions: TransactionReturnType[]) {
        this.suggestedTransactions = transactions;
    }

    receiveMessage(msg: MessageReturnType) {
        let fbas;
        if (this.fbasMap.has(msg.votingId)) fbas = this.fbasMap.get(msg.votingId)!;
        else {
            fbas = new FBASInstance(msg.votingId, this.nodeId, this.quorumSlices, this.network, this.slotId, msg.votingType)
            this.fbasMap.set(msg.votingId, fbas);
            // TODO set subscribers
        }
        fbas.receiveMessage(msg);
        switch (msg.votingType) {
            case VotingType.NOMINATE: this.handleNominateMessage(msg, fbas); break;
        }
    }

    handleNominateMessage(msg: NominateMessageReturnType, fbas: FBASInstance) {
        // from a leader
        // if (this.leaders.includes(msg.senderId)) {
        // only vote if nothing confirmed so far
        if (this.confirmedNominations.length === 0) {
            fbas.castVote(true);
        }
        fbas.subscribeConfirm(this.onNominateConfirm(fbas))
        // }
    }

    run() {
        // determine nomination leader
        this.addNewLeader();
        // Nominate
        this.nominate();
        //  repeat nominations from leaders
        //  vote for everything UNTIL a value is confirmed
        //  - when first confirmed: Balloting
        //  - when nothing arrives: add new leader (?)
        // Balloting
        //  
    }

    onNominateConfirm(fbas: FBASInstance) {
        return ({ value }: { value: boolean }) => {
            if (value !== true) return;
            const transactions = fbas.messagePayload!.transactions
            this.confirmedNominations.push(transactions);
            console.log('Nomination confirmed for ', fbas.votingId)
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