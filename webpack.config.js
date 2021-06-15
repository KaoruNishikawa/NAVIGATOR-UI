"use strict"

const path = require("path")

module.exports = {
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
    entry: {
        main: "./src/js/terminal.js"
    },
    mode: "development",
    output: {
        path: path.join(__dirname, "dist"),
        filename: "terminal.js",
        clean: true
    },
    target: "node"
}
