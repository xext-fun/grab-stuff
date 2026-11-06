# Grab Stuff for X

Grab Stuff automatically saves unique posts as they appear in an X/Twitter timeline. Its sidebar opens on X pages by default. You can pause capture, choose whether to include replies, upload a list of handles to capture, and download everything saved as JSON or CSV. Data stays in your browser's local extension storage; the extension does not send it to a server.

## Build and install

Requires Node.js 18 or newer. Run `npm run build` to create browser packages in `dist/`.

- **Chrome and Brave:** Open `chrome://extensions` or `brave://extensions`, turn on Developer mode, choose **Load unpacked**, and select `dist/chromium`.
- **Firefox:** Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `dist/firefox/manifest.json`. For permanent distribution, sign the Firefox package with Mozilla.
- **Safari on macOS:** After building, run `npm run package:safari`, then open the generated Xcode project in `dist/safari-app`, build and run it, and enable the extension with access to x.com and twitter.com. Safari requires an app wrapper for distribution. A generated Xcode project is included in this workspace.

## Use

1. Open an X timeline. The sidebar appears automatically and capture is on by default.
2. Browse or scroll to load posts. Newly rendered posts are saved once by their status ID, including across tabs and repeat visits.
3. Turn on **Include replies** to capture replies as well as regular posts. The setting applies to future captures; previously saved replies remain saved if you later turn it off.
4. Upload a `.txt` file with one handle per line (`@alice`, `alice`, or `https://x.com/alice`) or a `.csv` file with a `handle`, `username`, or `screen_name` column. If a CSV has no named handle column, its first column is used. Duplicate handles and letter case are normalized. Once uploaded, only posts by listed handles are captured. **Remove handle filter** restores capture from everyone.
5. Choose **Download JSON** or **CSV**. The download contains all saved posts, not just the 30 most recent shown in the sidebar. Changing the handle filter affects future captures; posts saved earlier remain in the collection until you clear it.
6. Close the sidebar with × and reopen it with the edge handle or toolbar button. **Clear saved posts** removes the local collection.

The extension captures posts that X renders in the page. It does not scroll automatically or fetch posts that have not loaded. X can change its page markup; if it does, the capture selectors may need an update. Reply detection uses X's English “Replying to” label, so non-English reply labels may be classified as posts.

## Development

Run `npm test` for the status URL and deduplication checks. No dependencies or build framework are needed.

## Browser notes

The sidebar is injected into X pages, which makes its automatic opening consistent across Chrome, Brave, Firefox, and Safari. Native browser sidebar APIs and automatic opening behavior differ between browsers. Browser permissions are limited to X/Twitter and local extension storage.
