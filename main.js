"use strict"

const { app, BrowserWindow } = require("electron")
const path = require("path")

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "src/js/preload.js"),
            // preload: "./src/js/preload.js",
            contextIsolation: true
        }
    })
    win.loadFile("static/launch.html")
}

app.whenReady().then(() => {
    createWindow()
    app.on("active", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
})