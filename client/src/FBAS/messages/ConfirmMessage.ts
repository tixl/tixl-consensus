import Message from './Message';
import NodeIdentifier from "../NodeIdentifier";
import Slices from '../Slice';
import Topic from '../Topic';

type CONFIRM = "CONFIRM";

export default class ConfirmMessage extends Message {
    type: CONFIRM;
    constructor(origin: NodeIdentifier, slices: Slices, topic: Topic, value: boolean) {
        super(origin, slices, topic, value);
        this.type = "CONFIRM";
    }
}