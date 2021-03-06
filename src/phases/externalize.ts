import { ScpExternalizeEnvelope } from '../types';
import { BroadcastFunction } from '../index';
import ProtocolState from '../ProtocolState';
import * as _ from 'lodash';
const log = require('debug')('tixl-consensus:debug');

export const externalize = (state: ProtocolState, broadcast: BroadcastFunction) => {
  const sendExternalizeMessage = () => {
    const msg: ScpExternalizeEnvelope = {
      slot: state.options.slot,
      message: state.externalize,
      sender: state.options.self,
      type: 'ScpExternalize' as 'ScpExternalize',
      slices: state.options.slices,
      timestamp: Date.now(),
    };
    broadcast(msg);
    receiveExternalize(msg);
  };

  const enterExternalizePhase = () => {
    state.counterTimeout && clearTimeout(state.counterTimeout);
    state.nominationTimeout && clearTimeout(state.nominationTimeout);
    state.phase = 'EXTERNALIZE';
    log('Entering Externalize Phase');
    state.externalize.commit = _.cloneDeep(state.commit.ballot);
    state.externalize.hCounter = _.cloneDeep(state.commit.ballot.counter);
    sendExternalizeMessage();
  };

  const receiveExternalize = (envelope: ScpExternalizeEnvelope) => {
    state.externalizeStorage.set(envelope.sender, envelope.message, envelope.timestamp);
  };

  return { receiveExternalize, enterExternalizePhase };
};
