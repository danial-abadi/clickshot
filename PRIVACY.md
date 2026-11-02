# Privacy

Clickshot runs entirely in your browser. It has no server, no account, no analytics and no network requests of its own. Nothing you record is sent anywhere.

## What it records

Only while you have pressed **Start recording** (or use the manual capture shortcut):

- A screenshot of the visible area of the active tab, taken on each left click.
- The click position, the page title and the page URL.
- A short label for the clicked element, taken from its `aria-label`, button or link text, `placeholder`, `name`, `title` or `alt`. On non-interactive elements only `title` and `alt` are used, so ordinary page text is not copied into captions.

## What it does not record

- Anything you type. Input values are never read.
- Clicks while recording is off or paused.
- Anything on pages you did not click while recording.

## Where it is stored

Screenshots and captions are stored in your browser's IndexedDB for this extension. The recording state is stored in `chrome.storage.local`. Use **Clear all steps** in the popup or on the steps page to delete the data. Removing the extension also removes it.

Exported files (clipboard, PNG, ZIP) are created on your device. What you do with them afterwards is up to you.

## Be careful with what is on screen

A screenshot shows everything visible in the tab, including personal data, tokens and passwords shown on screen. Review each step and hide sensitive areas before sharing. Hidden areas are applied to exported images only, and the original stays stored until you clear it.

## Permissions

| Permission | Why |
|---|---|
| `<all_urls>` host access and the content script on `http://` and `https://` pages | Needed to detect clicks and capture the tab on any site you choose to record. |
| `scripting` | Injects the click listener into tabs that were already open when recording starts. |
| `storage` | Remembers whether recording is on, off or paused. |
| `unlimitedStorage` | Screenshots are large, so the default browser quota would run out quickly. |
| `clipboardWrite` | The **Copy image** button. |

The extension is open source, so you can check all of this in the code.
