"use strict"

class ClientTerminal {
    /**
     * As a client, "node_modules/xterm/lib/xterm.js" should be inserted
     * in HTML since *bare import* doesn't work.
     * @param {WebSocket} ws - A websocket.
     * @param {Element} element - An element to attach the terminal.
     */

    constructor(ws, element) {
        this.term = new Terminal({
            cursorBlink: true,
            cursorStyle: "block",
            rendererType: "canvas",
            theme: {
                background: "#000"
            }
        });
        this.ws = ws;
        this.term.open(element)
        this.bindKeys()
        this.prompt()
    }

    currLine = ""

    bindKeys() {
        this.term.onKey(e => {
            const ev = e.domEvent;
            const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey

            if (ev.keyCode === 13) {
                if (this.currLine) {
                    this.runCommand()
                    this.term.write("\r\n")
                    /* display prompt? */
                }
            } else if (ev.keyCode === 8) {
                if (this.currLine) {
                    this.currLine = this.currLine.slice(0, this.currLine.length - 1);
                    this.term.write("\b \b")
                }
            } else if (printable) {
                this.currLine += e.key;
                this.term.write(e.key)
            }
        })
    }

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


class SystemStatus {

    constructor(ws, parent) {
        this.ws = ws;
        this.parent = parent;
    }

    terminalMaxLines = 999

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
        this.parent.scrollTo(0, 99999)
    }
}


let ws = new WebSocket('ws://192.168.11.6:4864/ws');

const elementTerminal = document.getElementById('mainTerminal');
const terminal = new ClientTerminal(ws, elementTerminal);

const elementStatus = document.getElementById('systemStatus');
const systemStatus = new SystemStatus(ws, elementStatus);

ws.onopen = (message) => {
    systemStatus.appendHTML("Connection established.", "warning")
}
ws.onmessage = (message) => {
    terminal.writeResponse(JSON.parse(message.data))
    // add other handlers
    systemStatus.appendHTML(`Got a response from server: ${JSON.parse(message.data).data}`)
}
ws.onclose = (message) => {
    systemStatus.appendHTML("Disconnected.", "error")
}
ws.onerror = (message) => {
    systemStatus.appendHTML(`ERROR: ${JSON.parse(message.data)}`, "error")
}

/* Button to disconnect */
disconnect.addEventListener("click", e => {
    ws.close()
    console.log("Disconnected.")
})
reconnect.addEventListener("click", e => {
    ws.open()
    console.log("Disconnected.")
})
