export type PublicKey = string;
export type Value = string;

export interface ScpSlices {
    threshold: number;
    validators: PublicKey[];
    innerSets?: ScpSlices[];
}

export interface ScpNominate {
    voted: Value[];
    accepted: Value[]
}

export interface ScpBallot {
    value: Value[],
    counter: number
}

export interface ScpPrepare {
    ballot: ScpBallot       // current & highest prepare vote
    prepared: ScpBallot | null     // highest accepted prepared ballot
    aCounter: number        // lowest non-aborted ballot counter or 0
    hCounter: number        // h.counter or 0 if h == NULL
    cCounter: number        // c.counter or 0 if !c || !hCounter
}

export interface ScpCommit {
    ballot: ScpBallot;
    preparedCounter: number;
    hCounter: number;
    cCounter: number;
}

export interface BaseMessageEnvelope {
    message: ScpNominate | ScpPrepare | ScpCommit
    type: "ScpNominate" | "ScpPrepare" | "ScpCommit"
    sender: PublicKey
    slices: ScpSlices
    timestamp: number
}

export interface ScpNominateEnvelope extends BaseMessageEnvelope {
    type: "ScpNominate",
    message: ScpNominate
}

export interface ScpPrepareEnvelope extends BaseMessageEnvelope {
    type: "ScpPrepare"
    message: ScpPrepare
}

export interface ScpCommitEnvelope extends BaseMessageEnvelope {
    type: "ScpCommit",
    message: ScpCommit
}

export type MessageEnvelope = ScpNominateEnvelope | ScpPrepareEnvelope | ScpCommitEnvelope
