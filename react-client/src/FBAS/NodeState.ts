import Slices from './Slice';

export default class NodeState {
    vote: boolean | null;
    accept: boolean | null;
    confirm: boolean | null;
    slices: Slices;

    constructor(slices?: Slices) {
        this.vote = null;
        this.accept = null;
        this.confirm = null;
        this.slices = slices || new Slices();
    }

    setSlices(slices: Slices) {
        this.slices = slices;
    }

    setVote(value: boolean) {
        this.vote = value;
    }

    setAccept(value: boolean) {
        this.accept = value;
    }

    setConfirm(value: boolean) {
        this.confirm = value;
    }
}