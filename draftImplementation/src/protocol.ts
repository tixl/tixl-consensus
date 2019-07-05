import { ScpNominate, ScpSlices, Value, PublicKey, MessageEnvelope, ScpNominateEnvelope } from './types';
import { getNeighbors, getPriority, sha256 } from './neighbors';
import * as _ from 'lodash';

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
    const nominate: ScpNominate = {
        voted: [],
        accepted: [],
    }

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
        broadcast({
            type: "ScpNominate",
            message: nominate,
            sender: self
        })
    }

    const addToVotes = (values: Value[]) => {
        values.forEach(x => {
            if (!nominate.voted.includes(x) && !nominate.accepted.includes(x)) nominate.voted.push(x);
        });
        onNominateUpdated();
    };

    // const acceptNominates = (values: Value[]) => {
    //     values.forEach(x => {
    //         nominate.accepted.push(x);
    //         nominate.voted = _.remove(nominate.voted, y => y === x);
    //     });
    //     onNominateUpdated();
    // };

    const receiveNominate = (envelope: ScpNominateEnvelope) => {
        if (envelope.sender === maxPriorityNeighbor) {
            // Todo: Check validity of values
            addToVotes([...envelope.message.voted, ...envelope.message.accepted]);
        }
    }

    const receive = (envelope: MessageEnvelope) => {
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