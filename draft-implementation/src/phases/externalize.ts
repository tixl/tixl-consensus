import { ScpExternalizeEnvelope } from "../types";
import { ProtocolOptions, BroadcastFunction } from "../protocol";
import ProtocolState from '../ProtocolState';
import { hash } from "../helpers";
import * as _ from 'lodash';


export const externalize = (state: ProtocolState, options: ProtocolOptions, broadcast: BroadcastFunction, log: (...args: any[]) => void) => {
    const { self, slices } = options;
    const sent: bigint[] = [];

    const sendExternalizeMessage = () => {
        const payload = {
            message: state.externalize,
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
        state.phase = "EXTERNALIZE";
        log('entering EXTERNALIZE phase');
        state.externalize.commit = state.commit.ballot;
        state.externalize.hCounter = state.commit.ballot.counter;
        sendExternalizeMessage();
    }

    const receiveExternalize = (envelope: ScpExternalizeEnvelope) => {
        state.externalizeStorage.set(envelope.sender, envelope.message, envelope.timestamp);
    }

    return { receiveExternalize, enterExternalizePhase }
}