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
async function navigate(url) { await send("Page.navigate", { url }); await new Promise((resolve) => setTimeout(resolve, 700)); }

await navigate("http://localhost:3000/members");
const membersHealthy = await evaluate(`document.body.innerText.includes('สมาชิกทั้งหมด') && document.querySelectorAll('.members-table-row').length === 8 && !document.querySelector('[data-nextjs-dialog]')`);
await evaluate(`(() => { const input = document.querySelector('.member-tools input'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'มะลิ'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await new Promise((resolve) => setTimeout(resolve, 80));
const searchWorks = await evaluate(`document.querySelectorAll('.members-table-row').length === 1 && document.body.innerText.includes('คุณมะลิ จันทร์สุข')`);
await evaluate(`[...document.querySelectorAll('.member-detail-tabs button')].find((button) => button.innerText === 'สัตว์เลี้ยง').click()`);
const tabsWork = await evaluate(`document.querySelector('.pet-detail-list')?.innerText.includes('น้องโมจิ')`);
await evaluate(`[...document.querySelectorAll('button')].find((button) => button.innerText.includes('เพิ่มสมาชิก')).click()`);
const addModalWorks = await evaluate(`Boolean(document.querySelector('.member-add-modal form'))`);

await navigate("http://localhost:3000/points");
await evaluate(`document.querySelector('.confirm-points').click()`);
const secondConfirmation = await evaluate(`document.querySelector('.points-confirm-modal')?.innerText.includes('ยืนยันการให้แต้ม?')`);
await evaluate(`[...document.querySelectorAll('.confirm-actions button')].find((button) => button.innerText.includes('ยืนยันการให้แต้ม')).click()`);
const immediateSuccess = await evaluate(`document.querySelector('.points-success-modal')?.innerText.includes('ให้แต้มสำเร็จ!') && document.querySelector('.points-success-modal')?.innerText.includes('แต้มคงเหลือใหม่')`);
const noOverlay = await evaluate(`!document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay')`);

console.log(JSON.stringify({ membersHealthy, searchWorks, tabsWork, addModalWorks, secondConfirmation, immediateSuccess, noOverlay }, null, 2));
socket.close();
