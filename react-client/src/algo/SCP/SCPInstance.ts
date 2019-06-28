import uuid from "uuid/v4";
import TransactionSet from './TransactionSet';
import Slices from '../common/Slices';
import { NodeIdentifier } from "../common/NodeIdentifier";
import Network from "../common/Network";
import crypto from 'crypto';
import { toBigIntBE } from 'bigint-buffer';
import { FBASInstance, FBASEvents } from '../FBAS/FBASInstance';
import Topic from '../FBAS/Topic';
import { EventEmitter } from 'events';

const sha256 = (input: string): bigint => toBigIntBE(crypto.createHash('sha256').update(input, 'utf8'));
const hmax = BigInt(2) ** BigInt(256);

export default class SCPInstance {
    myNodeId: string;
    scpId: string;
    slotId: number;
    quorumSlices: Slices;
    suggestedTransactions: TransactionSet | null; // not yet voted for
    confirmedNominations: TransactionSet[];
    leaders: NodeIdentifier[];
    ballotNumber: number;
    leaderSelectionRound: number;
    network: Network;
    hasNominatedOwnValues: boolean;
    eventEmitter: EventEmitter;
    fbasMap: Map<string, FBASInstance>;

    constructor(myNodeId: string, slotId: number, slices: Slices, network: Network) {
        this.myNodeId = myNodeId;
        this.quorumSlices = slices;
        this.leaders = []
        this.suggestedTransactions = null;
        this.confirmedNominations = [];
        this.slotId = slotId;
        this.ballotNumber = 0;
        this.leaderSelectionRound = 0;
        this.scpId = uuid() // How to get the same id in a distributed way?
        this.network = network;
        this.hasNominatedOwnValues = false;
        this.eventEmitter = new EventEmitter();
        this.fbasMap = new Map();

    }

    setSuggestedTransactions(transactionSet: TransactionSet) {
        this.suggestedTransactions = transactionSet;
    }

    receiveMessage(message: any) {
        if (!message.slotId) { console.log('Message is missing slotId') }
        if (!message.topic || !message.topic.id) { console.log('Message has no topic id') };
        let fbas;
        if (this.fbasMap.has(message.topic.id)) fbas = this.fbasMap.get(message.topic.id)!;
        else {
            fbas = new FBASInstance(Topic.withId(message.topic.value, message.topic.id), this.myNodeId, this.quorumSlices, this.network, this.slotId);
            this.fbasMap.set(message.topic.id, fbas);
            switch (message.topic.type) {
                case "NOMINATE": this.handleNominateMessage(message, fbas); break;
                default: console.log('unsupported message topic type')
            }
            // set subscribers
        }
        fbas.receiveMessage(message);
    }

    handleNominateMessage(message: any, fbas: FBASInstance) {
        // from a leader
        if (this.leaders.includes(message.origin)) {
            // only vote if 
            if (this.confirmedNominations.length === 0) {
                fbas.castVote(true);
            }
            fbas.subscribe(FBASEvents.CONFIRM, this.onNominateConfirm(message.topic))

        }
    }

    run() {
        // determine nomination leader
        this.addNewLeader();
        // Nominate
        this.nominate();
        //  repeat nominations from leaders
        //  vote for everything UNTIL a value is confirmed
        //  - when first confirmed: Balloting
        //  - when nothing arrives: add new leader (?)
        // Balloting
        //  
    }

    onNominateConfirm(topic: any) {
        return ({ value }: { value: boolean }) => {
            if (value !== true) return;
            this.confirmedNominations.push(topic.value.transactions as any);
            console.log('Nomination confirmed for ', topic.value.transactions)
        }
    }

    nominate() {
        if (this.hasNominatedOwnValues) {
            console.log('already nominated values');
            return;
        }
        if (this.leaders.includes(this.myNodeId)) {
            if (this.suggestedTransactions === null) { console.log('no transactions'); return; }
            const topicValue = {
                type: "NOMINATE",
                transactions: this.suggestedTransactions,
                slotId: this.slotId,
            }
            const topic = Topic.autoId(topicValue)
            const fbas = new FBASInstance(topic, this.myNodeId, this.quorumSlices, this.network, this.slotId);
            this.fbasMap.set(fbas.topic.id, fbas);
            this.hasNominatedOwnValues = true;
            fbas.subscribe(FBASEvents.CONFIRM, this.onNominateConfirm(topic.export()))

        } else {
            console.log('Do not nominate anything, because not a leader')
        }
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
        console.log('New leader added ', newLeader)
    }

    selectLeader(round: number) {
        const isTimeout = false;
        const hX = (i: number) => (m: string) => sha256([String(i), String(this.slotId), String(isTimeout ? this.ballotNumber : 0), String(round), m].join(''))
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