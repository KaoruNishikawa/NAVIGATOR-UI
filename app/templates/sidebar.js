"use strict"

const sideBarContainer = document.getElementsByClassName("sidenav")[0]

const appLogo = document.createElement("div")
appLogo.classList.add("logo")
const appLogoLink = document.createElement("a")
appLogoLink.href = "../Splash/splash.html"
const appLogoImg = document.createElement("img")
appLogoImg.src = "../assets/NANTEN_logo.svg"
appLogoLink.appendChild(appLogoImg)
appLogo.appendChild(appLogoLink)
sideBarContainer.appendChild(appLogo)
