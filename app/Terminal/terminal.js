"use strict"

const $ = require("jQuery")
// var main = require("../main")
const { Terminal } = require("xterm")
const { LigaturesAddon } = require("xterm-addon-ligatures")
const { SerializeAddon } = require("xterm-addon-serialize")
const { WebLinksAddon } = require("xterm-addon-web-links")
const { Unicode11Addon } = require("xterm-addon-unicode11")


class TerminalClient {

    /**
     * Client-side implementation of terminal emulator.
     * For more about control sequences, see [https://xtermjs.org/docs/api/vtfeatures/].
     * @param {string} parentID - ID of html element to attach this terminal, .
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
            theme: { background: "#17184B" }
        })
        this.term.open($terminalDiv.get(0))
        // this.term.loadAddon(new WebLinksAddon())
        // this.term.loadAddon(new SerializeAddon())
        // this.term.loadAddon(new LigaturesAddon())
        // this.term.loadAddon(new Unicode11Addon())

        /* Adjust the field widths. */
        const terminalWidth = `${this.term.cols * 9}px`
        /* '9' is just an empirical value */
        /* Should equal to $terminalDiv.find(".xterm-cursor-layer").width() */
        $terminalDiv.css("width", terminalWidth).css("width", "+=10px")
        $monitorDiv.css("width", terminalWidth).css("width", "+=10px")

        /* Attach terminal helpers and status monitor. */
        this.statusMonitor = new TerminalStatus($monitorDiv)
        this.history = new HistoryBuffer(999)
        this.currLine = new LineManager(this.term.cols)

        /* Initialize. */
        this.connectWebSocket(url)
        this.addEventHandler()
        this.addKeyHandler()
        this.term.focus()
        this.prompt()
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

    addEventHandler() {
        let _expr
        this.term.attachCustomKeyEventHandler((e) => {
            if (e.ctrlKey && e.key === "c") {
                e.preventDefault()
                this.earlyCtrlC()
                return false
            } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                e.preventDefault()
                window.navigator.clipboard.readText()
                    .then(
                        (text) => {
                            this.term.write(this.clearLine)
                            _expr = this.currLine.insert(text, this.currLine.cursor)
                            this.term.write(_expr)
                        }
                    ).catch((error) => { console.error(error) })
                return false
            }
            return true
        })
    }

    breakLine() { this.term.write("\r\n") }

    addKeyHandler() {
        this.term.onKey((e) => {
            /* Japanese input cannot be supported through onKey method.
             Consider using attachCustomKeyEventHandler like above. */
            const ev = e.domEvent
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey
            const charCode = e.key.charCodeAt(0)

            let _expr  /* String to write to terminal. */

            if (ev.code === "Enter") {  /* Enter key */
                if (!this.currLine.empty) {
                    this.history.push(this.currLine.text)
                    this.breakLine()
                    this.runCommand()
                } else {
                    this.breakLine()
                    this.prompt()
                }
                this.history.resetCursor()
                this.currLine.reset()
            } else if (ev.code === "Backspace") {  /* Backspace key */
                if (!this.currLine.empty) {
                    this.term.write(this.clearLine)
                    _expr = this.currLine.remove(this.currLine.cursor - 1, true)
                    this.term.write(_expr)
                }
            } else if (ev.code === "Delete") {  /* Delete key */
                if (!this.currLine.empty) {
                    this.term.write(this.clearLine)
                    _expr = this.currLine.remove(this.currLine.cursor)
                    this.term.write(_expr)
                }
            } else if (charCode == 0x1b) {  /* Arrow keys */
                switch (e.key.substr(1)) {
                    case "[A":  /* Up arrow */
                        if (this.history.isReset && !this.history.latestIs(this.currLine.text)) {
                            this.history.latch(this.currLine.text)
                        }
                        this.term.write(this.clearLine)
                        _expr = this.currLine.set(this.history.getPrevious())
                        this.term.write(_expr)
                        break
                    case "[B":  /* Down arrow */
                        if (this.history.isReset) {
                            this.history.latch(this.currLine.text)
                        }
                        this.term.write(this.clearLine)
                        _expr = this.currLine.set(this.history.getNext())
                        this.term.write(_expr)
                        break
                    case "[C":  /* Right arrow */
                        this.term.write(this.currLine.moveCursorBy(1))
                        break
                    case "[D":  /* Left arrow */
                        this.term.write(this.currLine.moveCursorBy(-1))
                        break
                    default:
                        break
                }
            } else if (charCode < 32) {  /* Ignore other control keys */
            } else if (printable && e.key) {
                this.history.resetCursor()
                this.term.write(this.clearLine)
                _expr = this.currLine.insert(e.key, this.currLine.cursor)
                this.term.write(_expr)
            }
            console.log(this.currLine.cursor, this.currLine.text)
        })
    }

    prompt() {
        this.term.write("(xterm)$ ")
        this.currLine.setPromptLength("(xterm)$ ".length)
    }

    async loading() {
        for (const c of ["-", "/", "|", "\\"]) {
            this.term.write(this.clearLine)
            const _expr = this.currLine.set(c)
            this.term.write(_expr)
            await new Promise(resolve => setTimeout(resolve, 200))
        }
        this.term.write(this.clearLine)
    }

    get clearLine() { return this.currLine.termClearExpr }

    clearTerm() { this.term.reset() }

    runCommand() {
        // send this.currLine to server
        // this.ws.send(...)
        this.currLine.reset()
        this.prompt()
    }

    writeResponse() {
        // this.term.onData(...) -> constructor?
        // Write return from server
    }

    earlyCtrlC() { }
}


class LineManager {

