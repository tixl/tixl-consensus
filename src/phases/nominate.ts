import { ScpNominateEnvelope, Value, ValidationFunction } from '../types';
import { BroadcastFunction } from '../index';
import ProtocolState from '../ProtocolState';
import { quorumThreshold, blockingThreshold } from '../validateSlices';
import * as _ from 'lodash';

export const nominate = (
  state: ProtocolState,
  broadcast: BroadcastFunction,
  enterPreparePhase: () => void,
  validate: ValidationFunction,
) => {
  const log = (...args: any[]) => state.log(...args);

  const onNominateUpdated = () => {
    state.nominate.voted = state.nominate.voted.sort();
    // Changed this for test
    state.nominate.accepted = _.uniq([...state.nominate.accepted, ...state.confirmedValues]).sort();
    // if (state.phase !== 'NOMINATE') return;
    const msg: ScpNominateEnvelope = {
      slot: state.options.slot,
      type: 'ScpNominate' as 'ScpNominate',
      message: state.nominate,
      sender: state.options.self,
      slices: state.options.slices,
      timestamp: Date.now(),
    };
    broadcast(msg);
    state.nominateStorage.set(msg.sender, msg.message, msg.timestamp);
    msg.message.voted.forEach(transaction => state.TNMS.set(transaction, msg.sender, 'vote'));
    msg.message.accepted.forEach(transaction => state.TNMS.set(transaction, msg.sender, 'accept'));
  };

  const onConfirmedUpdated = () => {
    if (state.nominationTimeout) clearTimeout(state.nominationTimeout);
    log('Confirmed Nominates: ', state.confirmedValues.sort().join(' '));
    if (state.phase === 'NOMINATE') {
      enterPreparePhase();
    }
  };

  const addToVotes = (values: Value[]) => {
    if (state.confirmedValues.length === 0) {
      values.forEach(x => {
        if (!state.nominate.voted.includes(x) && !state.nominate.accepted.includes(x)) {
          state.nominate.voted.push(x);
          state.TNMS.set(x, state.options.self, 'vote');
        }
      });
      onNominateUpdated();
    }
  };

  const acceptNominates = (values: Value[]) => {
    values
      .filter(x => !state.nominate.accepted.includes(x))
      .forEach(x => {
        state.nominate.accepted.push(x);
        state.TNMS.set(x, state.options.self, 'accept');
      });
    _.remove(state.nominate.voted, y => values.includes(y));
    onNominateUpdated();
  };

  const confirmNominates = (values: Value[]) => {
    state.confirmedValues.push(...values);
    onNominateUpdated();
    onConfirmedUpdated();
    // send nominate message
  };

  const receiveNominate = (envelope: ScpNominateEnvelope) => {
    state.nominateStorage.set(envelope.sender, envelope.message, envelope.timestamp);
    envelope.message.voted.forEach(transaction => state.TNMS.set(transaction, envelope.sender, 'vote'));
    envelope.message.accepted.forEach(transaction => state.TNMS.set(transaction, envelope.sender, 'accept'));
    if (state.priorityNodes.includes(envelope.sender)) {
      const possibleTransactions = [...envelope.message.voted, ...envelope.message.accepted];
      const validTransactions: string[] = [];
      const promises = possibleTransactions.map(tx => {
        return validate(tx).then(isValid => {
          if (isValid) validTransactions.push(tx);
        });
      });
      Promise.all(promises).then(() => addToVotes(validTransactions));
    }
    const accepted = state.nominate.voted.filter(transaction => {
      const voteOrAccepts = state.TNMS.get(transaction, ['vote', 'accept']);
      return quorumThreshold(state.nodeSliceMap, voteOrAccepts, state.options.self);
    });
    const valuesThroughBlocked = envelope.message.accepted.filter(transaction => {
      const accepts = state.TNMS.get(transaction, ['accept']);
      return blockingThreshold(state.options.slices, accepts);
    });
    const allAccepted = _.uniq([...accepted, ...valuesThroughBlocked]);
    if (allAccepted.length) {
      acceptNominates(allAccepted);
    }
    const acceptedNotConfirmed = _.difference(state.nominate.accepted, state.confirmedValues);
    if (acceptedNotConfirmed.length) {
      const confirmed = acceptedNotConfirmed.filter(transaction => {
        const accepts = state.TNMS.get(transaction, ['accept']);
        return quorumThreshold(state.nodeSliceMap, accepts, state.options.self);
      });
      if (confirmed.length) {
        confirmNominates(confirmed);
      }
    }
  };

  return {
    receiveNominate,
    addToVotes,
  };
};
