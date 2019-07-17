import { ScpNominate, ScpSlices, Value, PublicKey, MessageEnvelope, ScpNominateEnvelope, ScpPrepare, ScpPrepareEnvelope, ScpBallot, ScpCommit, ScpCommitEnvelope, ScpExternalize, ScpExternalizeEnvelope } from './types';
import { getNeighbors, getPriority } from './neighbors';
import * as _ from 'lodash';
import TransactionNodeMessageStorage from './TransactionNodeMessageStorage';
import { quorumThreshold, blockingThreshold } from './validateSlices';
import { hash, isBallotLower, hashBallot, hashBallotValue } from './helpers';
import { GenericStorage } from './GenericStorage';

export type BroadcastFunction = (envelope: MessageEnvelope) => void;

const maxVal = 100000;

export interface ProtocolOptions {
    self: PublicKey
    slices: ScpSlices
    suggestedValues: Value[],
    slot: number;
}

export type Phase = 'NOMINATE' | 'PREPARE' | 'COMMIT' | 'EXTERNALIZE';

const baseTimeoutValue = 1000;
const timeoutValue = 1000;

export const protocol = (broadcast: BroadcastFunction, options: ProtocolOptions) => {
    const { self, slices, suggestedValues, slot } = options;
    const log = (...args: any[]) => console.log(`${self}: `, ...args);
    // const log = (...args: any[]) => { return args };

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
    const prepareStorage = new GenericStorage<ScpPrepare>();
    const commitStorage = new GenericStorage<ScpCommit>();
    const externalizeStorage = new GenericStorage<ScpExternalize>();
    const acceptedPrepared: ScpBallot[] = [];
    const confirmedPrepared: ScpBallot[] = [];
    let commitBallot: ScpBallot | null = null;
    const acceptedCommitted: ScpBallot[] = [];
    const confirmedCommitted: ScpBallot[] = [];

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
        cCounter: 0,
    }

    const externalize: ScpExternalize = {
        commit: { counter: 1, value: [] },
        hCounter: 0,
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
        phase = 'PREPARE'
        log('Entering Prepare Phase')
        prepare.ballot.value = confirmedValues;
        sendPrepareMessage();
    }

    const onConfirmedUpdated = () => {
        clearTimeout(nominationTimeout);
        log('Confirmed: ', confirmedValues.sort().join(' '))
        if (phase === 'NOMINATE') {
            enterPreparePhase();
        }
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
            // TODO: Check validity of values
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
        const votersFormPrepare = prepareStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter && (p.ballot.counter >= prepare.ballot.counter))
            .map(p => p.node);
        const votersFromCommit = commitStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter && (p.ballot.counter >= prepare.ballot.counter))
            .map(p => p.node);
        const votersFromExternalize = externalizeStorage.getAllValuesAsArary().map(p => p.node);
        const votersWithCounterEqualOrAbove = _.uniq([...votersFormPrepare, ...votersFromCommit, ...votersFromExternalize]);
        const isQuorum = quorumThreshold(nodeSliceMap, votersWithCounterEqualOrAbove, self);
        if (isQuorum) armTimer(increaseFunc);
    }

    const checkBlockingSetForCounter = (setFunc: (value: number) => void) => {
        const preparesWithCounterAbove = prepareStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter > prepare.ballot.counter);
        const commitsWithCounterAbove = commitStorage.getAllValuesAsArary()
            .filter(p => p.ballot.counter > prepare.ballot.counter);
        const externalizesWithCounterAbove = externalizeStorage.getAllValuesAsArary(); // externalize implicitly has counter Infinity
        const nodesWithCounterAbove = _.uniq([...preparesWithCounterAbove, ...commitsWithCounterAbove, ...externalizesWithCounterAbove].map(x => x.node));
        const isBlockingSet = blockingThreshold(slices, nodesWithCounterAbove);
        if (isBlockingSet) {
            const counters = [...preparesWithCounterAbove.map(p => p.ballot.counter), ...commitsWithCounterAbove.map(p => p.ballot.counter)];
            const lowestCounter = Math.min(...counters, maxVal);
            log('Found a blocking set with lowest counter ', lowestCounter)
            clearTimeout(prepareTimeout);
            setFunc(lowestCounter);
            // TODO: Rework this step, this might be inefficient
            let findsAnotherBlockingSet = false;
            if (lowestCounter !== maxVal) {
                findsAnotherBlockingSet = checkBlockingSetForCounter(setFunc);
            }
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
            log('ACCEPT prepare ballot', b.counter, b.value.join(' '));
            acceptedPrepared.push(b);
        }
        if (prepare.prepared === null || isBallotLower(prepare.prepared, b)) {
            prepare.prepared = b;
        }
        if (isBallotLower(prepare.ballot, b)) {
            prepare.ballot = b;
        }
    }

    const confirmPrepareBallot = (b: ScpBallot) => {
        const h = hashBallot(b);
        if (!confirmedPrepared.find(x => hashBallot(x) === h)) {
            log('CONFIRM prepare ballot', b.counter, b.value.join(' '));
            confirmedPrepared.push(b);
        }
    }

    const checkPrepareBallotAccept = (ballot: ScpBallot) => {
        // FIXME: What if we're already at another ballot
        // Track other ballots
        // TODO: include all the messages from above
        const ballotHash = hashBallot(ballot);
        const voteOrAccept = prepareStorage.getAllValuesAsArary()
            .filter(p => hashBallot(p.ballot) === ballotHash || (p.prepared && hashBallot(p.prepared) === ballotHash))
            .map(p => p.node);
        // log({ voteOrAccept })
        if (quorumThreshold(nodeSliceMap, voteOrAccept, self)) {
            acceptPrepareBallot(prepare.ballot);
        }
        const acceptPrepares = prepareStorage.getAllValuesAsArary()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash);
        const commits = commitStorage.getAllValuesAsArary()
            .filter(c => c.ballot && hashBallot(c.ballot) === ballotHash);
        const externalizes = externalizeStorage.getAllValuesAsArary()
            .filter(e => e.commit && hashBallot(e.commit) === ballotHash);
        const nodes = [...acceptPrepares, ...commits, ...externalizes].map(p => p.node);
        // log({ accepts })
        if (blockingThreshold(slices, nodes)) {
            acceptPrepareBallot(ballot);
        }
    }

    const checkPrepareBallotConfirm = (ballot: ScpBallot) => {
        // FIXME: include other messages
        const ballotHash = hashBallot(ballot);
        const acceptPrepares = prepareStorage.getAllValuesAsArary()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash)
            .map(p => p.node);
        const commits = commitStorage.getAllValuesAsArary()
            .filter(c => hashBallot({ counter: c.preparedCounter, value: c.ballot.value }) === ballotHash || hashBallot({ counter: c.hCounter, value: c.ballot.value }) === ballotHash)
            .map(c => c.node);
        const externalizes = externalizeStorage.getAllValuesAsArary()
            .filter(e => hashBallotValue(e.commit) === hashBallotValue(ballot))
            .map(e => e.node);
        const signers = _.uniq([...acceptPrepares, ...commits, ...externalizes]);
        if (quorumThreshold(nodeSliceMap, signers, self)) {
            confirmPrepareBallot(ballot);
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
        log({ confirmedPrepared, confirmedValues })
        //  If any ballot has been confirmed prepared, then "ballot.value"
        // is taken to to be "h.value" for the highest confirmed prepared ballot "h". 
        const highestConfirmed = getHighestConfirmedPreparedBallot();
        if (highestConfirmed) {
            log('found highest confirmed')
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

    const checkEnterCommitPhase = () => {
        if (confirmedPrepared.length) {
            enterCommitPhase();
        }
    }

    // TODO: Include Counter limit logic
    const receivePrepare = (envelope: ScpPrepareEnvelope) => {
        prepareStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        checkPrepareBallotAccept(prepare.ballot);
        checkPrepareBallotAccept(envelope.message.ballot);
        if (prepare.prepared) {
            checkPrepareBallotConfirm(prepare.prepared);
        }
        if (phase === "PREPARE") {

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
            sendPrepareMessage();
            checkEnterCommitPhase();
        }
    }

    const acceptCommitBallot = (ballot: ScpBallot) => {
        const h = hashBallot(ballot);
        if (!acceptedCommitted.find(x => hashBallot(x) !== h)) {
            acceptedCommitted.push(ballot)
        }
    }

    const confirmCommitBallot = (ballot: ScpBallot) => {
        const h = hashBallot(ballot);
        if (confirmedCommitted.find(x => hashBallot(x) === h) === undefined) {
            log('!!!!!!!!!!!!!!!!!!!!!!!!!!')
            log('CONFIRMED BALLOT ', ballot.counter, ballot.value.join(' '))
            confirmedCommitted.push(ballot)
        }
    }

    const checkCommitBallotAccept = () => {
        const votesOrAccepts = commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(commit.ballot) && (c.cCounter >= commit.ballot.counter && c.hCounter <= commit.ballot.counter))
                // votes
                || (hashBallotValue(c.ballot) === hashBallotValue(commit.ballot) && commit.ballot.counter >= c.cCounter)
            ).map(c => c.node);
        if (quorumThreshold(nodeSliceMap, votesOrAccepts, self)) {
            acceptCommitBallot(commit.ballot);
        }
        const accepts = commitStorage.getAllValuesAsArary()
            .filter(c =>
                // accepts
                (hashBallotValue(c.ballot) === hashBallotValue(commit.ballot) && (c.cCounter >= commit.ballot.counter && c.hCounter <= commit.ballot.counter))
            ).map(c => c.node);
        if (blockingThreshold(slices, accepts)) {
            acceptCommitBallot(commit.ballot);
        }
    }

    const checkCommitBallotConfirm = () => {
        const accepts = commitStorage.getAllValuesAsArary()
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
        if (acceptedCommitted.length) {
            const min = Math.min(...acceptedCommitted.map(x => x.counter))
            commit.cCounter = min;
        }
        else {
            commit.cCounter = 0;
        }

    }

    const recalculateCommitHCounter = () => {
        const max = Math.max(...acceptedCommitted.map(x => x.counter), 0)
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

    const checkEnterExternalizePhase = () => {
        if (confirmCommitBallot.length) {
            enterExternalizePhase();
        }
    }

    const receiveCommit = (envelope: ScpCommitEnvelope) => {
        commitStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        checkCommitBallotAccept();
        checkCommitBallotConfirm();
        if (phase === 'COMMIT') {
            checkQuorumForCounter(() => commit.ballot.counter++);
            checkBlockingSetForCounter((value: number) => commit.ballot.counter = value);
            recalculatePreparedCounter();
            recalculateCommitCCounter();
            recalculateCommitHCounter();
            sendCommitMessage();
            checkEnterExternalizePhase();
        }
    }

    const sendExternalizeMessage = () => {
        const payload = {
            message: externalize,
            sender: self,
            type: "ScpExternalize" as 'ScpExternalize',
            slices
        }
        const msg: ScpExternalizeEnvelope = {
            ...payload,
            timestamp: Date.now(),
        }
        const h = hash(payload);
        if (!sent.includes(h)) {
            sent.push(h);
            broadcast(msg);
        }
    }

    const enterExternalizePhase = () => {
        phase = "EXTERNALIZE";
        log('entering EXTERNALIZE phase');
        externalize.commit = commit.ballot;
        externalize.hCounter = commit.ballot.counter;
        sendExternalizeMessage();
    }

    const receiveExternalize = (envelope: ScpExternalizeEnvelope) => {
        externalizeStorage.set(envelope.sender, envelope.message, envelope.timestamp);
    }

    const receive = (envelope: MessageEnvelope) => {
        // TODO: Find a better way to set the slices
        nodeSliceMap.set(envelope.sender, envelope.slices);
        switch (envelope.type) {
            case "ScpNominate": receiveNominate(envelope); break;
            case "ScpPrepare": receivePrepare(envelope); break;
            case "ScpCommit": receiveCommit(envelope); break;
            case "ScpExternalize": receiveExternalize(envelope); break;
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
    const init = () => {
        determinePriorityNode();
    }


    // TODO: also return promise with result of the slot
    return { receive, init };
}