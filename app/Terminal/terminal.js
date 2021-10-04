"use strict"

const { removeCharAt, insertCharAt } = require("../utils/strUtil")
var main = require("../main")
const { Terminal } = require("xterm")

class TerminalClient {
    /**
     * Client-side implementation of terminal emulator.
     * For more about control sequences, see [https://xtermjs.org/docs/api/vtfeatures/].
     * @param {string} parentID - ID of html element to attach this terminal.
     * @param {string} url - URL of PTY server.
    */

    constructor(parentID, url) {
        this.parentDiv = document.getElementById(parentID)
        let terminalDiv = document.createElement("div")
        let monitorDiv = document.createElement("div")
        terminalDiv.classList.add("terminal")
        monitorDiv.classList.add("monitor")
        this.parentDiv.appendChild(terminalDiv)
        this.parentDiv.appendChild(monitorDiv)

        this.term = new Terminal({
            cols: 80,
            cursorBlink: true,
            cursorStyle: "block",
            rendererType: "canvas",
            theme: {
                background: "#17184B"
            }
        })
        this.term.open(terminalDiv)
        this.statusMonitor = new TerminalStatus(monitorDiv)
        this.history = new HistoryBuffer(199)
        this.currLine = ""
        this.cursorInLine = 0
        this.url = url
        this.connectWebSocket(this.url)
        this.bindKeys()
        this.term.focus()
    }

    connectWebSocket(url) {
        this.ws = new WebSocket(url)
        this.ws.onopen = (msg) => {
            this.statusMonitor.append("Connection established.", "warning")
        }
        this.ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data)
            this.writeResponse(data)
            this.statusMonitor.append(`Got a response from server: ${data}`)
        }
        this.ws.onclose = (msg) => {
            this.statusMonitor.append("Disconnected.", "error")
        }
        this.ws.onerror = (err) => {
            this.statusMonitor.append(
                `ERROR: Connection to "${err.target.url}" failed.`, "error"
            )
        }
    }

    bindKeys() {
        this.term.attachCustomKeyEventHandler(e => {
            if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                e.preventDefault()
                window.navigator.clipboard.readText()
                    .then(
                        text => {
                            this.currLine = insertCharAt(this.currLine, text, this.cursorInLine)
                            this.writeInput(text)
                            this.cursorInLine += text.length
                        }
                    ).catch(
                        error => console.error(error)
                    )
                return false
            }
            return true
        })
        this.term.onKey(e => {
            const ev = e.domEvent
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey

            const charCode = e.key.charCodeAt(0)

            if (ev.code === "Enter") {  /* Enter key */
                if (this.currLine) {
                    this.history.push(this.currLine)
                    this.history.resetCursor()
                    this.runCommand()
                    this.term.write("\r\n")
                } else {
                    this.term.write("\r\n")
                    this.prompt()
                }
                this.cursorInLine = 0
            } else if (ev.code === "Backspace") {  /* Backspace key */
                if (this.currLine) {
                    this.currLine = removeCharAt(this.currLine, this.cursorInLine - 1)
                    this.cursorInLine -= 1
                    this.backspace()
                }
            } else if (ev.code === "Delete") {  /* Delete key */
                if (this.currLine) {
                    this.currLine = removeCharAt(this.currLine, this.cursorInLine)
                    this.delete()
                }
            } else if (ev === 0) {
                this.earlyCtrlC()
            } else if (ev === 0) {
                this.paste()
            } else if (charCode == 0x1b) {  /* Arrow keys */
                let value
                switch (e.key.substr(1)) {
                    case "[A":  /* Up arrow */
                        value = this.history.getPrevious()
                        this.currLine = value
                        this.writeInput(value, true)
                        this.cursorInLine = this.currLine.length
                        break
                    case "[B":  /* Down arrow */
                        value = this.history.getNext()
                        this.currLine = value
                        this.writeInput(value, true)
                        this.cursorInLine = this.currLine.length
                        break
                    case "[C":  /* Right arrow */
                        this.moveCursor(1)
                        break
                    case "[D":  /* Left arrow */
                        this.moveCursor(-1)
                        break
                    default:
                        break
                }
            } else if (charCode < 32) {  /* Ignore other control keys */
            } else if (printable && e.key) {
                this.currLine = insertCharAt(this.currLine, e.key, this.cursorInLine)
                this.writeInput(e.key)
                this.cursorInLine += 1
            }
        })
    }

    prompt() { }

    writeInput(input, clear = false) {
        if (clear) { this.clearLine() }
        this.term.write(`\x9B1@${input}`)
        // handle this.cursorInLine and update this.currLine
        // handle over-80 characters input
    }

    clearLine() {
        // handle multi line element
        this.term.write("\x1b[2K\r")
    }

    clearTerm() { this.term.reset() }

    runCommand() {
        // send this.currLine to server
        // this.ws.send(...)
        this.currLine = ""
    }

    writeResponse() {
        // this.term.onData(...) -> constructor?
        // Write return from server
    }

    moveCursor(by) {
        by = Math.max(0, this.cursorInLine + by) - this.cursorInLine
        by = Math.min(this.cursorInLine + by, this.currLine.length) - this.cursorInLine
        if (by > 0) {
            this.term.write(`\x9B${by}C`)
        } else if (by < 0) {
            this.term.write(`\x9B${Math.abs(by)}D`)
        }
        this.cursorInLine += by
    }

    backspace() { this.term.write("\b\x9B1P") }

    delete() { this.term.write("\x9B1P") }

    earlyCtrlC() { }

    attachAndResume() {
        // when html is loaded and previous data exist,
        // attach this terminal to html element, then display previous data
    }
}


class HistoryBuffer {

    constructor(size) {
        this.size = size
        this.entries = []
        this.cursor = 0
    }

    push(entry) {
        /* when empty */
        if (entry.trim() === "") { return }
        /* when same command */
        if (entry === this.entries[this.entries.length - 1]) { return }
        /* otherwise */
        this.entries.push(entry)
        if (this.entries.length > this.size) {
            this.entries.pop(0)
        }
        this.resetCursor()
    }

    resetCursor() {
        this.cursor = this.entries.length
    }

    getPrevious() {
        const idx = Math.max(0, this.cursor - 1)
        this.cursor = idx
        return this.entries[this.cursor]
    }

    getNext() {
        if (this.cursor + 1 >= this.entries.length) {
            this.resetCursor()
            return ""
        } else {
            const idx = Math.min(this.entries.length, this.cursor + 1)
            this.cursor = idx
            return this.entries[this.cursor]
        }
    }
}


class TerminalStatus {

    constructor(monitorDiv) {
        this.monitorField = monitorDiv
        this.maxLines = 999
    }

    append(data, cls) {
        const msg = document.createElement("span")
        msg.innerText = data + "\n"
        if (cls) { msg.classList.add(cls) }
        this.monitorField.appendChild(msg)
        if (this.monitorField.childElementCount > this.maxLines) {
            this.monitorField.removeChild(this.monitorField.children[0])
        }
        this.monitorField.scrollTop = this.monitorField.scrollHeight
    }
}


const serverIP = main.serverIP || "localhost"
const terminalURL = "ws://" + serverIP + "/terminal"
new TerminalClient("term", terminalURL)
