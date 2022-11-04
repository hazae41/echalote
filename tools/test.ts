const key = await crypto.subtle.generateKey({ name: "AES-CTR", length: 128 }, true, ["encrypt", "decrypt"])

const hello = new TextEncoder().encode("Hello World")

const counter = new Uint8Array(16)

console.log(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CTR", counter, length: 64 }, key, hello)))



console.log(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CTR", counter, length: 64 }, key, hello)))