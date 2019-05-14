import Message from './Message';
import NodeIdentifier from "../NodeIdentifier";
import Slices from '../Slice';
import Topic from '../Topic';

type ACCEPT = "ACCEPT";

export default class AcceptMessage extends Message {
    type: ACCEPT;
    constructor(origin: NodeIdentifier, slices: Slices, topic: Topic, value: boolean) {
        super(origin, slices, topic, value);
        this.type = "ACCEPT";
    }

    export() {
        return {
            origin: this.origin,
            slices: this.slices,
            topic: this.topic,
            value: this.value,
            type: this.type,
        }
    }
}