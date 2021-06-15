"use strict"

import { parseAddressParam } from "./utils.js"

let connect = () => {
    let serverIP = ""
    if (document.IpInputField.Address.value != "") {
        serverIP = escape(document.IpInputField.Address.value)
    }
    const param = "serverIP=" + serverIP
    location.href = "./index.html" + "?" + param
    return false
}
/* Enable the use of this function after webpack bundling */
window.connect = connect

export let connected = () => {
    let param = location.search
    if (!param) { return false }
    let serverIP = parseAddressParam(param)["serverIP"]
    return serverIP
}