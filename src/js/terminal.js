"use strict"

import { connected } from "./launch.js"
import { AttachAddon } from "xterm-addon-attach"
import { Terminal } from "xterm"
import "xterm/css/xterm.css"

class ClientTerminal {
    /**
     * 
     * @param {WebSocket} ws - A websocket.
     * @param {Element} element - An element to attach the terminal.
     */

    constructor(url, element) {
        this.term = new Terminal({
            cols: 80,
            cursorBlink: true,
            cursorStyle: "block",
            rendererType: "canvas",
            theme: {
                background: "#000"
            }
        });
        this.history = new HistoryBuffer(199)
        console.log(this.history)
        this.url = url
        this.connectWebSocket(this.url)
        this.term.open(element)
        this.bindKeys()
        // const attachAddon = new AttachAddon(this.ws)
        // this.term.loadAddon(attachAddon)
        this.prompt()
        this.currLine = ""
        // this.localEcho = new LocalEchoController();
        // this.term.loadAddon(this.localEcho)
        // this.keysHandler()
    }

    connectWebSocket() {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = (message) => {
            systemStatus.appendHTML("Connection established.", "warning")
        }
        this.ws.onmessage = (message) => {
            terminal.writeResponse(JSON.parse(message.data))
            systemStatus.appendHTML(`Got a response from server: ${JSON.parse(message.data)}`)
        }
        this.ws.onclose = (message) => {
            systemStatus.appendHTML("Disconnected.", "error")
        }
        this.ws.onerror = (error) => {
            systemStatus.appendHTML(`ERROR: ${JSON.parse(error.data)}`, "error")
        }
    }

    // keysHandler() {
    //     this.localEcho.read("~$ ")
    //         .then(input => alert(`User entered: ${input}`))
    //         .catch(error => alert(`Error reading: ${error}`));
    // }

    bindKeys() {
        this.term.onKey(e => {
            const ev = e.domEvent;
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey

            const charCode = e.key.charCodeAt(0)

            if (ev.code === "Enter") {  /* handle enter key */
                if (this.currLine) {
                    this.history.push(this.currLine)
                    this.runCommand()
                    this.term.write("\r\n")
                } else {
                    this.term.write("\r\n")
                    this.prompt()
                }
            } else if (ev.code === "Backspace") {  /* handle backspace key */
                if (this.currLine) {
                    this.currLine = this.currLine.slice(0, this.currLine.length - 1)
                    this.term.write("\b \b")
                }
            } else if (charCode == 0x1b) {  /* handle arrow keys */
                let value = null
                switch (e.key.substr(1)) {
                    case "[A":  /* up arrow */
                        // clear current buffer
                        value = this.history.getPrevious()
                        console.log(this.history)
                        if (value) {
                            this.currLine = value
                            this.term.write(value)
                            // this.setInput(value)
                            // this.setCursor(value.length)
                        }
                        break;
                    case "[B": /* down arrow */
                        // clear current buffer
                        value = this.history.getNext()
                        if (value) {
                            this.currLine = value
                            this.term.write(value)
                        }
                        break;
                    case "[C":  /* right arrow */
                        this.moveCursor(1)
                        break;
                    case "[D":  /* left arrow */
                        this.moveCursor(-1)
                        break;
                    default:
                        break;
                }
            } else if (charCode < 32) {  /* ignore other control keys */
            } else if (printable && e.key) {  /* handle printable keys */
                this.currLine += e.key
                this.term.write(e.key)
            }
            // console.log(this.currLine)
        })
    }

    /**
     * Write the command to the xterm.
     * @param {string} input - A new line of input.
     */
    writeInput(input, clearInput = false) {
        if (clearInput) this.clearInput()
    }

    clearInput() { }

    setCursor(position) { }

    moveCursor(numLetters) { }

    prompt() {
        this.term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ")
    }

    writeResponse(message) {
        if (message.method === "command") {
            this.term.write(message.data + "\r\n")
        }
        // emit completed?
        this.prompt()
    }

    async runCommand() {
        if (this.currLine) {
            let message = {
                method: "command",
                data: this.currLine,
                time: Date.now(),
                ipAddress: 0
            };
            await this.ws.send(JSON.stringify(message))
            this.currLine = ""
            // await this.writeResponse()?
        } else {
            this.prompt()
        }
    }

}


/**
 * @class Buffer for terminal inputs.
 * This class is implemented based on https://github.com/wavesoft/local-echo/blob/8d0b7f55c5cf4b0b5f7c5132825dc5bd984bf017/lib/HistoryController.js
 */
class HistoryBuffer {

    /**
     * Creates an instance of history buffer.
     * @param {*} size - Size of the buffer.
     */
    constructor(size) {
        this.size = size
        this.entries = []
        this.cursor = 0
    }

    /**
     * Add new input to the buffer.
     * @param {string} entry - A new input to the terminal.
     */
    push(entry) {
        /* when empty */
        if (entry.trim() === "") return
        /* when same command */
        if (entry === this.entries[this.entries.length - 1]) return
        this.entries.push(entry)
        if (this.entries.length > this.size) {
            this.entries.pop(0)
        }
        this.cursor = this.entries.length
    }

    /**
     * Bring back the cursor to the latest.
     */
    rewind() {
        this.cursor = this.entries.length
    }

    /**
     * Get the previous input.
     * @returns {string} - Previous command.
     */
    getPrevious() {
        const idx = Math.max(0, this.cursor - 1)
        this.cursor = idx
        return this.entries[idx]
    }

    /**
     * Get the next input.
     * @returns {string} - Next command.
     */
    getNext() {
        const idx = Math.min(this.entries.length, this.cursor + 1)
        this.cursor = idx
        return this.entries[idx]
    }
}


class SystemStatus {

    constructor(terminalInstance, parent) {
        this.ws = terminalInstance.ws
        this.parent = parent;
        this.terminalMaxLines = 999
    }

    appendHTML(content, cls) {
        /* Create element */
        let newInput = document.createElement("span");
        newInput.innerText = content + '\n';
        if (cls) { newInput.className += cls; }
        // TODO: dump the input to the log file
        /* Write to the document */
        this.parent.appendChild(newInput)
        if (this.parent.childElementCount > this.terminalMaxLines) {
            this.parent.removeChild(this.parent.children[0])
        }
        /* Scroll to the bottom */
        this.parent.scrollTop = this.parent.scrollHeight
    }
}


const serverIP = connected()
const terminalURL = "ws://" + serverIP + "/mainterminal"

const elementTerminal = document.getElementById('mainTerminal');
const terminal = new ClientTerminal(terminalURL, elementTerminal);

const elementStatus = document.getElementById('systemStatus');
const systemStatus = new SystemStatus(terminal, elementStatus);

/* Button to disconnect and reconnect */
disconnect.addEventListener("click", e => {
    terminal.ws.close()
    console.log("Disconnected.")
})
reconnect.addEventListener("click", e => {
    terminal.connectWebSocket()
    console.log("Reconnection attempted.")
})
