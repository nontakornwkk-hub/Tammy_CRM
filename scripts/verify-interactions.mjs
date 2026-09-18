const tabs = await fetch("http://127.0.0.1:9223/json/list").then((response) => response.json());
const tab = tabs.find((entry) => entry.type === "page");

if (!tab) throw new Error("No Chrome page target found");

const socket = new WebSocket(tab.webSocketDebuggerUrl);
let messageId = 0;
const pending = new Map();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (handler) {
    pending.delete(message.id);
    handler(message);
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return response.result?.result?.value;
}

async function navigate(url) {
  await send("Page.navigate", { url });
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

await navigate("http://localhost:3000/points");
const before = await evaluate("document.querySelector('.customer-row.selected .member-badge + strong')?.textContent?.trim()");
await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('ยืนยันให้แต้ม')).click()");
await new Promise((resolve) => setTimeout(resolve, 150));
const modal = await evaluate("document.querySelector('[aria-labelledby=confirm-points-title]')?.innerText || ''");
const whileModalOpen = await evaluate("document.querySelector('.customer-row.selected .member-badge + strong')?.textContent?.trim()");
await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('ยืนยันการให้แต้ม')).click()");
await new Promise((resolve) => setTimeout(resolve, 150));
const after = await evaluate("document.querySelector('.customer-row.selected .member-badge + strong')?.textContent?.trim()");

await navigate("http://localhost:3000/rewards");
await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('ดูตัวอย่าง')).click()");
await new Promise((resolve) => setTimeout(resolve, 150));
const rewardPreview = await evaluate("document.querySelector('[aria-label=ตัวอย่างของรางวัล]')?.innerText || ''");

console.log(JSON.stringify({
  pointsUnchangedBeforeSecondConfirmation: before === "2,480" && whileModalOpen === "2,480",
  confirmationModalOpened: modal.includes("ยืนยันการให้แต้ม?") && modal.includes("+50 แต้ม"),
  pointsConfirmed: after === "2,530",
  rewardPreviewOpened: rewardPreview.includes("ตัวอย่างสำหรับลูกค้า"),
}, null, 2));

socket.close();
