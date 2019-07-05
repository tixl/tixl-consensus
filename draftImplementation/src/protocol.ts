import { ScpNominate, ScpSlices, Value, PublicKey, MessageEnvelope, ScpNominateEnvelope } from './types';
import { getNeighbors, getPriority, sha256 } from './neighbors';
import * as _ from 'lodash';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { quorumThreshold } from './validateSlices';

const hash = (x: any) => sha256(JSON.stringify(x));

export type BroadcastFunction = (envelope: MessageEnvelope) => void;

export interface Context {
    self: PublicKey
    slices: ScpSlices
    suggestedValues: Value[]
}

export const protocol = (broadcast: BroadcastFunction, context: Context) => {
    const { self, slices, suggestedValues } = context;
    const log = (...args: any[]) => console.log(`${self}: `, ...args);
    const TNMS = new TransactionNodeMessageStorage();
    const nodeSliceMap = new Map<PublicKey, ScpSlices>();
    nodeSliceMap.set(self, slices);
    const sent: bigint[] = [];

    const nominate: ScpNominate = {
        voted: [],
        accepted: [],
    }

    log({suggestedValues});
    
    const neighbors = [self, ...getNeighbors(self, slices)];
    const priorities = new Map<PublicKey, BigInt>();
    neighbors.forEach(v => priorities.set(v, getPriority(self, v)));
    log({ neighbors });

    const maxPriorityNeighbor: PublicKey = neighbors.reduce((acc, v) => {
        if (priorities.get(v)! > priorities.get(acc)!) acc = v;
        return acc;
    });
    log({ maxPriorityNeighbor })


    const onNominateUpdated = () => {
        const msg: ScpNominateEnvelope = {
            type: "ScpNominate",
            message: nominate,
            sender: self,
            slices,
        };
        const h = hash(msg);
        if (!sent.includes(h)) {
            sent.push(h);
            broadcast(msg)
        }
    }

    const addToVotes = (values: Value[]) => {
        values.forEach(x => {
            if (!nominate.voted.includes(x) && !nominate.accepted.includes(x)) nominate.voted.push(x);
        });
        onNominateUpdated();
    };

    const acceptNominates = (values: Value[]) => {
        values.forEach(x => {
            nominate.accepted.push(x);
            nominate.voted = _.remove(nominate.voted, y => y === x);
        });
        onNominateUpdated();
    };

    const receiveNominate = (envelope: ScpNominateEnvelope) => {
        envelope.message.voted.forEach(transaction => TNMS.set(transaction, envelope.sender, 'vote'))
        envelope.message.accepted.forEach(transaction => TNMS.set(transaction, envelope.sender, 'accept'))
        if (envelope.sender === maxPriorityNeighbor) {
            // Todo: Check validity of values
            addToVotes([...envelope.message.voted, ...envelope.message.accepted]);
        }
        if (nominate.voted) {
            const accepted = nominate.voted.filter(transaction => {
                const signers = TNMS.get(transaction, ['vote', 'accept']);
                return quorumThreshold(nodeSliceMap, signers, self);
            })
            if (accepted.length) {
                acceptNominates(accepted);
            }
        }

    }

    const receive = (envelope: MessageEnvelope) => {
        nodeSliceMap.set(envelope.sender, envelope.slices);
        switch (envelope.type) {
            case "ScpNominate": receiveNominate(envelope); break;
            default: throw new Error('unknown message type')
        }
    }

    if (maxPriorityNeighbor === self) {
        addToVotes(suggestedValues);
    }


    return receive;
}