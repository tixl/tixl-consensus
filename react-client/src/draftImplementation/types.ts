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
