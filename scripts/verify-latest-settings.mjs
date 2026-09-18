const tabs = await fetch("http://127.0.0.1:9223/json/list").then((response) => response.json());
const tab = tabs.find((entry) => entry.type === "page");
if (!tab) throw new Error("No Chrome page target found");
const socket = new WebSocket(tab.webSocketDebuggerUrl);
let messageId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  pending.get(message.id)?.(message);
  pending.delete(message.id);
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
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result?.result?.value;
}
await send("Page.navigate", { url: "http://localhost:3000/settings" });
await new Promise((resolve) => setTimeout(resolve, 900));
const original = await evaluate("localStorage.getItem('tammy-crm-settings-v1')");
const pageHealthy = await evaluate(`document.body.innerText.includes('ตั้งค่าระบบ') && !document.querySelector('[data-nextjs-dialog]')`);

await evaluate(`[...document.querySelectorAll('button')].find((button) => button.innerText.includes('เพิ่มช่องทาง')).click()`);
await new Promise((resolve) => setTimeout(resolve, 80));
const contactControls = await evaluate(`({
  tiktok: document.querySelector('.contact-row.editing select')?.value === 'tiktok',
  url: Boolean(document.querySelector('.contact-row.editing input[aria-label="ลิงก์ช่องทาง"]')),
  logo: Boolean(document.querySelector('.contact-row.editing .contact-icon.tiktok svg'))
})`);
await evaluate(`(() => {
  const input = document.querySelector('.contact-row.editing input[aria-label="ลิงก์ช่องทาง"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'https://www.tiktok.com/@tammydemo');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`);

await evaluate(`(() => {
  const inputs = [...document.querySelectorAll('.store-hours-fields input[type=time]')];
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[0], '08:30'); inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(inputs[1], '21:15'); inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const hoursUpdated = await evaluate(`document.querySelector('.store-hours-preview')?.innerText.includes('08:30 – 21:15')`);

await evaluate(`(() => {
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLxVQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const file = new File([bytes], 'logo.png', { type: 'image/png' });
  const transfer = new DataTransfer(); transfer.items.add(file);
  const input = document.querySelector('.logo-uploader input[type=file]');
  Object.defineProperty(input, 'files', { value: transfer.files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await new Promise((resolve) => setTimeout(resolve, 180));
const imageTools = await evaluate(`({
  preview: document.querySelector('.logo-preview img')?.src.startsWith('data:image/png'),
  dragHint: document.querySelector('.logo-preview .drag-hint')?.innerText.includes('ลากภาพ'),
  zoom: Boolean(document.querySelector('.logo-uploader input[aria-label="ซูมรูปภาพ"]')),
  noAxisSliders: !document.body.innerText.includes('แนวนอน') && !document.body.innerText.includes('แนวตั้ง')
})`);

const oversizedBytes = await evaluate(`(async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1500; canvas.height = 1500;
  const context = canvas.getContext('2d'); const image = context.createImageData(canvas.width, canvas.height);
  let seed = 123456789;
  for (let index = 0; index < image.data.length; index += 4) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    image.data[index] = seed & 255; image.data[index + 1] = (seed >>> 8) & 255; image.data[index + 2] = (seed >>> 16) & 255; image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'oversized.png', { type: 'image/png' });
  const transfer = new DataTransfer(); transfer.items.add(file);
  const input = document.querySelector('.logo-uploader input[type=file]');
  Object.defineProperty(input, 'files', { value: transfer.files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return file.size;
})()`);
await new Promise((resolve) => setTimeout(resolve, 1800));
const compression = await evaluate(`({
  sourceOver5MB: ${oversizedBytes} > 5000000,
  success: document.querySelector('.image-status')?.innerText.includes('บีบอัดสำเร็จ'),
  resultUnder5MB: (document.querySelector('.logo-preview img')?.src.length || Infinity) * .75 < 5000000
})`);

await evaluate(`[...document.querySelectorAll('button')].find((button) => button.innerText.includes('บันทึกการ')).click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
const saved = await evaluate(`(() => { const value = JSON.parse(localStorage.getItem('tammy-crm-settings-v1')); return value.storeOpenTime === '08:30' && value.storeCloseTime === '21:15' && value.contacts.some((c) => c.url === 'https://www.tiktok.com/@tammydemo'); })()`);
await evaluate(original === null ? "localStorage.removeItem('tammy-crm-settings-v1')" : `localStorage.setItem('tammy-crm-settings-v1', ${JSON.stringify(original)})`);

console.log(JSON.stringify({ pageHealthy, contactControls, hoursUpdated, imageTools, compression, saved }, null, 2));
socket.close();
