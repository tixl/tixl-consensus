import Message from './Message';
import { NodeIdentifier } from "../../common/NodeIdentifier";
import Slices from '../../common/Slices';
import Topic from '../Topic';

type ACCEPT = "ACCEPT";

export default class AcceptMessage extends Message {
    type: ACCEPT;
    constructor(origin: NodeIdentifier, slices: Slices, topic: Topic, value: boolean, slotId: number) {
        super(origin, slices, topic, value, slotId);
        this.type = "ACCEPT";
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