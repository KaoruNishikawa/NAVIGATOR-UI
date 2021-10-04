"use strict"

const utils = require("../utils/htmlUtils")
const data = require("../../config/repositories.json")

const tableDiv = document.getElementById("repository-table")
const table = document.createElement("table")
const tblBody = document.createElement("tbody")

const cmdModalWin = new utils.ModalWindow(
    document.getElementById("command-window")
)
const infoModalWin = new utils.ModalWindow(
    document.getElementById("info-window")
)

/* Click anywhere to hide the modal window */
window.onclick = (event) => {
    if (event.target.classList.contains("modal")) {
        cmdModalWin.hide()
        infoModalWin.hide()
    }
}

function createRow(repo_name) {
    const elements = []

    const name = document.createElement("td")
    const nameText = document.createElement("span")
    nameText.innerHTML = repo_name
    nameText.classList.add("link")
    nameText.onclick = () => {
        const commandField = document.getElementById("command-field")
        let command
        const installCommand = data[repo_name]["installation-command"]
        if (installCommand === null) {
            command = utils.quickCreateElement(
                "span",
                "Installation command not found."
            )
            commandField.classList.remove("command")
        } else {
            command = utils.quickCreateElement("code", installCommand)
            commandField.classList.add("command")
        }
        utils.replaceChild(commandField, command)
        cmdModalWin.show()
    }
    name.appendChild(nameText)
    name.classList.add("name")
    if (data[repo_name]["deprecated"]) {
        name.classList.add("deprecated")
    }
    elements.push(name)

    const description = document.createElement("td")
    description.innerHTML = data[repo_name]["description"]
    elements.push(description)

    const otherInfo = document.createElement("td")
    const otherInfoText = utils.quickCreateElement("span", "&#9432;")
    otherInfoText.classList.add("link", "bold")
    otherInfoText.onclick = () => {
        const infoField = document.getElementById("info-field")
        const infoText = new utils.AutoFormat(
            data[repo_name],
            ["category", "features", "simulator", "deprecated", "successor"]
        ).result
        utils.replaceChild(infoField, infoText)
        infoModalWin.show()
    }
    otherInfo.appendChild(otherInfoText)
    elements.push(otherInfo)

    const link = document.createElement("td")
    if (data[repo_name]["url"] !== data[repo_name]["github-url"]) {
        const linkButton = utils.quickCreateElement("span", "&#x2197;")
        linkButton.classList.add("bold")
        linkButton.onclick = () => {
            utils.openInBrowser(data[repo_name]["url"])
        }
        linkButton.classList.add("link")
        link.appendChild(linkButton)
    }
    elements.push(link)

    const githubLink = document.createElement("td")
    const githubLinkButton = document.createElement("img")
    githubLinkButton.src = "../assets/GitHub-Mark-120px-plus.png"
    githubLinkButton.onclick = () => {
        utils.openInBrowser(data[repo_name]["github-url"])
    }
    githubLinkButton.classList.add("link")
    githubLink.appendChild(githubLinkButton)
    elements.push(githubLink)

    return elements
}

for (const repository of Object.keys(data)) {
    const row = document.createElement("tr")
    const elements = createRow(repository)
    elements.forEach((element) => {
        row.appendChild(element)
    })
    tblBody.appendChild(row)
}
table.classList.add("center")
table.appendChild(tblBody)
tableDiv.appendChild(table)
