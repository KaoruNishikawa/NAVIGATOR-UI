"use strict"

class commandHandler {

    constructor(conn, message) {
        this.conn = conn;
        this.message = JSON.parse(message.data);
        this.verifyMessage()
    }

    verifyMessage() {
        let method = this.message.method;
        if (method === "command") {
            this.conn.socket.send(JSON.stringify(this.message))  // replace with PTY handler
        }  // else if (possibly) other methods
        //return sth?
    }

    // need cleaner
}

module.exports = commandHandler
