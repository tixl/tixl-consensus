import uuid from "uuid/v4";
import TransactionSet from './TransactionSet';
import Slices from '../common/Slices';
import { NodeIdentifier } from "../common/NodeIdentifier";
import Network from "../common/Network";
import crypto from 'crypto';
import { toBigIntBE } from 'bigint-buffer';

const sha256 = (input: string): bigint => toBigIntBE(crypto.createHash('sha256').update(input, 'utf8'));
const hmax = BigInt(2) ** BigInt(256);

export default class SCPInstance {
    myNodeId: string;
    scpId: string;
    slotCount: number;
    quorumSlices: Slices;
    possibleTransactions: TransactionSet | null; // not yet voted for
    leaders: NodeIdentifier[];
    ballotNumber: number;
    leaderSelectionRound: number;
    network: Network;

    constructor(myNodeId: string, slotCount: number, slices: Slices, network: Network) {
        this.myNodeId = myNodeId;
        this.quorumSlices = slices;
        this.leaders = []
        this.possibleTransactions = null;
        this.slotCount = slotCount;
        this.ballotNumber = 0;
        this.leaderSelectionRound = 0;
        this.scpId = uuid() // How to get the same id in a distributed way?
        this.network = network;
    }

    setPossibleTransactions(transactionSet: TransactionSet) {
        this.possibleTransactions = transactionSet;
    }

    getNodeSliceCount() {
        const slices = this.quorumSlices.toArray();
        const nodeSliceCount: Map<NodeIdentifier, number> = new Map();
        slices.forEach(slice => slice.forEach(node => {
            if (nodeSliceCount.has(node)) nodeSliceCount.set(node, nodeSliceCount.get(node)! + 1)
            else nodeSliceCount.set(node, 1);
        }))
        return nodeSliceCount;
    }

    addNewLeader() {
        const newLeader = this.selectLeader(this.leaderSelectionRound)
        this.leaderSelectionRound++;
        if (!this.leaders.includes(newLeader)) {
            this.leaders.push(newLeader);
        }
    }

    selectLeader(round: number) {
        const isTimeout = false;
        const hX = (i: number) => (m: string) => sha256([String(i), String(this.slotCount), String(isTimeout ? this.ballotNumber : 0), String(round), m].join(''))
        const h0 = hX(0);
        const h1 = hX(1);
        const nodeSliceCount = this.getNodeSliceCount();
        const amountSlices = this.quorumSlices.toArray().length;
        const nodes = [...nodeSliceCount.keys()];
        const neighbors = nodes.filter(node => {
            const weightX1000 = BigInt(nodeSliceCount.get(node)! / amountSlices * 1000);
            const weightedMax = hmax / BigInt(1000) * weightX1000
            return (h0(node) < weightedMax);
        });
        if (neighbors.length) {
            let highestPrio: bigint = BigInt(0);
            let leader = neighbors[0]
            neighbors.forEach(node => {
                const prio = h1(node);
                if (prio > highestPrio) {
                    highestPrio = prio;
                    leader = node;
                }
            })
            return leader;
        }
        else {
            let lowestValue = hmax;
            let selectedNode = nodes[0];
            nodes.forEach(node => {
                const weightX1000 = BigInt(nodeSliceCount.get(node)! / amountSlices * 1000);
                const value = h0(node) / weightX1000 / BigInt(1000);
                if (value < lowestValue) {
                    lowestValue = value;
                    selectedNode = node;
                }
            })
            return selectedNode;
        }

    }

}