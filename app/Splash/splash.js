"use strict"

for (const packageName of ["node", "chrome", "electron"]) {
    const element = document.getElementById(`${packageName}-version`)
    element.innerText = process.versions[packageName]
}



// catch button event
/* main.setParam("serverIP", input) */
