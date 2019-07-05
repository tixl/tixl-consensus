export type PublicKey = string;
export type Value = string;

export interface ScpSlices {
    threshold: number;
    validators: PublicKey[];
    innerSets?: ScpSlices[];
}

// export interface ScpSlices1 {
//     type: 'ScpSlices1',
//     threshold: number;
//     validators: PublicKey[];
//     innerSets: ScpSlices2[];
// }

// export interface ScpSlices2 {
//     type: 'ScpSlices2',
//     threshold: number;
//     validators: PublicKey[];
// }

// export type NestedScpSlices = ScpSlices | ScpSlices1 | ScpSlices2;

export interface ScpNominate {
    voted: Value[];
    accepted: Value[]
}

export interface ScpOther{
    someStuff: Value[]
}

export interface BaseMessageEnvelope {
    message: ScpNominate | ScpOther
    type: "ScpNominate" | "ScpOther"
    sender: PublicKey
    slices: ScpSlices
}

export interface ScpNominateEnvelope extends BaseMessageEnvelope {
    type: "ScpNominate",
    message: ScpNominate
}

export interface ScpOtherEnvelope extends BaseMessageEnvelope {
    type: "ScpOther",
    message: ScpOther
}

export type MessageEnvelope = ScpNominateEnvelope | ScpOtherEnvelope
