import Message from './Message';
import { NodeIdentifier } from "../../common/NodeIdentifier";
import Slices from '../../common/Slices';
import Topic from '../Topic';

type VOTE = "VOTE";

export default class VoteMessage extends Message {
    type: VOTE;
    constructor(origin: NodeIdentifier, slices: Slices, topic: Topic, value: boolean, slotId: number) {
        super(origin, slices, topic, value, slotId);
        this.type = "VOTE";
    }

    export() {
        return {
            origin: this.origin,
            slices: this.slices.toArray(),
            topic: this.topic.export(),
            value: this.value,
            type: this.type,
        }
    }
}