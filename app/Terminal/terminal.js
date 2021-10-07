"use strict"

const $ = require("jQuery")
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
        this.$parentDiv = $(parentID)
        let $terminalDiv = $("<div>", { class: "nv-terminal" }).appendTo(this.$parentDiv)
        let $monitorDiv = $("<div>", { class: "nv-monitor" }).appendTo(this.$parentDiv)

        this.term = new Terminal({
            cols: 80,
            cursorBlink: true,
            cursorStyle: "block",
            rendererType: "canvas",
            theme: {
                background: "#17184B"
            }
        })
        this.term.open($terminalDiv.get(0))

        let terminalWidth = $terminalDiv.find(".xterm-cursor-layer").width()
        terminalWidth *= 1.015  /* 1.015 is a magic factor */
        // console.log(terminalWidth)
        $terminalDiv.css("width", terminalWidth).css("width", "+=10px")
        $monitorDiv.css("width", terminalWidth).css("width", "+=10px")

        this.statusMonitor = new TerminalStatus($monitorDiv)
        this.history = new HistoryBuffer(199)
        this.currLine = ""
        this.cursorInLine = 0

        /* Initialize. */
        this.connectWebSocket(url)
        this.bindKeys()
        this.term.focus()
    }

    connectWebSocket(url) {
        this.ws = new WebSocket(url)
        this.ws.onopen = (msg) => {
            this.statusMonitor.append("Connection established.", "nv-warning")
        }
        this.ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data)
            this.writeResponse(data)
            this.statusMonitor.append(`Got a response from server: ${data}`)
        }
        this.ws.onclose = (msg) => {
            this.statusMonitor.append("Disconnected.", "nv-error")
        }
        this.ws.onerror = (err) => {
            this.statusMonitor.append(
                `ERROR: Connection to "${err.target.url}" failed.`, "nv-error"
            )
        }
    }

    bindKeys() {
        this.term.attachCustomKeyEventHandler(e => {
            if (e.ctrlKey && e.key === "c") {
                e.preventDefault()
                this.earlyCtrlC()
                return false
            } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                e.preventDefault()
                window.navigator.clipboard.readText()
                    .then(
                        (text) => {
                            this.currLine = insertCharAt(this.currLine, text, this.cursorInLine)
                            this.writeInput(text)
                            this.cursorInLine += text.length
                        }
                    ).catch(
                        (error) => { console.error(error) }
                    )
                return false
            }
            return true
        })
        this.term.onKey(e => {
            /* Japanese input cannot be supported through onKey method.
             Consider using attachCustomKeyEventHandler like above if needed. */
            const ev = e.domEvent
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey

            const charCode = e.key.charCodeAt(0)

            if (ev.code === "Enter") {  /* Enter key */
                if (this.currLine) {
                    this.history.push(this.currLine)
                    this.runCommand()
                    this.term.write("\r\n")
                } else {
                    this.term.write("\r\n")
                    this.prompt()
                }
                this.history.resetCursor()
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
            } else if (charCode == 0x1b) {  /* Arrow keys */
                let value
                switch (e.key.substr(1)) {
                    case "[A":  /* Up arrow */
                        if (this.history.isReset && this.history.entries[-1] !== this.currLine) {
                            this.history.latch(this.currLine)
                        }
                        value = this.history.getPrevious()
                        this.currLine = value
                        this.writeInput(value, true)
                        this.cursorInLine = this.currLine.length
                        break
                    case "[B":  /* Down arrow */
                        if (this.history.isReset) {
                            this.history.latch(this.currLine)
                        }
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
                this.history.resetCursor()
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
        this.term.write("\x9B2K\r")
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

    /**
     * Buffer which keeps the commands executed.
     * @param {number} size - Number of commands to be kept in this buffer.
     */
    constructor(size) {
        this.size = size
        this.entries = []
        this.cursor = 0
        this.latched = ""
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

    resetCursor() { this.cursor = this.entries.length }

    get isReset() {
        return this.cursor === this.entries.length
    }

    latch(str) { this.latched = str }

    getPrevious() {
        if (this.entries.length === 0) { return "" }
        const idx = Math.max(0, this.cursor - 1)
        this.cursor = idx
        return this.entries[this.cursor]
    }

    getNext() {
        if (this.cursor + 1 >= this.entries.length) {
            this.resetCursor()
            return this.latched
        } else {
            const idx = Math.min(this.entries.length, this.cursor + 1)
            this.cursor = idx
            return this.entries[this.cursor]
        }
    }
}


class TerminalStatus {

    /**
     * 
     * @param {typeof $("<div>")} $monitorDiv - An html element to attach status console.
     */
    constructor($monitorDiv) {
        this.$monitorField = $monitorDiv
        this.maxLines = 3
    }

    append(data, cls) {
        const $msg = $("<span>", { text: data }).appendTo(this.$monitorField)
        if (cls) { $msg.addClass(cls) }
        if (this.$monitorField.children().length > this.maxLines) {
            this.$monitorField.remove(this.$monitorField.first())
        }
        this.$monitorField.scrollTop(this.$monitorField.prop("scrollHeight"))
        $("<br>").appendTo(this.$monitorField)
    }
}


const serverIP = main.serverIP || "localhost:4864"
const terminalURL = "ws://" + serverIP + "/terminal"
new TerminalClient("#nv-terminal-field", terminalURL)
$("#nv-add-terminal").on("click", e => {
    new TerminalClient("#nv-terminal-field", terminalURL)
})
