import uuid from 'uuid/v4';


export default class Topic {
    value: any;
    id: string
    constructor(value: any, id: string) {
        this.value = value;
        this.id = id;
    }

    static withId(value: any, id: string) {
        return new Topic(value, id);
    }

    static autoId(value: any) {
        return new Topic(value, uuid());
    }

    export() {
        return { value: this.value, id: this.id }
    }

    toString() {
        return JSON.stringify(this.value);
    }
}