    constructor(cols) {
        this.cols = cols
        this.text = ""
        this.cursor = 0
        this.promptLength = 0
    }

    setPromptLength(len) { this.promptLength = len }

    append(str) {
        this.text += str
        this.cursor += str.length
    }

    insert(str, idx) {
        this.text = this.text.slice(0, idx) + str + this.text.slice(idx)
        this.cursor += str.length
        return this.termExpr + this.termCursorBackExpr
    }

    remove(idx, backspace = false) {
        this.text = this.text.slice(0, idx) + this.text.slice(idx + 1)
        if (backspace) { this.cursor -= 1 }
        return this.termExpr + this.termCursorBackExpr
    }

    set(str) {
        this.text = str
        this.cursor = this.text.length
        return this.termExpr
    }

    replace(str) { return this.set(str) }

    get numLines() {
        return Math.max(1, Math.ceil(this.#actualLength / this.cols))
    }

    get isLastCol() { return this.#actualCursor % this.cols === this.cols - 1 }

    get length() { return this.text.length }

    get #actualLength() { return this.text.length + this.promptLength }

    get #actualCursor() { return this.cursor + this.promptLength }

    get #isOneLiner() { return this.#actualLength <= this.cols }

    get #numCurrLine() {
        return Math.max(1, Math.ceil(this.#actualCursor / this.cols))
    }

    get empty() { return this.text.length === 0 }

    reset() {
        this.text = ""
        this.cursor = 0
    }

    moveCursorBy(num) {
        const from = [
            this.#actualCursor % this.cols,
            Math.floor(this.#actualCursor / this.cols)
        ]
        this.cursor += num
        this.cursor = Math.min(Math.max(0, this.cursor), this.text.length)
        const to = [
            this.#actualCursor % this.cols,
            Math.floor(this.#actualCursor / this.cols)
        ]
        const diff = [to[0] - from[0], to[1] - from[1]]
        const cursorUp = diff[1] < 0 ? `\x9B${Math.abs(diff[1])}A` : ""
        const cursorDown = diff[1] > 0 ? `\x9B${diff[1]}B` : ""
        const cursorRight = diff[0] > 0 ? `\x9B${diff[0]}C` : ""
        const cursorLeft = diff[0] < 0 ? `\x9B${Math.abs(diff[0])}D` : ""
        console.log(this.numLines, cursorLeft + cursorUp + cursorDown + cursorRight)
        return cursorUp + cursorDown + cursorLeft + cursorRight
    }

    get termCursorBackExpr() {
        const to = [
            this.#actualCursor % this.cols,
            Math.floor(this.#actualCursor / this.cols)
        ]
        let from = [
            this.#actualLength % this.cols,
            Math.floor(this.#actualLength / this.cols)
        ]
        console.log(from, to)
        const diff = [to[0] - from[0], to[1] - from[1]]
        const cursorUp = diff[1] < 0 ? `\x9B${Math.abs(diff[1])}A` : ""
        const cursorRight = diff[0] > 0 ? `\x9B${diff[0]}C` : ""
        const cursorLeft = diff[0] < 0 ? `\x9B${Math.abs(diff[0])}D` : ""
        console.log(this.numLines, cursorLeft + cursorUp + cursorRight)
        return cursorUp + cursorLeft + cursorRight
    }

    get termClearExpr() {
        const goToLastLine = "\x9B1E".repeat(this.numLines - this.#numCurrLine)
        const erasers = "\x9B2K\x9B1F".repeat(this.numLines - 1)
        const firstLineEraser = `\r\x9B${this.promptLength}C\x9B0K`
        console.log(this.numLines, goToLastLine + erasers + firstLineEraser)
        return goToLastLine + erasers + firstLineEraser
    }

    get termExpr() {
        let lines
        if (this.#isOneLiner) {
            lines = [this.text]
        } else {
            /* First line */
            lines = [this.text.slice(0, this.cols - this.promptLength)]
            /* The rest */
            const rest = this.text.slice(this.cols - this.promptLength)
            const lengthMatcher = new RegExp(`.{1,${this.cols}}`, "g")
            lines = lines.concat(rest.match(lengthMatcher))
        }
        return lines.join("\r\n")
    }
}


class HistoryBuffer {

    /**
     * Keep the commands executed.
     * @param {number} size - Number of commands to be kept in this buffer.
     */
    constructor(size) {
        this.size = size
        this.entries = []
        this.cursor = 0
        this.latched = ""
    }

    push(entry) {
        /* When empty */
        if (entry.trim() === "") { return }
        /* When same as previous */
        if (entry === this.entries[this.entries.length - 1]) { return }
        /* Otherwise */
        this.entries.push(entry)
        if (this.entries.length > this.size) {
            this.entries = this.entries.slice(1, this.entries.length)
        }
        this.resetCursor()
    }

    resetCursor() { this.cursor = this.entries.length }

    get isReset() { return this.cursor === this.entries.length }

    get length() { return this.entries.length }

    latch(str) { this.latched = str }

    latestIs(str) { return this.entries[-1] === str }

    getPrevious() {
        if (this.entries.length === 0) { return this.latched }
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
        $("<br>").appendTo(this.$monitorField)
        if (cls) { $msg.addClass(cls) }
        if (this.$monitorField.children().length > this.maxLines) {
            this.$monitorField.remove(this.$monitorField.first())
        }
        this.$monitorField.scrollTop(this.$monitorField.prop("scrollHeight"))
    }
}


const serverIP = "localhost:4864"
const terminalURL = "ws://" + serverIP + "/terminal"
const a = new TerminalClient("#nv-terminal-field", terminalURL)
$("#nv-add-terminal").on("click", (event) => {
    new TerminalClient("#nv-terminal-field", terminalURL)
})
