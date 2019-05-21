import VoteMessage from './messages/VoteMessage';
import ConfirmMessage from './messages/ConfirmMessage';
import AcceptMessage from './messages/AcceptMessage';
import Topic from './Topic';
import Quorum from './Quorum';
import Slices from './Slice';
import { NodeIdentifier } from './NodeIdentifier';
import NodeState from './NodeState';
import { findQuorum } from './helpers/findQuorum';
import Network from '../Network';

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
    }

    broadcast(msg: VoteMessage | AcceptMessage | ConfirmMessage) {
        this.network.send(msg.export());
    }

    castVote(value: boolean) {
        this.vote = value;
        const msg = new VoteMessage(this.id, this.slices, this.topic, value);
        this.updateState(this.id, (oldState: NodeState) => {
            oldState.setSlices(this.slices);
            oldState.setVote(value);
            return oldState;
        })
        this.onStateUpdated();
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
        console.log('state updated');
        if (!this.vote) return;
        const quorum = findQuorum(this.id, this.state, this.vote);
        if (quorum) {
            console.log(`Found a vote - quorum on topic ${this.topic.value} with value ${this.vote}`);
            quorum.print();
        }
        else {
            console.log('No quorum found so far.')
        }
    }
}