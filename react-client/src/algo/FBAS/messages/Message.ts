import { VotingType } from "../FBASInstance";

export enum MessageStage {
    'VOTE' = 'VOTE',
    'ACCEPT' = 'ACCEPT',
    'CONFIRM' = 'CONFIRM'
}


export interface MessageArgs {
    votingId: string;
    slices: string[][],
    senderId: string,
    slotId: number,
    payload?: any,
    stage: MessageStage,
    value: boolean,
}


export interface MessageArgsWithType extends MessageArgs {
    votingType: VotingType
}

export const Message = ({ votingId, slices, senderId, slotId, payload, stage, votingType, value }: MessageArgsWithType) => ({
    votingId,
    slices,
    senderId,
    stage,
    slotId,
    votingType,
    payload,
    value
});

export type MessageReturnType = ReturnType<typeof Message>