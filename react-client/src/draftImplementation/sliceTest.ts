// const Com = require('js-combinatorics');
// import { ScpSlices, NestedScpSlices } from './types';
// import { type } from 'os';
// const _ = require("lodash")

export { }

// interface Expandable {
//     type: "expandable",
//     values: (string[] | Expandable)[]
// }
// const Exp = (values: (string[] | Expandable)[]): Expandable => ({ type: 'expandable', values });

// const aSlices: ScpSlices = {
//     type: 'ScpSlices',
//     threshold: 3,
//     validators: ['A', 'B', 'C'],
//     innerSets: [{
//         type: 'ScpSlices1',
//         threshold: 3,
//         validators: ['D', 'E', 'F'],
//         innerSets: [{
//             type: 'ScpSlices2',
//             threshold: 2,
//             validators: ['G', 'H', 'I']
//         }]
//     }]
// }
// const toArray = (slices: NestedScpSlices): ((string[] | string)[] | string)[][] => {
//     switch (slices.type) {
//         case "ScpSlices2": return Com.combination(slices.validators, slices.threshold).toArray()
//         case "ScpSlices1": {
//             const exps = slices.innerSets.map(toArray);
//             const combinations = Com.combination([...slices.validators, ...exps], slices.threshold).toArray();
//             return combinations;
//         }
//         case "ScpSlices": {
//             const exps = slices.innerSets.map(toArray);
//             const combinations = Com.combination([...slices.validators, ...exps], slices.threshold).toArray();
//             return combinations;
//         }
//     }
// }

// const transformed = toArray(aSlices);
// // console.log(JSON.stringify(transformed, null, 2));
// console.log(transformed);
// console.log('expand')
// const expand = (x: ((string[] | string)[] | string)[]) => {
//     const ex = Com.cartesianProduct(...x).toArray()
//     console.log(ex);
//         if(ex.some(Array.isArray)){
//             return ex
//         }
//         else {
//             return _.flatten(ex);
//         }
//     // if(ex.some(Array.isArray)) return ex.map(expand);
//     return ex;
// }
// const expanded = transformed.map(expand)
// console.log('expanded')
// console.log(...expanded);
// // console.log(JSON.stringify(expanded, null, 2));
// // console.log(expanded);

// // console.log(JSON.stringify(toExpandable(aSlices),null,2));

// const combine = (xs: string[], yss: string[][]) => {
//     return yss.map(ys => [...xs, ...ys])
// }

// const r2 = Com.cartesianProduct('a', 'b', ['c', 'd', ['e', 'f']]).toArray();
// // console.log(r2)


// // const r1 = combine(['e', 'f'], [['a', 'b'], ['a', 'c'], ['b', 'c']])
// // console.log(r1)