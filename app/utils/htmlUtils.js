"use strict"

function openInBrowser(url) {
    const { shell } = require("electron")
    shell.openExternal(url)
}

class ModalWindow {
    constructor(element) {
        this.element = element
        this.hide()
        this.element.classList.add("modal")
    }
    show() {
        this.element.style.display = "block"
    }
    hide() {
        this.element.style.display = "none"
    }
}

class AutoFormat {
    constructor(dataObj, fields) {
        this.data = dataObj
        this.fields = fields
        this.container = document.createElement("div")
        this.emptyElem = document.createElement("span")
    }
    get result() {
        for (const field of this.fields) {
            const df = this.data[field]
            let ret
            if (df instanceof Array) {
                ret = this.formatArray(field, df)
                this.container.appendChild(ret)
            } else if (typeof df === "boolean") {
                ret = this.formatBoolean(field, df)
                const firstChild = this.container.firstChild
                if (firstChild == null) { this.container.appendChild(this.emptyElem) }
                if (ret != null) { this.container.insertBefore(ret, firstChild) }
            } else if (df !== null) {
                ret = this.formatOther(field, df)
                this.container.appendChild(ret)
            }
        }
        return this.container
    }
    formatArray(title, data) {
        const ret = document.createElement("div")
        ret.appendChild(this.createTitle(title))
        const content = document.createElement("ul")
        for (const element of data) {
            const li = document.createElement("li")
            li.innerHTML = element
            content.appendChild(li)
        }
        ret.appendChild(content)
        return ret
    }
    formatBoolean(title, data) {
        if (!data) { return null }
        const batch = document.createElement("span")
        batch.classList.add(title, "batch")
        batch.innerHTML = title
        return batch
    }
    formatOther(title, data) {
        const ret = document.createElement("div")
        ret.appendChild(this.createTitle(title))
        const content = document.createElement("p")
        content.innerHTML = data
        ret.appendChild(content)
        return ret
    }
    createTitle(title) {
        const title_elem = document.createElement("h3")
        title_elem.innerHTML = title
        return title_elem
    }
}

function replaceChild(parent, newElement) {
    parent.innerHTML = ""
    parent.appendChild(newElement)
}

function quickCreateElement(type, innerHTML) {
    const elem = document.createElement(type)
    elem.innerHTML = innerHTML
    return elem
}

module.exports = {
    openInBrowser: openInBrowser,
    ModalWindow: ModalWindow,
    AutoFormat: AutoFormat,
    replaceChild: replaceChild,
    quickCreateElement: quickCreateElement
}
