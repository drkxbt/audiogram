// A looping tour for recordings, run inside each screen of tour.html: a mouse on the MacBook, a finger on the iPhone.
// Both have the same period, and every loop starts the clip over.

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function run(name, editor, reset) {
  const $ = (selector) => document.querySelector(selector);
  const touch = name === "phone";

  // Where the pointer is: a ring the size of a fingertip.
  const finger = document.createElement("div");
  finger.className = "finger";
  document.body.append(finger);
  const show = (x, y, down) => {
    finger.style.translate = `${x - 22}px ${y - 22}px`;
    finger.toggleAttribute("data-on", true);
    finger.toggleAttribute("data-down", down);
  };
  const lift = () => finger.removeAttribute("data-on");
  const centre = (element) => {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };
  const ease = (t) => 1 - (1 - t) ** 2;

  async function tap(element) {
    const { x, y } = centre(element);
    show(x, y, true);
    await wait(110);
    show(x, y, false);
    element.click();
    await wait(140);
    lift();
  }
  // A press on the picture, which is what marks a caption while timing.
  async function press(element) {
    const { x, y } = centre(element);
    show(x, y, true);
    element.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: y, pointerType: touch ? "touch" : "mouse", isPrimary: true, bubbles: true }));
    await wait(120);
    element.dispatchEvent(new PointerEvent("pointerup", { clientX: x, clientY: y, pointerType: touch ? "touch" : "mouse", isPrimary: true, bubbles: true }));
    show(x, y, false);
    await wait(140);
    lift();
  }
  async function drag(element, dx, ms) {
    const from = centre(element);
    const track = $(".ag-track");
    show(from.x, from.y, true);
    const fire = (type, x) => (type === "pointerdown" ? element : track).dispatchEvent(new PointerEvent(type, { clientX: x, clientY: from.y, pointerId: 1, pointerType: touch ? "touch" : "mouse", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true }));
    fire("pointerdown", from.x);
    const steps = Math.max(4, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const x = from.x + dx * ease(i / steps);
      fire("pointermove", x);
      show(x, from.y, true);
      await wait(16);
    }
    fire("pointerup", from.x + dx);
    show(from.x + dx, from.y, false);
    await wait(150);
    lift();
  }
  const pick = (value) => $(`[role="radio"][data-value="${value}"]`);

  const scripts = {
    // Play the clip with the bars moving; change to the wave and the mint colours, then the tall shape; then time
    // the captions by tapping along.
    async desk(at) {
      await at(400);
      await tap($(".ag-play"));
      await at(3300);
      await tap(pick("wave"));
      await at(4300);
      await tap(pick("2"));
      await at(5300);
      await tap(pick("portrait"));
      await at(6500);
      await tap($(".ag-tap"));
      await at(7600);
      await press($(".ag-preview"));
      await at(8500);
      await press($(".ag-preview"));
      await at(9500);
      restart();
    },
    // On the phone: play, shorten the clip from its end, then the pulse and the dusk colours.
    async phone(at) {
      await at(500);
      await tap($(".ag-play"));
      await at(3800);
      await tap($(".ag-play"));
      await at(4400);
      await drag(document.querySelectorAll(".ag-handle")[1], -60, 520);
      await at(5600);
      await tap(pick("pulse"));
      await at(6600);
      await tap(pick("3"));
      await at(7500);
      await tap($(".ag-play"));
      await at(9500);
      restart();
    },
  };

  // Back to how the demo opens: paused, the first look, the sample's own captions and stretch.
  function restart() {
    editor.pause();
    for (const value of [touch ? "portrait" : "square", "bars", "0"]) pick(value).click();
    reset();
  }

  const script = scripts[name];
  if (!script) return;
  const { start, period } = await new Promise((resolve) => {
    const hello = setInterval(() => parent.postMessage({ tourReady: name }, "*"), 300);
    parent.postMessage({ tourReady: name }, "*");
    addEventListener("message", (event) => {
      if (!event.data?.tourStart) return;
      clearInterval(hello);
      resolve({ start: event.data.tourStart, period: event.data.period });
    });
  });
  for (let k = 0; ; k++) {
    const t0 = start + k * period;
    await script((ms) => wait(Math.max(0, t0 + ms - Date.now())));
    await wait(Math.max(0, t0 + period - Date.now()));
  }
}
