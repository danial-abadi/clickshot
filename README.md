# Clickshot

![Clickshot: click, capture, hide what is private, export](docs/clickshot-promo.gif)

A Chrome extension (Manifest V3) that takes a screenshot of the page every time you click, marks where you clicked, and turns the result into an editable, shareable list of steps. Use it for bug reports, how-to guides and walkthroughs.

It works across tabs, windows and sites, has no dependencies and no build step, and keeps everything in your browser.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. After editing any file, press the reload icon on the extension card. Then reload the pages you are recording, or press **Start** again, which re-injects the script.

## Use

Open the toolbar popup:

| Button | What it does |
|---|---|
| **Start recording** | Every left click in any tab captures a screenshot with a numbered click marker. |
| **Pause / Resume** | Temporarily stop capturing without losing the steps. |
| **Stop** | Stop recording. Steps are kept. |
| **Capture this tab now** | Takes a screenshot without a click. Shortcut: `Alt+Shift+S`. |
| **Open steps** | Opens the editor page. |
| **Clear all steps** | Deletes every recorded step. |

The toolbar badge shows the step count: red while recording, orange while paused.

### Editing steps

On the **steps** page you can:

- Edit the caption of each step. Captions start as `Click "<button text>"` and are saved as you type.
- Drag on an image to hide an area (API keys, passwords, phone numbers) with a **black box** or **pixelation**. **Undo hide** removes the last one.
- Turn the click marker on or off for a step. Marker numbers follow the step order.
- Reorder steps with Up and Down, or delete them.

### Exporting

- **Copy image** puts the finished step on the clipboard, ready to paste into an issue tracker, a doc or a chat.
- **Download PNG** saves one step.
- **Download ZIP** saves every step as `step-01.png`, `step-02.png`, ... plus a `steps.md` file with the captions and image links.

Hidden areas and the marker are applied when you copy or export. The stored screenshot stays untouched until you clear it.

## Privacy

Nothing leaves your browser. See [PRIVACY.md](PRIVACY.md) for what is collected, what is not, and why each permission is needed.

## Limitations

- Only the visible part of the tab is captured.
- Clicks inside iframes are not captured.
- Pages where extensions cannot run (`chrome://`, the Chrome Web Store, `file://` unless you allow it) cannot be recorded.
- Chrome allows about two captures per second, so very fast clicks are queued.
- Screenshots are stored in the browser's IndexedDB. Long recordings take disk space until you clear them.

## Files

| File | Role |
|---|---|
| `manifest.json` | Extension manifest. |
| `background.js` | Service worker: capture queue, badge, shortcut. |
| `content.js` | Reports click position and element label from the page. |
| `popup.html`, `popup.js` | Toolbar popup. |
| `steps.html`, `steps.js`, `steps.css` | Step editor and export. |
| `db.js` | IndexedDB wrapper. |
| `zip.js` | Small ZIP writer used for export. |

## License

[MIT](LICENSE)
