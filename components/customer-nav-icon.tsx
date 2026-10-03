const artworkBoxes = {
  rewards: "90 210 335 340",
  coupons: "460 210 375 340",
  home: "860 210 350 340",
  lucky: "1230 210 380 340",
  account: "1665 210 290 340",
} as const;

/** Clip the production sprite into independent icons; labels remain real text. */
export function CustomerNavIcon({ tab }: { tab: keyof typeof artworkBoxes }) {
  return <svg className="customer-pastel-nav-art" viewBox={artworkBoxes[tab]} aria-hidden="true" focusable="false">
    <image href="/assets/customer-nav-pastel.png" width="2061" height="763" />
  </svg>;
}
