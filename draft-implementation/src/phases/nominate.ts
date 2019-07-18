import { ScpNominateEnvelope, Value } from "../types";
import { BroadcastFunction } from "../protocol";
import ProtocolState from '../ProtocolState';
import { quorumThreshold, blockingThreshold } from "../validateSlices";
import * as _ from 'lodash';


export const nominate = (state: ProtocolState, broadcast: BroadcastFunction, enterPreparePhase: () => void) => {
    const log = (...args: any[]) => state.log(...args);
    
    const onNominateUpdated = () => {
        state.nominate.voted = state.nominate.voted.sort()
        state.nominate.accepted = state.nominate.accepted.sort()
        if (state.phase !== 'NOMINATE') return;
        const msg: ScpNominateEnvelope = {
            type: "ScpNominate" as "ScpNominate",
            message: state.nominate,
            sender: state.options.self,
            slices: state.options.slices,
            timestamp: Date.now(),
        }
        broadcast(msg)
    }

    const onConfirmedUpdated = () => {
        if (state.nominationTimeout) clearTimeout(state.nominationTimeout);
        log('Confirmed: ', state.confirmedValues.sort().join(' '))
        if (state.phase === 'NOMINATE') {
            enterPreparePhase();
        }
    }

    const addToVotes = (values: Value[]) => {
        if (state.confirmedValues.length === 0) {
            values.forEach(x => {
                if (!state.nominate.voted.includes(x) && !state.nominate.accepted.includes(x)) {
                    state.nominate.voted.push(x);
                    state.TNMS.set(x, state.options.self, 'vote')
                }
            });
            onNominateUpdated();
        }
    };

    const acceptNominates = (values: Value[]) => {
        values.filter(x => !state.nominate.accepted.includes(x)).forEach(x => {
            state.nominate.accepted.push(x);
            state.TNMS.set(x, state.options.self, 'accept')
        });
        _.remove(state.nominate.voted, y => values.includes(y));
        onNominateUpdated();
    };

    const confirmNominates = (values: Value[]) => {
        state.confirmedValues.push(...values);
        onConfirmedUpdated();
    }

    const receiveNominate = (envelope: ScpNominateEnvelope) => {
        envelope.message.voted.forEach(transaction => state.TNMS.set(transaction, envelope.sender, 'vote'))
        envelope.message.accepted.forEach(transaction => state.TNMS.set(transaction, envelope.sender, 'accept'))
        if (state.priorityNodes.includes(envelope.sender)) {
            // TODO: Check validity of values
            addToVotes([...envelope.message.voted, ...envelope.message.accepted]);
        }
        const accepted = state.nominate.voted.filter(transaction => {
            const voteOrAccepts = state.TNMS.get(transaction, ['vote', 'accept']);
            return quorumThreshold(state.nodeSliceMap, voteOrAccepts, state.options.self);
        })
        const valuesThroughBlocked = envelope.message.accepted.filter(transaction => {
            const accepts = state.TNMS.get(transaction, ['accept']);
            return blockingThreshold(state.options.slices, accepts);
        })
        const allAccepted = _.uniq([...accepted, ...valuesThroughBlocked]);
        if (allAccepted.length) {
            acceptNominates(allAccepted);
        }
        const acceptedNotConfirmed = _.difference(state.nominate.accepted, state.confirmedValues);
        if (acceptedNotConfirmed.length) {
            const confirmed = acceptedNotConfirmed.filter(transaction => {
                const accepts = state.TNMS.get(transaction, ['accept']);
                return quorumThreshold(state.nodeSliceMap, accepts, state.options.self);
            })
            if (confirmed.length) {
                confirmNominates(confirmed)
            }
        }
    }

    return {
        receiveNominate,
        addToVotes
    };
}