// import Slices from '../common/Slices';
// import NodeState from './NodeState';

// export default class NodeState {
//     vote: boolean | null;
//     accept: boolean | null;
//     confirm: boolean | null;
//     slices: string[][];

//     constructor(slices?: string[][]) {
//         this.vote = null;
//         this.accept = null;
//         this.confirm = null;
//         this.slices = slices || [];
//     }

//     setSlices(slices: string[][]) {
//         this.slices = slices;
//     }

//     setVote(value: boolean) {
//         this.vote = value;
//     }

//     setAccept(value: boolean) {
//         this.accept = value;
//     }

//     setConfirm(value: boolean) {
//         this.confirm = value;
//     }
// }


export interface NodeState {
    vote: boolean | null;
    accept: boolean | null;
    confirm: boolean | null;
    slices: string[][];
}

