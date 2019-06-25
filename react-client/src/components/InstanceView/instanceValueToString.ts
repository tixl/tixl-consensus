export const instanceValueToString = (value: boolean | null) => {
    if (value === null) return 'n/a';
    if (value === true) return 'yes';
    else return 'false';
}