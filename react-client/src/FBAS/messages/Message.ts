import { NodeIdentifier } from "../NodeIdentifier";
import Slices from '../Slice';
import Topic from '../Topic';

export default class Message {
    origin: NodeIdentifier;
    slices: Slices;
    topic: Topic;
    value: boolean;
    constructor(origin: NodeIdentifier, slices: Slices, topic: Topic, value: boolean) {
        this.origin = origin;
        this.slices = slices;
        this.topic = topic;
        this.value = value;
    }
}