"use strict"

const { app, BrowserWindow } = require("electron")
const path = require("path")


function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        // icon:
        show: false,
        paintWhenInitiallyHidden: true,
        backgroundColor: "#FFF",
        webPreferences: {
            nodeIntegration: true,  // *1
            sandbox: false,  // *1
            contextIsolation: false,  // *1
            nativeWindowOpen: true
        }
        /*
         *1: Only this setting allows the scripts which are loaded on
             html files to use CommonJS.
        */
    })
    mainWindow.once("ready-to-show", () => {
        mainWindow.show()
    })

    mainWindow.loadFile(path.join(__dirname, "Splash", "splash.html"))
}

app.on("ready", createWindow)

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
})

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
