"use strict"

const { webFrame } = require("electron")

function parseQuery(url) {
    if (url.indexOf("?") == -1) {
        return {}
    }
    const query = {}
    const queryString = url.split("?")[1]
    const queryList = queryString.split("&")
    for (const q of queryList) {
        const kvPair = q.split("=")
        query[kvPair[0]] = kvPair[1] || ""
    }
    return query
}

function attachQuery(url, kvPairs) {
    let query = url.indexOf("?") == -1 ? "&" : "?"
    for (const key of Object.keys(kvPairs)) {
        query += `${key}=${kvPairs[key]}`
    }
    return url + query
}

function setZoomFactor(url) {
    const zoomFactor = parseQuery(url)["zoom"] || 1
    webFrame.setZoomFactor(zoomFactor)
}

module.exports = {
    parseQuery: parseQuery,
    attachQuery: attachQuery,
    setZoomFactor: setZoomFactor
}
