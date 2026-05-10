window.addEventListener("load", () => {
  gsap.to(".loader", {
    opacity: 0,
    duration: 1.5,
    delay: 1,
    onComplete: () => {
      document.querySelector(".loader").style.display = "none";
    }
  });

  gsap.from(".hero-content h1", {
    y: 100,
    opacity: 0,
    duration: 1.5
  });

  gsap.from(".hero-content p", {
    y: 50,
    opacity: 0,
    duration: 1.5,
    delay: 0.5
  });

  gsap.from(".hero-content button", {
    scale: 0,
    duration: 1,
    delay: 1
  });
});
