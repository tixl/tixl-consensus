import { NodeIdentifier } from "../../common/NodeIdentifier";
import Slices from '../../common/Slices';
import Topic from '../Topic';

export default class Message {
    origin: NodeIdentifier;
    slices: Slices;
    topic: Topic;
    value: boolean;
    slotId: number;
    
    constructor(origin: NodeIdentifier, slices: Slices, topic: Topic, value: boolean, slotId: number) {
        this.origin = origin;
        this.slices = slices;
        this.topic = topic;
        this.value = value;
        this.slotId = slotId;
    }
}