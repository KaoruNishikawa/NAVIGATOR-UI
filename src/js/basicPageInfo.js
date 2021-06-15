"use strict"

const substituteSpan = (spanId, text) => {
    let element = document.getElementById(spanId)
    if (element) { element.innerText = text }
}

import { connected } from "./launch.js"
substituteSpan("serverAddress", connected())
