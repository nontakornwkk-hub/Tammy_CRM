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
const routeLoaded = await evaluate("document.body.innerText.includes('ตั้งค่าระบบ')");

await evaluate("[...document.querySelectorAll('.settings-tabs button')].find((button) => button.innerText.includes('สมาชิก แต้ม')).click()");
await new Promise((resolve) => setTimeout(resolve, 100));
const pointsTabOpened = await evaluate("document.body.innerText.includes('กฎการสะสมแต้ม')");

await evaluate(`
  const setValue = (element, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const inputs = document.querySelectorAll('.points-rule input');
  setValue(inputs[0], '100');
  setValue(inputs[1], '2');
  setValue(document.querySelector('.compact-number'), '3');
`);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('บันทึกการ')).click()");
await new Promise((resolve) => setTimeout(resolve, 100));

await navigate("http://localhost:3000/points");
const pointsIntegration = await evaluate(`({
  rate: document.body.innerText.includes('ทุกยอดซื้อ 100 บาท = 2 แต้ม'),
  multiplier: document.body.innerText.includes('แต้ม x3'),
  earned: document.body.innerText.includes('+72 แต้ม')
})`);

await navigate("http://localhost:3000/settings");
await evaluate("[...document.querySelectorAll('.settings-tabs button')].find((button) => button.innerText.includes('ทีมงาน')).click()");
await new Promise((resolve) => setTimeout(resolve, 100));
const beforeTeam = await evaluate("document.querySelectorAll('.team-list > div').length");
await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('เพิ่มทีมงาน')).click()");
const afterTeam = await evaluate("document.querySelectorAll('.team-list > div').length");

await evaluate("[...document.querySelectorAll('button')].find((button) => button.innerText.includes('ดูตัวอย่าง')).click()");
const previewOpened = await evaluate("Boolean(document.querySelector('.settings-preview-modal'))");

await evaluate(`localStorage.${original === null ? "removeItem('tammy-crm-settings-v1')" : `setItem('tammy-crm-settings-v1', ${JSON.stringify(original)})`}`);

console.log(JSON.stringify({
  routeLoaded,
  pointsTabOpened,
  settingsAffectPointsPage: pointsIntegration.rate && pointsIntegration.multiplier && pointsIntegration.earned,
  addTeamMemberWorks: afterTeam === beforeTeam + 1,
  previewOpened,
}, null, 2));
socket.close();
