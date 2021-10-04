"use strict"

function removeCharAt(str, idx) {
    idx = Math.min(str.length, idx)
    idx = Math.max(0, idx)
    return str.substr(0, idx) + str.substr(idx + 1, str.length)
}

function insertCharAt(str, added, idx) {
    idx = Math.min(str.length, idx)
    idx = Math.max(0, idx)
    return str.substr(0, idx) + added + str.substr(idx, str.length)
}


module.exports = {
    removeCharAt: removeCharAt,
    insertCharAt: insertCharAt
}
