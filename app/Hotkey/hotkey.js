"use strict"

const data = require("./hotkey.json")
const utils = require("../utils/htmlUtils")

const tableDiv = document.getElementById("hotkey-table")
const table = document.createElement("table")
const tblBody = document.createElement("tbody")

const osList = ["mac", "windows", "linux"]

const tableHeader = document.createElement("tr")
tableHeader.classList.add("tbl-header", "text-center")
const elements = [document.createElement("td")]
for (const os of osList) {
    const osCell = document.createElement("td")
    const osText = utils.quickCreateElement("span", os)
    osCell.appendChild(osText)
    elements.push(osCell)
}
elements.forEach((elem) => {
    tableHeader.appendChild(elem)
})
tblBody.appendChild(tableHeader)

function createRow(functionality) {
    const elements = []

    const name = utils.quickCreateElement("td", functionality)
    elements.push(name)

    for (const os of osList) {
        const key = document.createElement("td")
        const keyText = document.createElement("span")
        for (const k of data[functionality][os]) {
            const kText = utils.quickCreateElement("code", k)
            kText.classList.add("key")
            keyText.appendChild(kText)
        }
        key.appendChild(keyText)
        elements.push(key)
    }

    return elements
}

for (const functionality of Object.keys(data)) {
    const row = document.createElement("tr")
    const elements = createRow(functionality)
    elements.forEach((elem) => {
        row.appendChild(elem)
    })
    tblBody.appendChild(row)
}

table.appendChild(tblBody)
table.classList.add("center")
tableDiv.appendChild(table)
