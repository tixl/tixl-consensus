import { NodeIdentifier } from "../../common/NodeIdentifier";
import Slices from '../../common/Slices';
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