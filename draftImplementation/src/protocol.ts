import { ScpNominate, ScpSlices, Value, PublicKey, MessageEnvelope, ScpNominateEnvelope, ScpPrepare, ScpPrepareEnvelope, ScpBallot } from './types';
import { getNeighbors, getPriority } from './neighbors';
import * as _ from 'lodash';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { quorumThreshold, blockingThreshold } from './validateSlices';
import { hash } from './helpers';
import BallotStorage from './BallotStorage';

export type BroadcastFunction = (envelope: MessageEnvelope) => void;

export interface Context {
    self: PublicKey
    slices: ScpSlices
    suggestedValues: Value[],
    slot: number;
}

// interface PrepareState {
//     ballot: ScpBallot
//     phase: 'vote' | 'accept' | 'confirm'
// };

const baseTimeoutValue = 1000;
const timeoutValue = 1000;

export const protocol = (broadcast: BroadcastFunction, context: Context) => {
    const { self, slices, suggestedValues, slot } = context;
    const log = (...args: any[]) => console.log(`${self}: `, ...args);

    // Help variables
    let nominationTimeout: NodeJS.Timeout;
    let prepareTimeout: NodeJS.Timeout;
    let prepareTimeoutCounter: number;
    const sent: bigint[] = [];

    // Protocol variables
    let nominationRound = 1;
    const priorityNodes: PublicKey[] = [];

    // State
    let phase = 'NOMINATE';
    const TNMS = new TransactionNodeMessageStorage();
    const nodeSliceMap = new Map<PublicKey, ScpSlices>();
    nodeSliceMap.set(self, slices);
    const ballotStorage = new BallotStorage();
    const acceptedPrepared: ScpBallot[] = [];
    const confirmedPrepared: ScpBallot[] = [];

    // SCP Structures
    const nominate: ScpNominate = {
        voted: [],
        accepted: [],
    }

    const prepare: ScpPrepare = {
        ballot: { counter: 1, value: [] },
        prepared: null,
        aCounter: 0,
        hCounter: 0,
        cCounter: 0
    }

    const confirmedValues: Value[] = [];

    // Methods 
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

    const enterPreparePhase = () => {
        prepare.ballot.value = confirmedValues;
    }

    const onConfirmedUpdated = () => {
        clearTimeout(nominationTimeout);
        if (phase === 'NOMINATE') {
            phase = 'PREPARE'
            enterPreparePhase();

        }
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

    const armTimer = () => {
        if (prepareTimeoutCounter < prepare.ballot.counter) {
            log('Arming timer for current counter ', prepare.ballot.counter);
            clearTimeout(prepareTimeout);
            prepareTimeoutCounter = prepare.ballot.counter;
            prepareTimeout = setTimeout(() => {
                prepare.ballot.counter++;
            }, (prepare.ballot.counter + 1) * 1000)
        }
    }

    const checkQuorumForCounter = () => {
        // TODO: also include Commit and Externalize 
        const votersWithCounterEqualOrAbove = ballotStorage.getAllVotersForBallotsWithCounterEqualOrAbove(prepare.ballot.counter);
        const isQuorum = quorumThreshold(nodeSliceMap, votersWithCounterEqualOrAbove, self);
        if (isQuorum) armTimer();
    }

    const checkBlockingSetForCounter = () => {
        // TODO: also include Commit and Externalize 
        const votersWithCounterAbove = ballotStorage.getAllVotersForBallotsWithCounterAbove(prepare.ballot.counter);
        const isBlockingSet = blockingThreshold(slices, votersWithCounterAbove);
        if (isBlockingSet) {
            const lowestCounter = ballotStorage.getLowestCounterAbove(prepare.ballot.counter);
            log('Found a blocking set with lowest timer ', lowestCounter)
            clearTimeout(prepareTimeout);
            prepare.ballot.counter = lowestCounter;
            // TODO: Rework this step, this might be inefficient
            const findsAnotherBlockingSet = checkBlockingSetForCounter();
            if (!findsAnotherBlockingSet) {
                checkQuorumForCounter();
            }
            return true;
        }
        return false;
    }

    // Todo: Include Counter limit logic
    const receivePrepare = (envelope: ScpPrepareEnvelope) => {
        const ballotHash = hash(envelope.message.ballot);
        ballotStorage.add(envelope.message.ballot);
        ballotStorage.setSigner(ballotHash, envelope.sender, 'vote');
        checkQuorumForCounter();
        checkBlockingSetForCounter();
    }

    const receive = (envelope: MessageEnvelope) => {
        nodeSliceMap.set(envelope.sender, envelope.slices);
        switch (envelope.type) {
            case "ScpNominate": receiveNominate(envelope); break;
            case "ScpPrepare": receivePrepare(envelope); break;
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

    // Initialize
    determinePriorityNode();

    return receive;
}