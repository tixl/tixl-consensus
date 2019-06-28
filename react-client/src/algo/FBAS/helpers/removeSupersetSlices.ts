import Slices from '../../common/Slices';
import { isSuperset } from './isSuperset';

export const removeSupersetSlices = (slicesObj: Slices): Slices => {
    const { slices } = slicesObj;
    const copy = new Set([...slices]);
    slices.forEach((a, aidx) => {
        slices.forEach((b, bidx) => {
            if (aidx === bidx) return;
            if (isSuperset(a, b)) {
                copy.delete(a);
            }
        })
    })
    return new Slices(copy);
}
