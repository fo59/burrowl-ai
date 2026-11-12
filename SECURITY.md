# Security Policy

Burrowl AI's main promise is privacy, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

Helpful details:

- what an attacker could do (for example, read chat history, or get personal data into an outgoing search query)
- steps to reproduce, or a failing test
- the affected package (`privacy`, `storage`, `web-search`, ...)

You will get an answer as soon as possible, and credit in the fix unless you prefer otherwise.

## In scope

- Personal data getting past the query filter (`packages/privacy`)
- Chat data readable after deletion, or stored unencrypted on the device (`packages/storage`)
- Web content able to act as instructions to the model or run code
- Requests that leak cookies, referrers or identifiers
