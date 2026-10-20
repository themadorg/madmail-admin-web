# Madmail Admin Web Panel

The web-based administration panel for [Madmail](https://github.com/themadorg/madmail) — a mad fork of [maddy](https://github.com/foxcpp/maddy), optimized for instant, secure messaging with [Delta Chat](https://delta.chat).

## Tech Stack

- [SvelteKit](https://svelte.dev/docs/kit) with TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- Static adapter for deployment to GitHub Pages

## Development

```sh
bun install
bun run dev
```

## Building

```sh
bun run build
bun run preview
```

## Deployment

This project is automatically deployed to GitHub Pages on every push to `main` via GitHub Actions. Versioning is handled by [semantic-release](https://github.com/semantic-release/semantic-release) using [Conventional Commits](https://www.conventionalcommits.org).

### Docker Image

It is also available as a Docker image published on GitHub Container Registry (GHCR):

```sh
docker pull ghcr.io/themadorg/madmail-admin-web:latest
docker run -p 8080:80 ghcr.io/themadorg/madmail-admin-web:latest
```

## License

Licensed under [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.en.html).

## Operator webhooks

Services includes the admin-only `/admin/services/webhooks` form for a compatible
Madmail server (the server implementation is tracked in themadorg/madmail#74).
It supports the master/event switches, HTTPS receiver, optional signing secret,
request timeout, retries, delivery counters and a test using saved configuration.
The server never returns the signing secret. An empty password field preserves
it; clearing requires an explicit checkbox. It is not saved to browser storage.

Run `bun run check`, `bun test`, and `bun run build`. Form tests cover secret
preservation/clearing and prevent read-only counters from being sent as settings.
