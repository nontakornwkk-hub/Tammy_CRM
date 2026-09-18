const tabs = await fetch("http://127.0.0.1:9223/json/list").then((response) => response.json());
const tab = tabs.find((entry) => entry.type === "page");
if (!tab) throw new Error("No Chrome page target found");
const socket = new WebSocket(tab.webSocketDebuggerUrl);
let messageId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); if (!message.id) return; pending.get(message.id)?.(message); pending.delete(message.id); });
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
function send(method, params = {}) { const id = ++messageId; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve) => pending.set(id, resolve)); }
async function evaluate(expression) { const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text); return response.result?.result?.value; }
await send("Page.navigate", { url: "http://localhost:3000/database" });
await new Promise((resolve) => setTimeout(resolve, 900));

const initial = await evaluate(`({
  heading: document.querySelector('h1')?.innerText,
  tabs: [...document.querySelectorAll('.sheet-tabs button:not(.sheet-add)')].map((button) => button.innerText.trim()),
  active: document.querySelector('.sheet-tabs button.active')?.innerText.trim(),
  rowCount: document.querySelectorAll('.sheet-row-number').length,
  source: document.querySelector('.database-source')?.innerText.trim(),
  noOverlay: !document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')
})`);

await evaluate(`[...document.querySelectorAll('.sheet-tabs button')].find((button) => button.innerText.includes('สัตว์เลี้ยง')).click()`);
const petsTab = await evaluate(`({ active: document.querySelector('.sheet-tabs button.active')?.innerText.trim(), hasPet: document.querySelector('.sheet-grid')?.innerText.includes('โมจิ') })`);
await evaluate(`[...document.querySelectorAll('.sheet-tabs button')].find((button) => button.innerText.includes('ประวัติแต้ม')).click()`);
const pointsTab = await evaluate(`({ active: document.querySelector('.sheet-tabs button.active')?.innerText.trim(), hasPoints: document.querySelector('.sheet-grid')?.innerText.includes('ให้แต้มจากยอดซื้อ') })`);
await evaluate(`[...document.querySelectorAll('.sheet-tabs button')].find((button) => button.innerText.includes('สมาชิก')).click()`);
await evaluate(`(() => { const input = document.querySelector('.sheet-toolbar input'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'มะลิ'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await new Promise((resolve) => setTimeout(resolve, 80));
const search = await evaluate(`({ rows: document.querySelectorAll('.sheet-row-number').length, hasMember: document.querySelector('.sheet-grid')?.innerText.includes('มะลิ') })`);

console.log(JSON.stringify({ initial, petsTab, pointsTab, search }, null, 2));
socket.close();
