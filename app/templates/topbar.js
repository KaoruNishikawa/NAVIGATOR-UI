"use strict"

const topBarContainer = document.getElementsByClassName("topnav")[0]
const fieldList = [
    "Terminal", "Controller", "Monitor", "Repository", "Hotkey"
]

for (const field of fieldList) {
    const link = document.createElement("a")
    link.classList.add("navlink")
    link.innerHTML = field
    link.href = `../${field}/${field.toLowerCase()}.html`
    if (document.title == field) {
        link.classList.add("this-page")
    }
    topBarContainer.appendChild(link)
}
