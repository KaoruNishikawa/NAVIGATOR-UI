"use strict"

const $ = require("jQuery")

const { Terminal } = require("xterm")
const { LigaturesAddon } = require("xterm-addon-ligatures")
const { WebLinksAddon } = require("xterm-addon-web-links")

const { openInBrowser } = require("../utils/htmlUtils")


class TerminalClient {

    /**
     * Client-side implementation of terminal emulator.
     * For more about control sequences, see [https://xtermjs.org/docs/api/vtfeatures].
     * @param {string} parentID - ID of html element to attach this terminal.
     * @param {string} url - URL of PTY server.
     */
    constructor(parentID, url) {
        this.$parentDiv = $(parentID)
        const $terminalDiv = $(
            "<div>", { class: "nv-terminal" }
        ).appendTo(this.$parentDiv)
        const $monitorDiv = $(
            "<div>", { class: "nv-monitor" }
        ).appendTo(this.$parentDiv)

        this.term = new Terminal({
            cols: 80,
            cursorBlink: true,
            cursorStyle: "block",
            rendererType: "canvas",
            theme: { background: "#17184B" }
        })
        this.term.open($terminalDiv.get(0))
        this.term.loadAddon(
            new WebLinksAddon((event, url) => {
                event.preventDefault()
                openInBrowser(url)
            })
        )
        this.term.loadAddon(new LigaturesAddon())

        /* Adjust the field widths. */
        const terminalWidth = `${this.term.cols * 9}px`
        /* '9' is just an empirical value. */
        /* Should equal to $terminalDiv.find(".xterm-cursor-layer").width() */
        $terminalDiv.css("width", terminalWidth).css("width", "+=10px")
        $monitorDiv.css("width", terminalWidth).css("width", "+=10px")

        /* Attach terminal helpers and status monitor. */
        this.statusMonitor = new TerminalStatus($monitorDiv)
        this.history = new HistoryBuffer(999)
        this.currLine = new LineManager(this.term.cols)

        /* Initialize. */
        this.connectWebSocket(url)
        this.defineEventHandler()
        this.defineKeyHandler()
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

    defineEventHandler() {
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
                            _expr = this.currLine.insert(text, this.currLine.cursor)
                            this.term.write(_expr)
                        }
                    ).catch((err) => { console.log(err) })
                return false
            }
            return true
        })
    }

    defineKeyHandler() {
        this.term.onKey((e) => {
            const ev = e.domEvent
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey
            const charCode = e.key.charCodeAt(0)

            let _expr  /* String to write to terminal. */

            if (ev.code === "Enter") {  /* Enter */
                if (!this.currLine.isEmpty) {
                    this.history.push(this.currLine.text)
                    this.term.write(this.currLine.moveCursorToLineEnd())
                    this.term.write("\r\n")
                    this.runCommand()
                } else {
                    this.term.write("\r\n")
                    this.prompt()
                }
                this.history.resetCursor()
                this.currLine.reset()
            } else if (ev.code === "Backspace") {  /* Backspace */
                if (!this.currLine.isEmpty) {
                    _expr = this.currLine.remove(this.currLine.cursor - 1, true)
                    this.term.write(_expr)
                }
            } else if (ev.code === "Delete") {  /* Delete */
                if (!this.currLine.isEmpty) {
                    _expr = this.currLine.remove(this.currLine.cursor)
                    this.term.write(_expr)
                }
            } else if (charCode === 0x1b) {  /* Arrow */
                switch (e.key.substr(1)) {
                    case "[A":  /* Up */
                        if (
                            this.history.isReset
                            && !this.history.latestIs(this.currLine.text)
                        ) {
                            this.history.latch(this.currLine.text)
                        }
                        _expr = this.currLine.set(this.history.getPrevious())
                        this.term.write(_expr)
                        break
                    case "[B":  /* Down */
                        if (this.history.isReset) {
                            this.history.latch(this.currLine.text)
                        }
                        _expr = this.currLine.set(this.history.getNext())
                        this.term.write(_expr)
                        break
                    case "[C":  /* Right */
                        this.term.write(this.currLine.moveCursorBy(1))
                        break
                    case "[D":  /* Left */
                        this.term.write(this.currLine.moveCursorBy(-1))
                        break
                    default:
                        break
                }
            } else if (charCode < 32) {  /* Ignore other system keys. */
            } else if (printable && e.key) {
                this.history.resetCursor()
                _expr = this.currLine.insert(e.key, this.currLine.cursor)
                this.term.write(_expr)
            }
        })
    }

    prompt() {
        this.term.write("(xterm)$ ")
        this.currLine.setPromptLength("(xterm)$ ".length)
    }

    async loading() {
        for (const c of ["-", "/", "|", "\\"]) {
            const _expr = this.currLine.setPromptLength(c)
            this.term.write(_expr)
            await new Promise(resolve => setTimeout(resolve, 200))
        }
        this.term.write(this.currLine.termClearExpr)
    }

    clear() { this.term.reset() }

    earlyCtrlC() { }

    runCommand() {
        this.prompt()
    }

    writeResponse() { }
}


class LineManager {

    constructor(cols) {
        this.cols = cols
        this.text = ""
        this.cursor = 0
        this.latched = ""
        this.promptLength = 0
    }

    set(str) {
        const clearExpr = this.termClearExpr
        this.text = str
        this.cursor = str.length
        return clearExpr + this.termTextExpr
    }

    remove(idx, backspace = false) {
        const clearExpr = this.termClearExpr
        this.text = this.text.slice(0, idx) + this.text.slice(idx + 1)
        let suffixExpr = "\x1B8"
        if (backspace) { suffixExpr += this.moveCursorBy(-1) }
        return clearExpr + this.termTextExpr + suffixExpr
    }

    insert(str, idx) {
        const clearExpr = this.termClearExpr
        this.text = this.text.slice(0, idx) + str + this.text.slice(idx)
        const suffixExpr = "\x1B8" + this.moveCursorBy(str.length)
        return clearExpr + this.termTextExpr + suffixExpr
    }

    setPromptLength(len) { this.promptLength = len }

    get length() { return this.text.length }

    get numLines() { return Math.ceil((this.#actualLength + 1) / this.cols) }

    get #cursorLine() { return Math.floor(this.#actualCursor / this.cols) + 1 }

    get #actualLength() { return this.length + this.promptLength }

    get #actualCursor() { return this.cursor + this.promptLength }

    get #isOneLiner() { return this.#actualLength < this.cols }

    get termClearExpr() {
        const goToLastLine = "\x9B1E".repeat(this.numLines - this.#cursorLine)
        const erasers = "\x9B2K\x9B1F".repeat(this.numLines - 1)
        const firstLineEraser = `\r\x9B${this.promptLength}C\x9B0K`
        return "\x1B7" + goToLastLine + erasers + firstLineEraser
    }

    get termTextExpr() {
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
        return cursorUp + cursorDown + cursorLeft + cursorRight
    }

    moveCursorToLineEnd() {
        return this.moveCursorBy(this.length - this.cursor)
    }

    get isEmpty() { return this.text === "" }

    reset() {
        this.text = ""
        this.cursor = 0
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
