# Zilosoft Quote Reply

[![CI](https://github.com/zilosoft/mattermost-reply/actions/workflows/ci.yml/badge.svg)](https://github.com/zilosoft/mattermost-reply/actions/workflows/ci.yml)
[![Release](https://github.com/zilosoft/mattermost-reply/actions/workflows/release.yml/badge.svg)](https://github.com/zilosoft/mattermost-reply/actions/workflows/release.yml)

Mattermost plugin that adds Telegram-like quoting for channel posts and thread replies.

## What It Does

- Adds a `Цитата` action next to post hover actions.
- Lets you select part of a message and quote only that fragment.
- Keeps quoting scoped correctly:
  - quotes from the center channel go to the center channel composer;
  - quotes from the RHS thread go to the thread composer.
- Appends quotes to the end of the current draft instead of overwriting what you already typed.
- Turns the quoted text itself into a permalink after the message is sent.

## Current UX

- Click `Цитата` on a post to quote the whole message.
- Select text inside a post body to get a small `Цитата` popup.
- Multiple quotes can be added one after another before sending.
- The plugin avoids showing the popup on author names and other non-message UI text.

## Install

Download the latest release artifact:

- `com.zilosoft.quote-reply-<version>.tar.gz`

Then upload it in Mattermost:

1. `System Console` -> `Plugin Management`
2. `Upload Plugin`
3. Activate `Zilosoft Quote Reply`

If the UI still shows cached assets after upgrade, do a hard refresh in the browser.

## Local Development

Requirements:

- Go from `go.mod`
- Node.js 22
- npm

Install dependencies:

```bash
cd webapp
npm ci
```

Run checks:

```bash
cd webapp
npm run lint
npm run check-types
npm test -- --runInBand --watchman=false
```

Run Go tests:

```bash
go test ./...
```

Build the installable plugin:

```bash
make dist
```

Result:

```bash
dist/com.zilosoft.quote-reply-<version>.tar.gz
```

## GitHub Actions

The repository includes two workflows:

- `ci.yml`: reusable CI on push, PR, and tags
- `release.yml`: builds the plugin, runs tests, creates checksums, and publishes GitHub Releases for `v*` tags

To publish a release:

1. Bump `plugin.json` version
2. Commit the change
3. Push a tag like `v0.1.12`

The release workflow will attach:

- plugin bundle `.tar.gz`
- `checksums.txt`

## Notes

- The plugin uses Mattermost webapp extension points and DOM detection, so exact behavior can depend on Mattermost frontend markup.
- Full native Telegram parity would still require a Mattermost core fork.
