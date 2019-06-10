export default class Network {
    send: (obj: any) => void;
    
    constructor(send: (obj: any) => void) {
        this.send = send;
    }
}