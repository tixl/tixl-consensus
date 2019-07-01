import { NodeIdentifier } from '../common/NodeIdentifier';
import { NodeState } from './NodeState';
import { findQuorum, Phase } from './helpers/findQuorum';
import { getBlockingSet } from './helpers/getBlockingSet';
import Network from '../common/Network';
import uuid from 'uuid/v4';
import { EventEmitter } from 'events';
import { MessageReturnType, Message, MessageStage } from '../common/messages/Message';
import { NominatePayload } from '../common/messages/NominateMessage';

export type InstanceState = Map<NodeIdentifier, NodeState>;

export type BlockingSet = string[][];

export interface AcceptQuorumOrBlockingSet {
    type: 'QUORUM' | 'BLOCKINGSET',
    value: string[] | BlockingSet
}

export enum FBASEvents {
    VOTE = "VOTE",
    ACCEPT = "ACCEPT",
    CONFIRM = "CONFIRM"
}

export enum VotingType {
    'NOMINATE' = 'NOMINATE'
}

export class FBASInstance {
    votingId: string;
    vote: boolean | null;
    accept: boolean | null;
    confirm: boolean | null;
    acceptQuorum: AcceptQuorumOrBlockingSet | null;
    confirmQuorum: string[] | null;
    slices: string[][];
    nodeId: NodeIdentifier; // My ID
    state: InstanceState;
    network: Network;
    eventEmitter: EventEmitter;
    slotId: number;
    votingType: VotingType;
    messagePayload: null | NominatePayload;

    constructor(votingId: string, nodeId: string, slices: string[][], network: Network, slotId: number, votingType: VotingType, messagePayload?: NominatePayload) {
        this.votingId = votingId;
        this.nodeId = nodeId;
        this.slices = slices;
        this.network = network;
        this.vote = null;
        this.accept = null;
        this.confirm = null;
        this.acceptQuorum = null;
        this.confirmQuorum = null;
        this.slotId = slotId;
        this.votingType = votingType;
        this.messagePayload = messagePayload || null;
        this.state = new Map();
        this.eventEmitter = new EventEmitter();
    }

    subscribeConfirm(listener: (...args: any[]) => void) {
        return this.eventEmitter.on("CONFIRM", listener);
    }

    emitConfirm(value: boolean) {
        return this.eventEmitter.emit("CONFIRM", { value });
    }

    broadcast(msg: MessageReturnType) {
        this.network.send(msg);
    }

    createMessage(stage: MessageStage, value: boolean) {
        return Message({
            votingId: this.votingId,
            votingType: this.votingType,
            slices: this.slices,
            senderId: this.nodeId,
            slotId: this.slotId,
            stage,
            value
        });
    }

    castVote(value: boolean) {
        if (this.vote !== null) return;
        this.vote = value;
        const msg = this.createMessage(MessageStage.VOTE, value);
        this.updateState(this.nodeId, (oldState: NodeState) => ({ ...oldState, vote: value, slices: this.slices }))
        this.broadcast(msg);
        this.onStateUpdated();
    }

    acceptValue(value: boolean) {
        if (this.accept !== null) return;
        this.accept = value;
        const msg = this.createMessage(MessageStage.ACCEPT, value);
        this.updateState(this.nodeId, (oldState: NodeState) => ({ ...oldState, accept: value, slices: this.slices }));
        this.broadcast(msg);
        this.onStateUpdated();
    }

    confirmValue(value: boolean) {
        if (this.confirm !== null) return;
        this.confirm = value;
        const msg = this.createMessage(MessageStage.CONFIRM, value);
        this.updateState(this.nodeId, (oldState: NodeState) => ({ ...oldState, confirm: value, slices: this.slices }));
        this.emitConfirm(value);
        this.broadcast(msg);
    }

    receiveMessage(msg: MessageReturnType) {
        switch (msg.stage) {
            case MessageStage.VOTE: this.handleVoteMessage(msg); break;
            case MessageStage.ACCEPT: this.handleAcceptMessage(msg); break;
            case MessageStage.CONFIRM: this.handleConfirmMessage(msg); break;
        }
    }

    updateState(node: NodeIdentifier, updateFunction: (oldState: NodeState) => NodeState) {
        const oldState = this.state.get(node);
        const newState = oldState ? updateFunction(oldState) : updateFunction({ slices: [], vote: null, accept: null, confirm: null });
        this.state.set(node, newState);
    }

    handleVoteMessage(msg: MessageReturnType) {
        this.updateState(msg.senderId, (oldState: NodeState) => ({ ...oldState, vote: msg.value, slices: msg.slices }));
        this.onStateUpdated();
    }

    handleAcceptMessage(msg: MessageReturnType) {
        this.updateState(msg.senderId, (oldState: NodeState) => ({ ...oldState, accept: msg.value, slices: msg.slices }));
        this.onStateUpdated();
    }

    handleConfirmMessage(msg: MessageReturnType) {
        this.updateState(msg.senderId, (oldState: NodeState) => ({ ...oldState, confirm: msg.value, slices: msg.slices }));
        this.onStateUpdated();
    }

    onStateUpdated() {
        if (this.vote === null) return;
        if (this.vote !== null && this.accept === null) {
            // (1) There exists a quorum U such that v ∈ U and each member of U either voted for a or claims to accept a, or
            const quorum = findQuorum(this.nodeId, this.state, this.vote, Phase.ACCEPT);
            if (quorum) {
                this.acceptValue(this.vote);
                this.acceptQuorum = {
                    type: "QUORUM",
                    value: quorum
                }
            }
            else {
                const blockingSet = getBlockingSet(this.nodeId, this.state);
                if (blockingSet === null) {
                    console.log('No blocking set found');
                }
                else {
                    // Each member of a v-blocking set claims to accept a.
                    this.acceptValue(blockingSet.value);
                    this.acceptQuorum = {
                        type: 'BLOCKINGSET',
                        value: blockingSet.blockingSet
                    }
                }
            }
        }
        else if (this.accept !== null && this.confirm === null) {
            const quorum = findQuorum(this.nodeId, this.state, this.accept, Phase.CONFIRM);
            if (quorum) {
                this.confirmValue(this.accept);
                this.confirmQuorum = quorum;
            }
        }

    }
}