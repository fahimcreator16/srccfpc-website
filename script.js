// =========================
// FILE: script.js
// =========================

// LOADER

window.addEventListener("load",()=>{

gsap.to(".loader",{
opacity:0,
duration:1.5,
delay:1,
onComplete:()=>{
document.querySelector(".loader").style.display="none";
}
});

});

// MOBILE MENU

const menuBtn=document.getElementById("menuBtn");
const navLinks=document.getElementById("navLinks");

menuBtn.onclick=()=>{

navLinks.classList.toggle("active");

};

// COUNTER

function counter(id,start,end,duration){

let obj=document.getElementById(id);

let current=start;

let range=end-start;

let increment=end>start ? 1 : -1;

let step=Math.abs(Math.floor(duration/range));

let timer=setInterval(()=>{

current+=increment;

obj.textContent=current+"+";

if(current==end){

clearInterval(timer);

}

},step);

}

counter("memberCounter",0,250,3000);

counter("eventCounter",0,45,3000);

// REVEAL

const reveals=document.querySelectorAll(".reveal");

window.addEventListener("scroll",()=>{

reveals.forEach(reveal=>{

let top=reveal.getBoundingClientRect().top;

if(top < window.innerHeight - 100){

reveal.classList.add("active");

}

});

});

// ACCORDION

const accordion=document.querySelectorAll(".accordion-header");

accordion.forEach(item=>{

item.addEventListener("click",()=>{

item.parentElement.classList.toggle("active");

});

});

// BUTTON ANIMATION

const buttons=document.querySelectorAll(".premium-btn,.submit-btn");

buttons.forEach(btn=>{

btn.addEventListener("mouseenter",()=>{

gsap.to(btn,{
scale:1.05,
duration:.3
});

});

btn.addEventListener("mouseleave",()=>{

gsap.to(btn,{
scale:1,
duration:.3
});

});

});

// CURSOR

const cursor=document.querySelector(".cursor");

document.addEventListener("mousemove",(e)=>{

cursor.style.left=e.clientX+"px";

cursor.style.top=e.clientY+"px";

});