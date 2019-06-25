export const arrayToString = (arr: string[] | string[][]): string => {
    if (arr.length === 0 ) return '';
    if (Array.isArray(arr[0])) return (arr as string[][]).map((subarr)=> subarr.join(' - ')).join(' | ')
    else return (arr as string[]).join(' - ');
}