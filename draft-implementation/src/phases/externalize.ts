import { ScpExternalizeEnvelope } from "../types";
import { BroadcastFunction } from "../protocol";
import ProtocolState from '../ProtocolState';
import * as _ from 'lodash';


export const externalize = (state: ProtocolState, broadcast: BroadcastFunction) => {

    const sendExternalizeMessage = () => {
        const msg: ScpExternalizeEnvelope = {
            message: state.externalize,
            sender: state.options.self,
            type: "ScpExternalize" as 'ScpExternalize',
            slices: state.options.slices,
            timestamp: Date.now(),

        }
        broadcast(msg);
    }

    const enterExternalizePhase = () => {
        state.phase = "EXTERNALIZE";
        state.log('entering EXTERNALIZE phase');
        state.externalize.commit = state.commit.ballot;
        state.externalize.hCounter = state.commit.ballot.counter;
        sendExternalizeMessage();
    }

    const receiveExternalize = (envelope: ScpExternalizeEnvelope) => {
        state.externalizeStorage.set(envelope.sender, envelope.message, envelope.timestamp);
    }

    return { receiveExternalize, enterExternalizePhase }
}