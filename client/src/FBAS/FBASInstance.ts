import VoteMessage from './messages/VoteMessage';
import ConfirmMessage from './messages/ConfirmMessage';
import AcceptMessage from './messages/AcceptMessage';
import Topic from './Topic';
import Quorum from './Quorum';

export class FBASInstance {
    topic: Topic;
    vote: boolean | null;
    accept: boolean | null;
    acceptQuorum: Quorum | null;
    confirm: boolean | null;
    confirmQuorum: Quorum | null;
    log: (VoteMessage | AcceptMessage | ConfirmMessage)[];

    constructor(topic: Topic) {
        this.topic = topic;
        this.vote = null;
        this.accept = null;
        this.acceptQuorum = null;
        this.confirm = null;
        this.confirmQuorum = null;
        this.log = [];
    }
}