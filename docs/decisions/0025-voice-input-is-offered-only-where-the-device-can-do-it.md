# 0025 — Voice input is offered only where the device can do it

- **Date:** 2026-08-22
- **Status:** decided
- **Decision:** Draw the microphone on a text field only where the device can actually turn speech
  into text, and ship no speech engine of our own.

## Context

Tapping the microphone closed the app. Measured on the test Pixel — GrapheneOS, no Google app —
`query-activities` for `RECOGNIZE_SPEECH` answers "No activities found", so `launcher.launch` threw
`ActivityNotFoundException`, uncaught, with a half-written invoice behind it.

The device has no speech engine at all: the default recogniser setting is `null`, the keyboard is
AOSP LatinIME with no dictation, and the Google app is absent. Nothing more can be routed around
that — a device without an engine cannot do speech unless we bring one or send the audio away.

## Options considered

**Bundle an offline engine (rejected).** Vosk or similar works everywhere, offline and private, at
roughly 40 MB of APK for a convenience button on a text field. Against the project's own rule that
storage is money, and wildly out of proportion to what it buys.

**Cloud speech-to-text (rejected).** Works everywhere, and sends recorded audio off the device —
client names, item descriptions, whatever is being dictated into an invoice. That is a trust cost
paid by every user so that a few can dictate, on a product whose whole argument is trust. Not
proposed again without the owner raising it.

**The programmatic `SpeechRecognizer` API (rejected for now).** It binds a RecognitionService rather
than launching an activity, so it covers devices that have a service and no activity — a real class,
and this device is not in it: the service present belongs to another app and the system default is
unset, so it would fail here too. It also needs `RECORD_AUDIO` and a listening UI of our own. Real
cost, no gain on the device that prompted the question.

**Offer it where it works, hide it where it does not (chosen).**

## Consequences

- The microphone is drawn only when an activity exists to receive `RECOGNIZE_SPEECH`. The launch is
  still wrapped, because a control that closes the app is the worst failure available here.
- **Availability must measure the mechanism actually used.** The first version of this check asked
  `hasService || hasActivity` and was wrong on the first device it met: the service existed, the
  activity did not, so the button appeared and answered with an apology. A service backs the
  programmatic API; an intent needs a receiver.
- `<queries>` declares the speech intents. At targetSdk 36 PackageManager only resolves what is
  declared, so on a device that *does* have a recogniser the app would otherwise fail to see it and
  the microphone would go missing for the opposite reason. Same trap as the WebView providers, which
  took an AdMob crash to find.
- This gap belongs to the test device, not to the user base. Stock Android ships a recogniser, and
  most keyboards put dictation next to the field anyway — the in-app microphone is a shortcut to
  something already one tap away, which is also why not having it is survivable.
