import VoteMessage from './messages/VoteMessage';
import ConfirmMessage from './messages/ConfirmMessage';
import AcceptMessage from './messages/AcceptMessage';
import Topic from './Topic';
import Quorum from './Quorum';
import Slices from '../common/Slices';
import { NodeIdentifier } from '../common/NodeIdentifier';
import NodeState from './NodeState';
import { findQuorum, Phase } from './helpers/findQuorum';
import { getBlockingSet } from './helpers/getBlockingSet';
import Network from '../common/Network';
import uuid from 'uuid/v4';
import { EventEmitter } from 'events';

export type InstanceState = Map<NodeIdentifier, NodeState>;

export type BlockingSet = NodeIdentifier[][];

export interface AcceptQuorumOrBlockingSet {
    type: 'QUORUM' | 'BLOCKINGSET',
    value: Quorum | BlockingSet
}

export enum FBASEvents {
    VOTE = "VOTE",
    ACCEPT = "ACCEPT",
    CONFIRM = "CONFIRM"
}

export class FBASInstance {
    topic: Topic;
    vote: boolean | null;
    accept: boolean | null;
    acceptQuorum: null | AcceptQuorumOrBlockingSet;
    confirm: boolean | null;
    confirmQuorum: Quorum | null;
    log: (VoteMessage | AcceptMessage | ConfirmMessage)[];
    slices: Slices; // My Slices
    id: NodeIdentifier; // My ID
    state: InstanceState;
    network: Network;
    internalId: string;
    eventEmitter: EventEmitter;
    slotId: number;

    constructor(topic: Topic, id: NodeIdentifier, slices: Slices, network: Network, slotId: number) {
        this.topic = topic;
        this.id = id;
        this.slices = slices;
        this.network = network;
        this.vote = null;
        this.accept = null;
        this.acceptQuorum = null;
        this.confirm = null;
        this.confirmQuorum = null;
        this.log = [];
        this.state = new Map();
        this.internalId = uuid();
        this.eventEmitter = new EventEmitter();
        this.slotId = slotId;
    }

    subscribe(event: FBASEvents, listener: (...args: any[]) => void) {
        return this.eventEmitter.on(event, listener);
    }

    emit(event: FBASEvents, ...payload: any[]) {
        return this.eventEmitter.emit(event, ...payload);
    }


    broadcast(msg: VoteMessage | AcceptMessage | ConfirmMessage) {
        this.network.send(msg.export());
    }

    castVote(value: boolean) {
        if(this.vote !== null) return;
        console.log(`Vote value ${value} for topic ${this.topic.value}`);
        this.vote = value;
        const msg = new VoteMessage(this.id, this.slices, this.topic, value, this.slotId);
        this.updateState(this.id, (oldState: NodeState) => {
            oldState.setSlices(this.slices);
            oldState.setVote(value);
            return oldState;
        })
        this.emit(FBASEvents.VOTE, { value })
        this.broadcast(msg);
        this.onStateUpdated();
    }

    acceptValue(value: boolean) {
        if(this.accept !== null) return;
        console.log(`Accept value ${value} for topic ${this.topic.value}`);
        this.accept = value;
        const msg = new AcceptMessage(this.id, this.slices, this.topic, value, this.slotId);
        this.updateState(this.id, (oldState: NodeState) => {
            oldState.setSlices(this.slices);
            oldState.setAccept(value);
            return oldState;
        })
        this.emit(FBASEvents.ACCEPT, { value })
        this.broadcast(msg);
        this.onStateUpdated();
    }

    confirmValue(value: boolean) {
        if(this.confirm !== null) return;
        this.confirm = value;
        const msg = new ConfirmMessage(this.id, this.slices, this.topic, value, this.slotId);
        this.updateState(this.id, (oldState: NodeState) => {
            oldState.setSlices(this.slices);
            oldState.setConfirm(value);
            return oldState;
        })
        this.emit(FBASEvents.CONFIRM, { value })
        this.broadcast(msg);
    }

    receiveMessage(msg: VoteMessage | AcceptMessage | ConfirmMessage) {
        this.log.push(msg);
        switch (msg.type) {
            case "VOTE": this.handleVoteMessage(msg); break;
            case "ACCEPT": this.handleAcceptMessage(msg); break;
            case "CONFIRM": this.handleConfirmMessage(msg); break;
        }
    }

    updateState(node: NodeIdentifier, updateFunction: (oldState: NodeState) => NodeState) {
        const oldState = this.state.get(node);
        const newState = oldState ? updateFunction(oldState) : updateFunction(new NodeState());
        this.state.set(node, newState);
    }

    handleVoteMessage(msg: VoteMessage) {
        this.updateState(msg.origin, (oldState: NodeState) => {
            oldState.setVote(msg.value);
            oldState.setSlices(msg.slices);
            return oldState;
        });
        this.onStateUpdated();
    }

    handleAcceptMessage(msg: AcceptMessage) {
        this.updateState(msg.origin, (oldState: NodeState) => {
            oldState.setAccept(msg.value);
            oldState.setSlices(msg.slices);
            return oldState;
        });
        this.onStateUpdated();
    }

    handleConfirmMessage(msg: ConfirmMessage) {
        this.updateState(msg.origin, (oldState: NodeState) => {
            oldState.setConfirm(msg.value);
            oldState.setSlices(msg.slices);
            return oldState;
        });
        this.onStateUpdated();
    }

    onStateUpdated() {
        console.log('state updated', this.internalId);
        console.log(this)
        if (this.vote === null) return;
        if (this.vote !== null && this.accept === null) {
            // (1) There exists a quorum U such that v ∈ U and each member of U either voted for a or claims to accept a, or
            const quorum = findQuorum(this.id, this.state, this.vote, Phase.ACCEPT);
            if (quorum) {
                console.log(`Found a vote - quorum on topic ${this.topic.value} with value ${this.vote}`);
                this.acceptValue(this.vote);
                this.acceptQuorum = {
                    type: "QUORUM",
                    value: quorum
                }
                quorum.print();
            }
            else {
                const blockingSet = getBlockingSet(this.id, this.state);
                if (blockingSet === null) {
                    console.log('No blocking set found');
                }
                else {
                    // Each member of a v-blocking set claims to accept a.
                    console.log(`Found blocking set for value ${blockingSet.value} on topic ${this.topic}`);
                    this.acceptValue(blockingSet.value);
                    this.acceptQuorum = {
                        type: 'BLOCKINGSET',
                        value: blockingSet.blockingSet
                    }
                }
            }
        }
        else if (this.accept !== null && this.confirm === null) {
            const quorum = findQuorum(this.id, this.state, this.accept, Phase.CONFIRM);
            if (quorum) {
                console.log(`Found a accept - quorum on topic ${this.topic.value} with value ${this.accept}`);
                this.confirmValue(this.accept);
                this.confirmQuorum = quorum;
                quorum.print();
            } else {
                console.log("No confirm quorum so far");
            }
        }

    }
}