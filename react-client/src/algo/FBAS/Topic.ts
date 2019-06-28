import uuid from 'uuid/v4';


export default class Topic {
    value: Object;
    id: string
    constructor(value: Object) {
        this.value = value;
        this.id = uuid();
    }

    export() {
        return this.value;
    }

    toString(){
        return JSON.stringify(this.value);
    }
}