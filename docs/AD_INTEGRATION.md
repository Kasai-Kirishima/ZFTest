# Rewarded advertising integration

Zero Football v44 contains internal sponsor banners and a rewarded-ad integration point. No third-party advertising SDK or publisher ID is bundled because those credentials depend on the deployment account and platform.

## Provider contract

Before loading `js/app.js`, the deployment may define:

```js
window.ZF_AD_PROVIDER = {
  async showRewardedAd({ placement, reward }) {
    // Open the provider's rewarded-video placement.
    // Resolve only when the SDK reports a completed view.
    // Return { completed: true } after verified completion.
    return { completed: false };
  }
};
```

The game requests `placement: "energy_refill"` and `reward: { energy: 3 }`. The game awards +3 energy only when the provider resolves with `{ completed: true }`. If the provider is absent, the button reports that the ad network is not connected.

## Sponsor banners

The dashboard and match lobby display active club sponsor contracts. If no contract is active, the slot is presented as available and links to the Sponsors section. These are in-game partner placements, not paid third-party network ads.
