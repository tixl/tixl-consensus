import { ScpNominate, ScpSlices, Value, PublicKey, MessageEnvelope, ScpNominateEnvelope } from './types';
import { getNeighbors, getPriority, sha256 } from './neighbors';
import * as _ from 'lodash';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { quorumThreshold, blockingThreshold } from './validateSlices';

const hash = (x: any) => sha256(JSON.stringify(x));

export type BroadcastFunction = (envelope: MessageEnvelope) => void;

export interface Context {
    self: PublicKey
    slices: ScpSlices
    suggestedValues: Value[],
    slot: number;
}

const baseTimeoutValue = 1000;
const timeoutValue = 1000;

export const protocol = (broadcast: BroadcastFunction, context: Context) => {
    const { self, slices, suggestedValues, slot } = context;
    let nominationRound = 1;
    const log = (...args: any[]) => console.log(`${self}: `, ...args);
    const TNMS = new TransactionNodeMessageStorage();
    const nodeSliceMap = new Map<PublicKey, ScpSlices>();
    nodeSliceMap.set(self, slices);
    const sent: bigint[] = [];
    const priorityNodes: PublicKey[] = [];
    let nominationTimeout: NodeJS.Timeout;


    const nominate: ScpNominate = {
        voted: [],
        accepted: [],
    }
    const confirmedValues: Value[] = [];
    log({ suggestedValues });

    const onNominateUpdated = () => {
        nominate.voted = nominate.voted.sort(),
            nominate.accepted = nominate.accepted.sort()
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

    const onConfirmedUpdated = () => {
        clearTimeout(nominationTimeout);
        log('Confirmed: ', confirmedValues.sort().join(' '))
    }

    const addToVotes = (values: Value[]) => {
        if (confirmedValues.length === 0) {
            values.forEach(x => {
                if (!nominate.voted.includes(x) && !nominate.accepted.includes(x)) {
                    nominate.voted.push(x);
                    TNMS.set(x, self, 'vote')
                }
            });
            onNominateUpdated();
        }
    };

    const acceptNominates = (values: Value[]) => {
        values.filter(x => !nominate.accepted.includes(x)).forEach(x => {
            nominate.accepted.push(x);
            TNMS.set(x, self, 'accept')
        });
        _.remove(nominate.voted, y => values.includes(y));
        onNominateUpdated();
    };

    const confirmNominates = (values: Value[]) => {
        confirmedValues.push(...values);
        onConfirmedUpdated();
    }

    const receiveNominate = (envelope: ScpNominateEnvelope) => {
        envelope.message.voted.forEach(transaction => TNMS.set(transaction, envelope.sender, 'vote'))
        envelope.message.accepted.forEach(transaction => TNMS.set(transaction, envelope.sender, 'accept'))
        if (priorityNodes.includes(envelope.sender)) {
            // Todo: Check validity of values
            addToVotes([...envelope.message.voted, ...envelope.message.accepted]);
        }
        const accepted = nominate.voted.filter(transaction => {
            const voteOrAccepts = TNMS.get(transaction, ['vote', 'accept']);
            return quorumThreshold(nodeSliceMap, voteOrAccepts, self);
        })
        const valuesThroughBlocked = envelope.message.accepted.filter(transaction => {
            const accepts = TNMS.get(transaction, ['accept']);
            return blockingThreshold(slices, accepts);
        })
        const allAccepted = _.uniq([...accepted, ...valuesThroughBlocked]);
        if (allAccepted.length) {
            acceptNominates(allAccepted);
        }
        const acceptedNotConfirmed = _.difference(nominate.accepted, confirmedValues);
        if (acceptedNotConfirmed.length) {
            const confirmed = acceptedNotConfirmed.filter(transaction => {
                const accepts = TNMS.get(transaction, ['accept']);
                return quorumThreshold(nodeSliceMap, accepts, self);
            })
            if (confirmed.length) {
                confirmNominates(confirmed)
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


    const determinePriorityNode = () => {
        const neighbors = [self, ...getNeighbors(slot, nominationRound, slices)];
        const priorities = new Map<PublicKey, BigInt>();
        neighbors.forEach(v => priorities.set(v, getPriority(slot, nominationRound, v)));
        log({ neighbors });

        const maxPriorityNeighbor: PublicKey = neighbors.reduce((acc, v) => {
            if (priorities.get(v)! > priorities.get(acc)!) acc = v;
            return acc;
        });
        if (!priorityNodes.includes(maxPriorityNeighbor)) priorityNodes.push(maxPriorityNeighbor)
        log({ maxPriorityNeighbor })

        if (priorityNodes.includes(self)) {
            addToVotes(suggestedValues);
        }

        nominationTimeout = setTimeout(() => {
            nominationRound++
            determinePriorityNode();
        }, baseTimeoutValue + timeoutValue * nominationRound)
    }

    determinePriorityNode();


    return receive;
}