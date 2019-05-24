export default class Topic {
    value: string;
    constructor(value: string) {
        this.value = value;
    }

    export() {
        return this.value;
    }
}