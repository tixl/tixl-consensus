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
}