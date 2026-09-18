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
  await new Promise((resolve) => setTimeout(resolve, 900));
}

await navigate("http://localhost:3000/settings");
const original = await evaluate("localStorage.getItem('tammy-crm-settings-v1')");
const removedSections = await evaluate(`!document.body.innerText.includes('สีหลักของระบบ') && !document.body.innerText.includes('ตัวอย่างหน้า Login บนมือถือ')`);

const beforeContacts = await evaluate("document.querySelectorAll('.contact-manager .contact-row').length");
await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('เพิ่มช่องทาง')).click()");
await new Promise((resolve) => setTimeout(resolve, 80));
const addedContacts = await evaluate("document.querySelectorAll('.contact-manager .contact-row').length");
await evaluate(`
  const input = document.querySelector('.contact-row.editing input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'Instagram');
  input.dispatchEvent(new Event('input', { bubbles: true }));
`);
const contactEdited = await evaluate("document.querySelector('.contact-row.editing input').value === 'Instagram'");

await evaluate(`
  const upload = async (selector, name) => {
    const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLxVQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const file = new File([bytes], name, { type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector(selector);
    Object.defineProperty(input, 'files', { value: transfer.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  upload('.logo-uploader input[type=file]', 'logo.png');
  upload('.image-action input[type=file]', 'hero.png');
`);
await new Promise((resolve) => setTimeout(resolve, 250));
const imagePreviews = await evaluate(`({
  logo: document.querySelector('.logo-preview img')?.src.startsWith('data:image/png'),
  hero: document.querySelector('.hero-position-preview img')?.src.startsWith('data:image/png')
})`);

await evaluate(`
  const range = document.querySelector('.logo-uploader input[type=range]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(range, '25');
  range.dispatchEvent(new Event('input', { bubbles: true }));
`);
await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('บันทึกการ')).click()");
await new Promise((resolve) => setTimeout(resolve, 120));
const sidebarUpdated = await evaluate("document.querySelector('.brand img')?.src.startsWith('data:image/png')");

await evaluate(`localStorage.${original === null ? "removeItem('tammy-crm-settings-v1')" : `setItem('tammy-crm-settings-v1', ${JSON.stringify(original)})`}`);

console.log(JSON.stringify({
  removedColorAndPhonePreview: removedSections,
  addContactWorks: addedContacts === beforeContacts + 1,
  editContactWorks: contactEdited,
  logoPreviewWorks: imagePreviews.logo,
  heroPreviewWorks: imagePreviews.hero,
  savedLogoUpdatesSidebar: sidebarUpdated,
}, null, 2));
socket.close();
