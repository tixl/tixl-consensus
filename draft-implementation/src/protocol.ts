import { ScpNominate, ScpSlices, Value, PublicKey, MessageEnvelope, ScpNominateEnvelope, ScpPrepare, ScpPrepareEnvelope, ScpBallot, ScpCommit, ScpCommitEnvelope } from './types';
import { getNeighbors, getPriority } from './neighbors';
import * as _ from 'lodash';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { quorumThreshold, blockingThreshold } from './validateSlices';
import { hash, isBallotLower, hashBallot, hashBallotValue } from './helpers';
import { PrepareStorage } from './PrepareStorage';
import { CommitStorage } from './CommitStorage';

export type BroadcastFunction = (envelope: MessageEnvelope) => void;

export interface Context {
    self: PublicKey
    slices: ScpSlices
    suggestedValues: Value[],
    slot: number;
}

export type Phase = 'NOMINATE' | 'PREPARE' | 'COMMIT' | 'EXTERNALIZE';

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
    let phase: Phase = 'NOMINATE';
    const TNMS = new TransactionNodeMessageStorage();
    const nodeSliceMap = new Map<PublicKey, ScpSlices>();
    nodeSliceMap.set(self, slices);
    const prepareStorage = new PrepareStorage();
    const commitStorage = new CommitStorage();
    const acceptedPrepared: ScpBallot[] = [];
    const confirmedPrepared: ScpBallot[] = [];
    let commitBallot: ScpBallot | null = null;
    const acceptedCommited: ScpBallot[] = [];
    const confirmedCommited: ScpBallot[] = [];

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

    const commit: ScpCommit = {
        ballot: { counter: 1, value: [] },
        preparedCounter: 0,
        hCounter: 0,
        cCounter: Number.MAX_SAFE_INTEGER,
    }

    const confirmedValues: Value[] = [];

    // Methods 

    const onNominateUpdated = () => {
        nominate.voted = nominate.voted.sort()
        nominate.accepted = nominate.accepted.sort()
        if (phase !== 'NOMINATE') return;
        const payload = {
            type: "ScpNominate" as "ScpNominate",
            message: nominate,
            sender: self,
            slices,
        }
        const msg: ScpNominateEnvelope = {
            ...payload,
            timestamp: Date.now(),

        };
        const h = hash(payload);
        if (!sent.includes(h)) {
            sent.push(h);
            broadcast(msg)
        }
    }

    const enterPreparePhase = () => {
        log('Entering Prepare Phase')
        prepare.ballot.value = confirmedValues;
        sendPrepareMessage();
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

    const armTimer = (increaseFunc: () => void) => {
        if (prepareTimeoutCounter < prepare.ballot.counter) {
            log('Arming timer for current counter ', prepare.ballot.counter);
            clearTimeout(prepareTimeout);
            prepareTimeoutCounter = prepare.ballot.counter;
            prepareTimeout = setTimeout(() => {
                increaseFunc();
            }, (prepare.ballot.counter + 1) * 1000)
        }
    }

    const checkQuorumForCounter = (increaseFunc: () => void) => {
        // TODO: also include Commit and Externalize 
        const votersWithCounterEqualOrAbove = prepareStorage.getAllPreparesAsArray()
            .filter(p => p.ballot.counter >= prepare.ballot.counter && p.ballot.counter)
            .map(p => p.node);
        const isQuorum = quorumThreshold(nodeSliceMap, votersWithCounterEqualOrAbove, self);
        if (isQuorum) armTimer(increaseFunc);
    }

    const checkBlockingSetForCounter = (setFunc: (value: number) => void) => {
        // TODO: also include Commit and Externalize 
        const preparesWithCounterAbove = prepareStorage.getAllPreparesAsArray()
            .filter(p => p.ballot.counter > prepare.ballot.counter);
        const isBlockingSet = blockingThreshold(slices, preparesWithCounterAbove.map(p => p.node));
        if (isBlockingSet) {
            const lowestCounter = Math.min(...preparesWithCounterAbove.map(p => p.ballot.counter));
            log('Found a blocking set with lowest timer ', lowestCounter)
            clearTimeout(prepareTimeout);
            setFunc(lowestCounter);

            // TODO: Rework this step, this might be inefficient
            const findsAnotherBlockingSet = checkBlockingSetForCounter(setFunc);
            if (!findsAnotherBlockingSet) {
                checkQuorumForCounter(() => prepare.ballot.counter++);
            }
            return true;
        }
        return false;
    }

    const acceptPrepareBallot = (b: ScpBallot) => {
        const h = hashBallot(b);
        if (!acceptedPrepared.find(x => hashBallot(x) === h)) {
            log('ACCEPT prepapre ballot', b.counter, b.value.join(' '));
            acceptedPrepared.push(b);
        }
        if (prepare.prepared === null || isBallotLower(prepare.prepared, b)) {
            prepare.prepared = b;
        }
    }

    const confirmPrepareBallot = (b: ScpBallot) => {
        const h = hashBallot(b);
        if (!confirmedPrepared.find(x => hashBallot(x) === h)) {
            log('CONFIRM prepapre ballot', b.counter, b.value.join(' '));
            confirmedPrepared.push(b);
            enterCommitPhase();
        }
    }

    const checkPrepareBallotAccept = () => {
        const ballotHash = hashBallot(prepare.ballot);
        const voteOrAccept = prepareStorage.getAllPreparesAsArray()
            .filter(p => hashBallot(p.ballot) === ballotHash || (p.prepared && hashBallot(p.prepared) === ballotHash))
            .map(p => p.node);
        if (quorumThreshold(nodeSliceMap, voteOrAccept, self)) {
            acceptPrepareBallot(prepare.ballot);
        }
        const accepts = prepareStorage.getAllPreparesAsArray()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash)
            .map(p => p.node);
        if (blockingThreshold(slices, accepts)) {
            acceptPrepareBallot(prepare.ballot);
        }
    }

    const checkPrepareBallotConfirm = () => {
        if (!prepare.prepared) return;
        const ballotHash = hashBallot(prepare.prepared);
        const accepts = prepareStorage.getAllPreparesAsArray()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash)
            .map(p => p.node);
        if (quorumThreshold(nodeSliceMap, accepts, self)) {
            confirmPrepareBallot(prepare.ballot);
        }
    }

    const enterCommitPhase = () => {
        log('Entering Commit Phase')
        phase = "COMMIT";
        commit.ballot = prepare.ballot;
        commit.preparedCounter = prepare.prepared!.counter;
        sendCommitMessage();
    }

    const getHighestConfirmedPreparedBallot = () => {
        if (confirmedPrepared.length) {
            const highestConfirmed = confirmedPrepared.reduce((acc, b) => {
                if (isBallotLower(acc, b)) acc = b;
                return acc;
            })
            return highestConfirmed;
        }
        return null;
    }


    const getHighestAcceptedPreparedBallot = () => {
        if (acceptedPrepared.length) {
            const highestAccepted = acceptedPrepared.reduce((acc, b) => {
                if (isBallotLower(acc, b)) acc = b;
                return acc;
            })
            return highestAccepted;
        }
        return null;
    }

    const recalculatePrepareBallotValue = (): void => {
        //  If any ballot has been confirmed prepared, then "ballot.value"
        // is taken to to be "h.value" for the highest confirmed prepared ballot "h". 
        const highestConfirmed = getHighestConfirmedPreparedBallot();
        if (highestConfirmed) {
            prepare.ballot.value = highestConfirmed.value;
            enterCommitPhase();
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
        const highestAccepted = getHighestAcceptedPreparedBallot();
        if (highestAccepted) {
            prepare.ballot.value = highestAccepted.value
            return;
        }
        log('Can not send PREPARE yet.')
        return;
    }

    const recalculatePreparedField = (): void => {
        // FIXME: Check if all lesser ballots have been aborted

        //  or NULL if no ballot has been accepted prepared. 
        if (acceptedPrepared.length === 0) prepare.prepared = null;
        // The highest accepted prepared ballot not exceeding the "ballot" field
        const ballotsLowerThanPrepare = acceptedPrepared.filter(b => isBallotLower(b, prepare.ballot))
        if (ballotsLowerThanPrepare.length) {

            const highestAcceptedPreparedBallotNotExceedingBallotField =
                ballotsLowerThanPrepare.reduce((acc, b) => {
                    if (isBallotLower(acc, b)) acc = b;
                    return acc;
                })
            prepare.prepared = highestAcceptedPreparedBallotNotExceedingBallotField!;
            if (prepare.ballot.value.length < prepare.prepared.value.length && prepare.ballot.counter === prepare.prepared.counter) {
                prepare.prepared.counter = prepare.ballot.counter - 1;
                // Note:  it is not possible to vote to commit a ballot with counter 0.
            }
        }
    }

    const recalculateACounter = (oldPrepared: ScpBallot | null) => {
        if (!oldPrepared) return;
        if (hashBallotValue(oldPrepared) !== hashBallotValue(prepare.prepared)) {
            if (oldPrepared.value.length < prepare.prepared!.value.length) {
                prepare.aCounter = oldPrepared.counter;
            }
            else {
                prepare.aCounter = oldPrepared.counter + 1;
            }
        }
    }

    const recalculateHCounter = () => {
        const highestConfirmed = getHighestConfirmedPreparedBallot();
        if (highestConfirmed && hashBallotValue(highestConfirmed) === hashBallotValue(prepare.ballot)) {
            prepare.hCounter = highestConfirmed.counter;
        }
        else {
            prepare.hCounter = 0;
        }
    }

    const updateCommitBallot = () => {
        if ((commitBallot && isBallotLower(commitBallot, prepare.prepared!) && hashBallotValue(prepare.prepared) !== hashBallotValue(commitBallot))
            || prepare.aCounter > prepare.cCounter) {
            commitBallot = null;
        }
        if (commitBallot === null && prepare.hCounter === prepare.ballot.counter) {
            commitBallot = prepare.ballot;
        }
    }

    const recalculateCCounter = () => {
        updateCommitBallot();
        if (commitBallot === null || prepare.hCounter === 0) { prepare.cCounter = 0; }
        else { prepare.cCounter = commitBallot.counter; }
    }

    const sendPrepareMessage = () => {
        const payload = {
            message: prepare,
            sender: self,
            type: "ScpPrepare" as 'ScpPrepare',
            slices
        }
        const msg: ScpPrepareEnvelope = {
            ...payload,
            timestamp: Date.now(),
        }
        const h = hash(payload);
        if (!sent.includes(h)) {
            sent.push(h);
            broadcast(msg);
        }
    }

    // TODO: Include Counter limit logic
    const receivePrepare = (envelope: ScpPrepareEnvelope) => {
        prepareStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        checkPrepareBallotAccept();
        checkPrepareBallotConfirm();

        const currentCounter = prepare.ballot.counter;
        checkQuorumForCounter(() => prepare.ballot.counter++);
        checkBlockingSetForCounter((value: number) => prepare.ballot.counter = value);
        if (prepare.ballot.counter !== currentCounter) {
            recalculatePrepareBallotValue();
        }
        const oldPrepared = prepare.prepared;
        recalculatePreparedField();
        if (hashBallotValue(oldPrepared) !== hashBallotValue(prepare.prepared)) {
            recalculateACounter(oldPrepared);
        }
        recalculateHCounter();
        recalculateCCounter();
        if (phase === "PREPARE") {
            sendPrepareMessage();
        }
    }

    const acceptCommitBallot = (ballot: ScpBallot) => {
        const h = hashBallot(ballot);
        if (!acceptedCommited.find(x => hashBallot(x) !== h)) {
            acceptedCommited.push(ballot)
        }
    }

    const confirmCommitBallot = (ballot: ScpBallot) => {
        const h = hashBallot(ballot);
        if (confirmedCommited.find(x => hashBallot(x) === h) === undefined) {
            log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
            log('CONFIRMED BALLOT ', ballot.counter, ballot.value.join(' '))
            confirmedCommited.push(ballot)
        }
    }

    const checkCommitBallotAccept = () => {
        const votesOrAccepts = commitStorage.getAllCommitsAsArray()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(commit.ballot) && (c.cCounter >= commit.ballot.counter && c.hCounter <= commit.ballot.counter))
                // votes
                || (hashBallotValue(c.ballot) === hashBallotValue(commit.ballot) && commit.ballot.counter >= c.cCounter)
            ).map(c => c.node);
        if (quorumThreshold(nodeSliceMap, votesOrAccepts, self)) {
            acceptCommitBallot(commit.ballot);
        }
        const accepts = commitStorage.getAllCommitsAsArray()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(commit.ballot) && (c.cCounter >= commit.ballot.counter && c.hCounter <= commit.ballot.counter))
            ).map(c => c.node);
        if (blockingThreshold(slices, accepts)) {
            acceptCommitBallot(commit.ballot);
        }
    }

    const checkCommitBallotConfirm = () => {
        const accepts = commitStorage.getAllCommitsAsArray()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(commit.ballot) && (c.cCounter >= commit.ballot.counter && c.hCounter <= commit.ballot.counter))
            ).map(c => c.node);
        if (quorumThreshold(nodeSliceMap, accepts, self)) {
            confirmCommitBallot(commit.ballot);
        }
    }

    const recalculatePreparedCounter = () => {
        // TODO: Check if this is complete / right
        const highestAccepted = getHighestAcceptedPreparedBallot()
        if (highestAccepted) {
            commit.preparedCounter = highestAccepted.counter;
        }
    }

    const recalculateCommitCCounter = () => {
        // TODO: how to set this when no ballots in acceptedCommited
        const min = Math.min(...acceptedCommited.map(x => x.counter), Number.MAX_SAFE_INTEGER)
        commit.cCounter = min;
    }

    const recalculateCommitHCounter = () => {
        const max = Math.max(...acceptedCommited.map(x => x.counter), 0)
        commit.hCounter = max;
    }

    const sendCommitMessage = () => {
        const payload = {
            message: commit,
            sender: self,
            type: "ScpCommit" as "ScpCommit",
            slices
        }
        const msg: ScpCommitEnvelope = {
            timestamp: Date.now(),
            ...payload
        }
        const h = hash(payload);
        if (!sent.includes(h)) {
            sent.push(h);
            broadcast(msg);
        }
    }

    const receiveCommit = (envelope: ScpCommitEnvelope) => {
        commitStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        checkCommitBallotAccept();
        checkCommitBallotConfirm();
        // TODO: SO far this only includes prepare messages, this needs to include commit msgs
        checkQuorumForCounter(() => commit.ballot.counter++);
        checkBlockingSetForCounter((value: number) => commit.ballot.counter = value);
        recalculatePreparedCounter();
        recalculateCommitCCounter();
        recalculateCommitHCounter();
        if (phase === 'COMMIT') sendCommitMessage();
    }

    const receive = (envelope: MessageEnvelope) => {
        // TODO: Find a better way to set the slices
        nodeSliceMap.set(envelope.sender, envelope.slices);
        switch (envelope.type) {
            case "ScpNominate": receiveNominate(envelope); break;
            case "ScpPrepare": receivePrepare(envelope); break;
            case "ScpCommit": receiveCommit(envelope); break;
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


    // TODO: also return promise with result of the slot
    return receive;
}