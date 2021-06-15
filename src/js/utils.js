"use strict"

export let parseAddressParam = (params) => {
    if (params[0] === "?") { params = params.substring(1) }
    let paramPairs = params.split("&")
    let parsedParam = {}
    for (let param of paramPairs) {
        let keyValue = param.split("=")
        parsedParam[unescape(keyValue[0])] = unescape(keyValue[1])
    }
    return parsedParam
}