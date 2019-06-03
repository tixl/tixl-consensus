import VoteMessage from './messages/VoteMessage';
import ConfirmMessage from './messages/ConfirmMessage';
import AcceptMessage from './messages/AcceptMessage';
import Topic from './Topic';
import Quorum from './Quorum';
import Slices from './Slice';
import { NodeIdentifier } from './NodeIdentifier';
import NodeState from './NodeState';
import { findQuorum, Phase } from './helpers/findQuorum';
import { findBlockingValues } from './helpers/findBlockingValues';
import Network from '../types/Network';
import uuid from 'uuid/v4';

export type InstanceState = Map<NodeIdentifier, NodeState>;

export class FBASInstance {
    topic: Topic;
    vote: boolean | null;
    accept: boolean | null;
    acceptQuorum: Quorum | null;
    confirm: boolean | null;
    confirmQuorum: Quorum | null;
    log: (VoteMessage | AcceptMessage | ConfirmMessage)[];
    slices: Slices; // My Slices
    id: NodeIdentifier; // My ID
    state: InstanceState;
    network: Network;
    internalId: string;

    constructor(topic: Topic, id: NodeIdentifier, slices: Slices, network: Network) {
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
    }

    broadcast(msg: VoteMessage | AcceptMessage | ConfirmMessage) {
        this.network.send(msg.export());
    }

    castVote(value: boolean) {
        console.log(`Vote value ${value} for topic ${this.topic.value}`);
        this.vote = value;
        const msg = new VoteMessage(this.id, this.slices, this.topic, value);
        this.updateState(this.id, (oldState: NodeState) => {
            oldState.setSlices(this.slices);
            oldState.setVote(value);
            return oldState;
        })
        this.broadcast(msg);
        this.onStateUpdated();
    }

    acceptValue(value: boolean) {
        console.log(`Accept value ${value} for topic ${this.topic.value}`);
        this.accept = value;
        const msg = new AcceptMessage(this.id, this.slices, this.topic, value);
        this.updateState(this.id, (oldState: NodeState) => {
            oldState.setSlices(this.slices);
            oldState.setAccept(value);
            return oldState;
        })
        this.broadcast(msg);
        this.onStateUpdated();
    }

    confirmValue(value: boolean) {
        this.confirm = value;
        const msg = new ConfirmMessage(this.id, this.slices, this.topic, value);
        this.updateState(this.id, (oldState: NodeState) => {
            oldState.setSlices(this.slices);
            oldState.setConfirm(value);
            return oldState;
        })
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
        console.log('state updated',this.internalId);
        console.log(this)
        if (this.vote === null) return;
        if (this.vote !== null && this.accept === null) {
            const quorum = findQuorum(this.id, this.state, this.vote, Phase.ACCEPT);
            if (quorum) {
                console.log(`Found a vote - quorum on topic ${this.topic.value} with value ${this.vote}`);
                this.acceptValue(this.vote);
                quorum.print();
            }
            else {
                const blockingValues = findBlockingValues(this.id, this.state);
                if (blockingValues.length === 0) {
                    console.log('No blocking values found')
                }
                if (blockingValues.length === 2) {
                    console.log('Contradicting blocking values found')
                }
                if (blockingValues.length === 1) {
                    const value = blockingValues[0];
                    console.log(`Found blocking set for value ${value} on topic ${this.topic}`);
                    this.acceptValue(value);
                }
            }
        }
        else if (this.accept !== null && this.confirm === null) {
            const quorum = findQuorum(this.id, this.state, this.accept, Phase.CONFIRM);
            if (quorum) {
                console.log(`Found a accept - quorum on topic ${this.topic.value} with value ${this.accept}`);
                this.confirmValue(this.accept);
                quorum.print();
            } else {
                console.log("No confirm quorum so far");
            }
        }

    }
}