// return a without the nodes in b = A - B
export const setDifference = <T>(a: Set<T>, b: Set<T>): Set<T> => {
    const copy = new Set([...a.values()]);
    for (let val of b) {
        if (a.has(val)) copy.delete(val);
    }
    return copy;
}