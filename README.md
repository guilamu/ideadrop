# ideadrop

Mobile-first idea capture. Ideas live in `localStorage` on the device and are
synced between devices through a private GitHub Gist (`ideadrop_sync.json`).

## Files

```
ideadrop-main/
├── index.html            # The whole app: markup, styles, logic
├── sw.js                 # Service worker: offline shell
├── manifest.webmanifest  # PWA install metadata
└── icons/                # icon-192.png, icon-512.png
```

## Hosting

Serve the folder over **https** (or `http://localhost` in development). A
service worker needs a secure context; opened straight from the filesystem
(`file://`) registration fails, and the app falls back to online-only — every
other feature still works.

```bash
python -m http.server 8130 --directory ideadrop-main
```

## Offline

The app is usable with no connection:

- the shell (HTML, icons, webfont) is cached by the service worker, so the app
  launches offline once it has been opened online at least once;
- collections and ideas are read from and written to `localStorage`, so
  browsing, creating, editing, closing and deleting all work offline;
- each change bumps a pending counter shown in the topbar (`📴 Offline · 2`).
  The Gist push is replayed automatically when the connection comes back
  (`online` event, on refocus, and with a 15s→5min backoff in between). Tapping
  the indicator retries immediately;
- the GitHub repository list falls back to the last known one, so ideas filed
  under a repo stay reachable offline.

Conflicts are resolved per item, last write wins on `updated_at`, with
tombstones in `deleted_ids` so a deletion is not resurrected by another device.
A sync aborts rather than pushing if the Gist cannot be read first — otherwise a
device coming back online would overwrite what the others wrote meanwhile.

Known limitation: two devices creating ideas offline in the same collection can
land on the same display `#number`. The ideas themselves are distinct (unique
ids), only the number is duplicated.
