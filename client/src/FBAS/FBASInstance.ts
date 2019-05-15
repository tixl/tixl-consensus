import VoteMessage from './messages/VoteMessage';
import ConfirmMessage from './messages/ConfirmMessage';
import AcceptMessage from './messages/AcceptMessage';
import Topic from './Topic';
import Quorum from './Quorum';
import Slices from './Slice';
import NodeIdentifier, { NodePK } from './NodeIdentifier';
import NodeState from './NodeState';

export type InstanceState = Map<NodePK, NodeState>;

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
    broadcast: (obj: any) => void;

    constructor(topic: Topic, id: NodeIdentifier, slices: Slices, broadcast: (obj: any) => void) {
        this.topic = topic;
        this.id = id;
        this.slices = slices;
        this.broadcast = broadcast;
        this.vote = null;
        this.accept = null;
        this.acceptQuorum = null;
        this.confirm = null;
        this.confirmQuorum = null;
        this.log = [];
        this.state = new Map();
    }

    castVote(value: boolean) {
        this.vote = value;
        const msg = new VoteMessage(this.id, this.slices, this.topic, value);
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

    handleVoteMessage(msg: VoteMessage) {
        const nodeState = (this.state.has(msg.origin.pk)) ? this.state.get(msg.origin.pk)! : new NodeState(msg.slices);
        nodeState.setVote(msg.value);
        this.state.set(msg.origin.pk, nodeState);
        this.onStateUpdated();
    }

    handleAcceptMessage(msg: AcceptMessage) {
        const nodeState = (this.state.has(msg.origin.pk)) ? this.state.get(msg.origin.pk)! : new NodeState(msg.slices);
        nodeState.setAccept(msg.value);
        this.state.set(msg.origin.pk, nodeState);
        this.onStateUpdated();
    }

    handleConfirmMessage(msg: ConfirmMessage) {
        const nodeState = (this.state.has(msg.origin.pk)) ? this.state.get(msg.origin.pk)! : new NodeState(msg.slices);
        nodeState.setConfirm(msg.value);
        this.state.set(msg.origin.pk, nodeState);
        this.onStateUpdated();
    }

    onStateUpdated() {

    }
}