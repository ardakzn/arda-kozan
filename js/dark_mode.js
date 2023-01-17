var _switch = document.querySelector("#theme-switcher");

//load dark theme from local storage
if(localStorage.getItem('theme')==='dark'){

  document.documentElement.setAttribute('data-theme','dark')
  document.querySelector("#theme-switcher").firstChild.setAttribute('class','fa fa-sun')
}

//Switch function
function switchTheme(){
  
  rootElem= document.documentElement
  dataTheme=rootElem.getAttribute('data-theme')
  newTheme=(dataTheme==='light'? 'dark' : 'light') //if data-theme is light, then set dark. Otherwise set light.
  rootElem.setAttribute('data-theme',newTheme)

  document.body.setAttribute('class','bg-transition')//add dark to light transition

  newIcon=(_switch.firstChild.getAttribute('class')==='fa fa-moon'? 'fa fa-sun' : 'fa fa-moon')
  _switch.firstChild.setAttribute('class',newIcon)

  //Set the new local storage item
  localStorage.setItem('theme',newTheme);
}

_switch.addEventListener('click',switchTheme);
