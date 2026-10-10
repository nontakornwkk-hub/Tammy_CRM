// Share the portal chunk between the LINE and administrator entry points.
// Start this only once credentials are available, while member lookup runs.
let pending: Promise<typeof import("../components/customer-portal")> | undefined;

export function loadCustomerPortal() {
  return pending ??= import("../components/customer-portal").catch(cause => {
    pending = undefined;
    throw cause;
  });
}

// Keep one entry loading screen until both the code and shop content are ready.
export async function prepareCustomerPortal() {
  const portal = await loadCustomerPortal();
  await portal.prepareCustomerShop();
}
