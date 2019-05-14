// is a superset of b
export const isSuperset = <T>(a: Set<T>, b: Set<T>): boolean => {
    for (let val of b) {
        if (!a.has(val)) return false;
    }
    return true;
}