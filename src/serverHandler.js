"use strict"

const os = require("os");
const pty = require("node-pty");
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
})

class commandHandler {

    constructor(conn, message, pty) {
        this.conn = conn;
        this.message = JSON.parse(message.data);
        this.pty = pty;
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
