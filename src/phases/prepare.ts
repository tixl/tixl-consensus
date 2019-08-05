import { ScpBallot, ScpPrepareEnvelope } from "../types";
import { BroadcastFunction, } from "../protocol";
import ProtocolState from '../ProtocolState';
import { hashBallot, isBallotLower, hashBallotValue, infinityCounter } from "../helpers";
import { quorumThreshold, blockingThreshold } from "../validateSlices";
import * as _ from 'lodash';

export const prepare = (state: ProtocolState, broadcast: BroadcastFunction, enterCommitPhase: () => void) => {
    const log = (...args: any[]) => state.log(...args);

    const checkPrepareBallotAcceptQuorum = (ballot: ScpBallot) => {
        const ballotHash = hashBallot(ballot);
        const voteOrAccept = state.prepareStorage.getAllValuesAsArary()
            .filter(p => hashBallot(p.ballot) === ballotHash || (p.prepared && hashBallot(p.prepared) === ballotHash))
        const commitVotes = state.commitStorage.getAllValuesAsArary()
            .filter(c => hashBallot({ counter: infinityCounter, value: c.ballot.value }) === ballotHash || hashBallot({ counter: c.preparedCounter, value: c.ballot.value }) === ballotHash);
        const externalizeVotes = state.externalizeStorage.getAllValuesAsArary()
            .filter(e => hashBallot({ counter: infinityCounter, value: e.commit.value }) === ballotHash);
        const signers = [...voteOrAccept, ...commitVotes, ...externalizeVotes].map(p => p.node);
        if (quorumThreshold(state.nodeSliceMap, signers, state.options.self)) {
            state.addAcceptedPrepared(ballot) && log('Accept Prepare (Quorum)', ballot)
        }
    }

    const checkPrepareBallotAcceptBlockingSet = (ballot: ScpBallot) => {
        const ballotHash = hashBallot(ballot);
        const ballotValueHash = hashBallotValue(ballot)
        const commitAccepts = state.commitStorage.getAllValuesAsArary()
            .filter(c => c.ballot && hashBallot({ counter: c.preparedCounter, value: c.ballot.value }) === ballotHash);
        const externalizes = state.externalizeStorage.getAllValuesAsArary()
            .filter(e => e.commit && hashBallotValue(e.commit) === ballotValueHash);
        const acceptPrepares = state.prepareStorage.getAllValuesAsArary()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash);
        const nodes = [...acceptPrepares, ...commitAccepts, ...externalizes].map(p => p.node);
        if (blockingThreshold(state.options.slices, nodes)) {
            state.addAcceptedPrepared(ballot) && log('Accept Prepare (Blocking Set)', ballot)
        }
    }

    const checkPrepareBallotAcceptCommit = () => {
        if (!state.prepare.prepared) return;
        const ballotValueHash = hashBallotValue(state.prepare.prepared)
        const n = state.prepare.prepared.counter;
        const prepareCommitVotes = state.prepareStorage.getAllValuesAsArary()
            .filter(x => hashBallotValue(x.ballot) === ballotValueHash && (x.cCounter <= n && n <= x.hCounter));
        const commits = state.commitStorage.getAllValuesAsArary()
            // accept commit for cCounter <= n <= hCounter && vote for n >= cCounter result in no restrictions for counters 
            .filter(x => hashBallotValue(x.ballot) === ballotValueHash && n <= x.hCounter);
        const externalizes = state.externalizeStorage.getAllValuesAsArary()
            .filter(x => hashBallotValue(x.commit) === ballotValueHash && n >= x.commit.counter);
        const signersVoteOrAccept = [...prepareCommitVotes, ...commits, ...externalizes].map(x => x.node);
        if (quorumThreshold(state.nodeSliceMap, signersVoteOrAccept, state.options.self)) {
            state.addAcceptedCommited(state.prepare.prepared!) && log('Accept Commit (Quorum) ', state.prepare.prepared)
        }

        const commitAccepts = state.commitStorage.getAllValuesAsArary()
            .filter(x => hashBallotValue(x.ballot) === ballotValueHash && x.cCounter <= n && n <= x.hCounter);
        const signersAccept = [...commitAccepts, ...externalizes].map(x => x.node);
        if (blockingThreshold(state.options.slices, signersAccept)) {
            state.addAcceptedCommited(state.prepare.prepared) && log('Accept Commit (Blocking Set) ', state.prepare.prepared)
        }
    }


    const checkPrepareBallotConfirm = (ballot: ScpBallot) => {
        const ballotHash = hashBallot(ballot);
        const acceptPrepares = state.prepareStorage.getAllValuesAsArary()
            .filter(p => p.prepared && hashBallot(p.prepared) === ballotHash)
            .map(p => p.node);
        const commits = state.commitStorage.getAllValuesAsArary()
            .filter(c => hashBallot({ counter: c.preparedCounter, value: c.ballot.value }) === ballotHash || hashBallot({ counter: c.hCounter, value: c.ballot.value }) === ballotHash)
            .map(c => c.node);
        const externalizes = state.externalizeStorage.getAllValuesAsArary()
            .filter(e => hashBallotValue(e.commit) === hashBallotValue(ballot))
            .map(e => e.node);
        const signers = _.uniq([...acceptPrepares, ...commits, ...externalizes]);
        if (quorumThreshold(state.nodeSliceMap, signers, state.options.self)) {
            state.addConfirmedPrepared(ballot) && log('Confirm Prepare (Quorum)', ballot);
        }
    }

    const recalculatePrepareBallotValue = (): void => {
        //  If any ballot has been confirmed prepared, then "ballot.value"
        // is taken to to be "h.value" for the highest confirmed prepared ballot "h". 
        const highestConfirmed = state.getHighestConfirmedPreparedBallot();
        if (highestConfirmed) {
            state.prepare.ballot.value = _.cloneDeep(highestConfirmed.value);
            return;
        }
        // Otherwise (if no such "h" exists), if one or more values are
        // confirmed nominated, then "ballot.value" is taken as the output
        // of the deterministic combining function applied to all
        // confirmed nominated values.
        if (state.confirmedValues.length) {
            state.prepare.ballot.value = _.cloneDeep(state.confirmedValues);
            return;
        }

        // Otherwise, if no ballot is confirmed prepared and no value is
        // confirmed nominated, but the node has accepted a ballot
        // prepared (because "prepare(b)" meets blocking threshold for
        // some ballot "b"), then "ballot.value" is taken as the value of
        // the highest such accepted prepared ballot.
        const highestAccepted = state.getHighestAcceptedPreparedBallot();
        if (highestAccepted) {
            state.prepare.ballot.value = _.cloneDeep(highestAccepted.value)
            return;
        }
        return;
    }

    const recalculatePreparedField = (): void => {
        // log('Accepted prepared', state.acceptedPrepared);

        //  or NULL if no ballot has been accepted prepared. 
        // if (state.acceptedPrepared.length === 0) state.prepare.prepared = null;
        // The highest accepted prepared ballot not exceeding the "ballot" field
        const highest = state.getHighestAcceptedPreparedBallot();
        if (!highest) {
            state.prepare.prepared = null;
            return;
        }
        if (isBallotLower(state.prepare.ballot, highest)) {
            state.prepare.prepared = { value: _.cloneDeep(highest.value), counter: state.prepare.ballot.counter - 1 }
        }
        else {
            state.prepare.prepared = _.cloneDeep(highest);
        }
        log('Set prepare field to ', state.prepare.prepared)
        // const ballotsLowerOrEqualThanPrepare = state.acceptedPrepared.filter(b => isBallotLowerOrEqual(b, state.prepare.ballot))
        // if (ballotsLowerOrEqualThanPrepare.length) {
        //     const highestAcceptedPreparedBallotNotExceedingBallotField =
        //         ballotsLowerOrEqualThanPrepare.reduce((acc, b) => {
        //             if (isBallotLower(acc, b)) acc = b;
        //             return acc;
        //         })
        //     state.prepare.prepared = highestAcceptedPreparedBallotNotExceedingBallotField!;
        //     if (state.prepare.ballot.value.length < state.prepare.prepared.value.length && state.prepare.ballot.counter === state.prepare.prepared.counter) {
        //         state.prepare.prepared.counter = state.prepare.ballot.counter - 1;
        //         // Note:  it is not possible to vote to commit a ballot with counter 0.
        //     }
        // }
    }

    const recalculateACounter = (oldPrepared: ScpBallot | null) => {
        if (!oldPrepared) return;
        if (hashBallotValue(oldPrepared) !== hashBallotValue(state.prepare.prepared)) {
            if (oldPrepared.value.length < state.prepare.prepared!.value.length) {
                state.prepare.aCounter = oldPrepared.counter;
            }
            else {
                state.prepare.aCounter = oldPrepared.counter + 1;
            }
        }
    }

    const recalculateHCounter = () => {
        const highestConfirmed = state.getHighestConfirmedPreparedBallot();
        if (highestConfirmed && hashBallotValue(highestConfirmed) === hashBallotValue(state.prepare.ballot)) {
            state.prepare.hCounter = highestConfirmed.counter;
        }
        else {
            state.prepare.hCounter = 0;
        }
    }

    const updateCommitBallot = () => {
        if ((state.commitBallot && isBallotLower(state.commitBallot, state.prepare.prepared!) && hashBallotValue(state.prepare.prepared) !== hashBallotValue(state.commitBallot))
            || state.prepare.aCounter > state.prepare.cCounter) {
            log('Reset commit ballot')
            state.commitBallot = null;
        }
        if (state.commitBallot === null && state.prepare.hCounter === state.prepare.ballot.counter) {
            state.commitBallot = _.cloneDeep(state.prepare.ballot);
            log('Set commit ballot to ', state.commitBallot)
        }
    }

    const recalculateCCounter = () => {
        updateCommitBallot();
        if (state.commitBallot === null || state.prepare.hCounter === 0) { state.prepare.cCounter = 0; }
        else { state.prepare.cCounter = state.commitBallot.counter; }
    }

    const checkCounterBlockingSet = () => {
        const currentCounter = state.prepare.ballot.counter;
        if (currentCounter === infinityCounter) return false;
        const fromPrepare = state.prepareStorage.getAllValuesAsArary().filter(x => x.ballot.counter > currentCounter);
        const fromCommit = state.commitStorage.getAllValuesAsArary().filter(x => x.ballot.counter > currentCounter);
        const fromExternalize = state.externalizeStorage.getAllValuesAsArary();
        const hasExternalizeMessage = fromExternalize.length > 0
        const counters = [...fromPrepare.map(x => x.ballot.counter), ...fromCommit.map(x => x.ballot.counter)];
        const nodes = [...fromPrepare, ...fromCommit, ...fromExternalize].map(x => x.node)
        if (blockingThreshold(state.options.slices, nodes)) {
            const minCounter = hasExternalizeMessage ? Math.min(...counters, infinityCounter) : Math.min(...counters);
            log(`Found blocking set for timers: increase from ${state.prepare.ballot.counter} to ${minCounter}`)
            state.prepare.ballot.counter = minCounter;
            checkCounterBlockingSet(); // do recursively
            return true;
        } else {
            return false;
        }
    }

    const armQuorumCounterTimer = () => {
        const currentCounter = state.prepare.ballot.counter;
        log('Arming timer for current counter ', currentCounter)
        if (state.counterTimeout) clearTimeout(state.counterTimeout);
        state.counterTimeout = setTimeout(() => {
            log(`Timer fired for counter ${state.prepare.ballot.counter}: increasing to ${state.prepare.ballot.counter + 1}`)
            state.prepare.ballot.counter++;
            onBallotCounterChange();
            doPrepareUpdate();
        }, (currentCounter + 1) * 1000)
    }

    const checkCounterQuorum = () => {
        const currentCounter = state.prepare.ballot.counter;
        const fromPrepare = state.prepareStorage.getAllValuesAsArary().filter(x => x.ballot.counter >= currentCounter);
        const fromCommit = state.commitStorage.getAllValuesAsArary().filter(x => x.ballot.counter >= currentCounter);
        const fromExternalize = state.externalizeStorage.getAllValuesAsArary();
        const nodes = [...fromPrepare, ...fromCommit, ...fromExternalize].map(x => x.node)
        if (quorumThreshold(state.nodeSliceMap, nodes, state.options.self)) {
            armQuorumCounterTimer();
        }
    }

    const checkUpdateCounter = () => {
        if (checkCounterBlockingSet()) {
            onBallotCounterChange();
            doPrepareUpdate();
            state.counterTimeout && clearTimeout(state.counterTimeout)
        }
        checkCounterQuorum();
    }

    const onBallotCounterChange = () => {
        recalculatePrepareBallotValue();
    }

    const sendPrepareMessage = () => {
        const msg: ScpPrepareEnvelope = {
            slot: state.options.slot,
            message: state.prepare,
            sender: state.options.self,
            type: "ScpPrepare" as 'ScpPrepare',
            slices: state.options.slices,
            timestamp: Date.now(),
        }
        broadcast(msg);
        receivePrepare(msg);
    }

    const checkEnterCommitPhase = () => {
        // FIXME: A node leaves the PREPARE phase and proceeds to the COMMIT phase when
        // there is some ballot "b" for which the node confirms "prepare(b)" and
        // accepts "commit(b)"
        if (state.confirmedPrepared.length > 0 && state.acceptedCommitted.length > 0) {
            enterCommitPhase();
        }
    }

    const enterPreparePhase = () => {
        state.phase = 'PREPARE'
        log('Entering Prepare Phase')
        state.prepare.ballot.value = _.clone(state.confirmedValues);
        sendPrepareMessage();
    }

    const checkMessageStatesForPrepare = () => {
        checkPrepareBallotAcceptQuorum(state.prepare.ballot);
        checkPrepareBallotAcceptBlockingSet(state.prepare.ballot);
        if (state.lastReceivedPrepareEnvelope) {
            checkPrepareBallotAcceptBlockingSet(state.lastReceivedPrepareEnvelope.message.ballot);
        }
        // checkPrepareBallotAccept(envelope.message.ballot);
        if (state.prepare.prepared) {
            checkPrepareBallotConfirm(state.prepare.prepared);
        }
        checkPrepareBallotAcceptCommit();
    }

    // TODO: Include Counter limit logic
    // FIXME: execute this stuff when receiving message
    const receivePrepare = (envelope: ScpPrepareEnvelope) => {
        state.prepareStorage.set(envelope.sender, envelope.message, envelope.timestamp);
        state.lastReceivedPrepareEnvelope = _.cloneDeep(envelope);

    }

    const doPrepareUpdate = () => {
        checkUpdateCounter();
        const oldPrepared = _.cloneDeep(state.prepare.prepared);
        recalculatePreparedField();
        if (hashBallotValue(oldPrepared) !== hashBallotValue(state.prepare.prepared)) {
            recalculateACounter(oldPrepared);
        }
        recalculateHCounter();
        recalculateCCounter();
        sendPrepareMessage();
        checkEnterCommitPhase();
    }

    return {
        receivePrepare,
        enterPreparePhase,
        doPrepareUpdate,
        checkMessageStatesForPrepare
    }
}