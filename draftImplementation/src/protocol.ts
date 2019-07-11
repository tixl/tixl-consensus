import { ScpNominate, ScpSlices, Value, PublicKey, MessageEnvelope, ScpNominateEnvelope, ScpPrepare, ScpPrepareEnvelope, ScpBallot } from './types';
import { getNeighbors, getPriority } from './neighbors';
import * as _ from 'lodash';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { quorumThreshold, blockingThreshold } from './validateSlices';
import { hash, isBallotLower } from './helpers';
import BallotStorage, { BallotHash } from './BallotStorage';

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
    const acceptedPrepared: BallotHash[] = [];
    const confirmedPrepared: BallotHash[] = [];

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

    const acceptBallot = (h: BallotHash) => {
        acceptedPrepared.push(h);
        const ballot = ballotStorage.getBallotFromHash(h);
        if (!ballot) throw new Error('Ballot Hash not in store');
        if (prepare.prepared === null || isBallotLower(prepare.prepared, ballot)) {
            prepare.prepared = ballot;
        }
    }

    const confirmBallot = (h: BallotHash) => {
        confirmedPrepared.push(h);
    }

    const checkBallotAccept = (h: BallotHash) => {
        if (!acceptedPrepared.includes(h) && !confirmedPrepared.includes(h)) {
            const voteOrAccept = ballotStorage.getSigners(h, ['vote', 'accept']);
            if (quorumThreshold(nodeSliceMap, voteOrAccept, self)) {
                acceptBallot(h)
            }
            else {
                const accepts = ballotStorage.getSigners(h, ['accept']);
                if (blockingThreshold(slices, accepts)) {
                    acceptBallot(h);
                }
            }
        }
    }

    const checkBallotConfirm = (h: BallotHash) => {
        if (!confirmedPrepared.includes(h)) {
            const accepts = ballotStorage.getSigners(h, ['accept']);
            if (quorumThreshold(nodeSliceMap, accepts, self)) {
                confirmBallot(h);
            }
        }
    }

    const startConfirmPhase = () => {

    }

    const recalculatePrepareBallotValue = (): void => {
        //  If any ballot has been confirmed prepared, then "ballot.value"
        // is taken to to be "h.value" for the highest confirmed prepared ballot "h". 
        if (confirmedPrepared.length) {
            const highestConfirmed = confirmedPrepared.map(ballotStorage.getBallotFromHash)
                .reduce((acc, b) => {
                    if (isBallotLower(acc!, b!)) acc = b;
                    return acc;
                })
            prepare.ballot.value = highestConfirmed!.value;
            startConfirmPhase();
            return;
        }
        // Otherwise (if no such "h" exists), if one or more values are
        // confirmed nominated, then "ballot.value" is taken as the output
        // of the deterministic combining function applied to all
        // confirmed nominated values.
        if (confirmedValues.length) {
            prepare.ballot.value = confirmedValues;
            return;
        }

        // Otherwise, if no ballot is confirmed prepared and no value is
        // confirmed nominated, but the node has accepted a ballot
        // prepared (because "prepare(b)" meets blocking threshold for
        // some ballot "b"), then "ballot.value" is taken as the value of
        // the highest such accepted prepared ballot.
        if (acceptedPrepared.length) {
            const highestAccepted = acceptedPrepared.map(ballotStorage.getBallotFromHash)
                .reduce((acc, b) => {
                    if (isBallotLower(acc!, b!)) acc = b;
                    return acc;
                });
            prepare.ballot.value = highestAccepted!.value
            return;
        }
        log('Can not send Prepare yet.')
        return;

    }

    const recalculatePrepareField = (): void => {
        //  or NULL if no ballot has been accepted prepared. 
        if (acceptedPrepared.length === 0) prepare.prepared = null;
        // The highest accepted prepared ballot not exceeding the "ballot" field
        const highestAcceptedPreparedBallotNotExceedingBallotField = acceptedPrepared
            .map(ballotStorage.getBallotFromHash)
            .filter(b => isBallotLower(b!, prepare.ballot))
            .reduce((acc, b) => {
                if (isBallotLower(acc!, b!)) acc = b;
                return acc;
            })
        prepare.prepared = highestAcceptedPreparedBallotNotExceedingBallotField!;
        if (prepare.ballot.value.length < prepare.prepared.value.length && prepare.ballot.counter === prepare.prepared.counter) {
            prepare.prepared.counter = prepare.ballot.counter - 1;
            // Note:  it is not possible to vote to commit a ballot with counter 0.
        }
    }

    // TODO: Include Counter limit logic
    const receivePrepare = (envelope: ScpPrepareEnvelope) => {
        // Vote Ballot
        const ballotHash = ballotStorage.add(envelope.message.ballot);
        ballotStorage.setSigner(ballotHash, envelope.sender, 'vote');
        checkBallotAccept(ballotHash);
        // Accept Ballot
        if (envelope.message.prepared) {
            const preparedBallotHash = ballotStorage.add(envelope.message.prepared);
            ballotStorage.setSigner(preparedBallotHash, envelope.sender, 'accept');
            checkBallotAccept(preparedBallotHash);
            checkBallotConfirm(preparedBallotHash);
        }
        const currentCounter = prepare.ballot.counter;
        checkQuorumForCounter();
        checkBlockingSetForCounter();
        if (prepare.ballot.counter !== currentCounter) recalculatePrepareBallotValue();
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
            nominationRound++;
            determinePriorityNode();
        }, baseTimeoutValue + timeoutValue * nominationRound);
    }

    // Initialize
    determinePriorityNode();

    return receive;
}