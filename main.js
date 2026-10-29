export class DelibAPI {
    static #toUint8Array = str => (new TextEncoder()).encode(str);
    static #toBase64 = bytes => btoa(bytes.reduce((s, b) => s + String.fromCharCode(b), ""));
    static #fromBase64 = base64 => Uint8Array.from(atob(base64), char => char.charCodeAt(0));

    static #isIPv6(ip) {
        if (typeof ip !== "string" || ip == "") return;

        try {
            const url = new URL(`http://[${ip}]/`);
            return url.hostname.startsWith("[") && url.hostname.endsWith("]");
        } catch {
            return;
        }
    }

    static #isIPv4(ip) {
        if (typeof ip !== "string") return;

        const seg = ip.trim().split(".");
        if (seg.length !== 4) return;

        return seg.every(part =>
            /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255
        );
    }

    static #validateIP = ip => this.#isIPv4(ip) || this.#isIPv6(ip);
    static #validateCmd = cmd => typeof cmd === "string" && cmd.trim().length >= 1;
    static #validateSecret = secret_str => new TextEncoder().encode(secret_str).length == 32;

    /** Encrypts data using aes-256-gcm.
     * `data` - string data to encrypt;
     * `secret_str` - 32-bytes key as a string.
     */
    static async #encrypt(data, secret_str) {
        const secret_bytes = this.#toUint8Array(secret_str);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const secret = await crypto.subtle.importKey(
            "raw", secret_bytes, { name: "AES-GCM" }, false, ["encrypt"]
        );

        const cipher_n_tag = new Uint8Array(await crypto.subtle.encrypt(
            { name: "AES-GCM", iv, tagLength: 128 }, secret, this.#toUint8Array(data)
        ));

        const result = new Uint8Array(iv.length + cipher_n_tag.length);
        result.set(iv, 0);
        result.set(cipher_n_tag, iv.length);

        return this.#toBase64(result);
    }

    /** 
     * Decrypts data using aes-256-gcm. 
     * `enc_base64` - an encrypted base64 hash string to decrypt.
     * `secret_str` - 32-bytes key as a string.
     * */
    static async #decrypt(enc_base64, secret_str) {
        if (!enc_base64) return;

        const secret_bytes = this.#toUint8Array(secret_str);
        const data = this.#fromBase64(enc_base64);
        const iv_len = 12;
        const tag_size = 16; // 16 * 8 = 128bit gcm tag

        if (data.length < iv_len + tag_size) {
            return false;
        }

        const iv = data.slice(0, iv_len); // iv slice
        const cipher_n_tag = data.slice(iv_len); // cipher + tag slice

        const secret = await crypto.subtle.importKey(
            "raw", secret_bytes, { name: "AES-GCM" }, false, ["decrypt"]
        );

        const result = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv, tagLength: 128 }, secret, cipher_n_tag
        );

        return (new TextDecoder()).decode(result);
    }

    /** Sends async request with following arguments.
     * `ip` - Device IP (IPv4/IPv6) address to send request to.
     * `secret_str` - 32-bytes device secret string used to encrypt data transfer.
     * `command` - Some command to send as a string.
     */
    static async request(ip, secret_str, command) {
        if (!this.#validateIP(ip)) return console.error("Invalid device IP.");
        if (!this.#validateSecret(secret_str)) return console.error("Invalid device secret.");
        if (!this.#validateCmd(command)) return console.error("Invalid device command.");

        let response;

        let body = await this.#encrypt(command, secret_str);

        if (!body) return;
        
        let req = await fetch(`http://${ip}:80`, { method: "POST", body });

        if (!req.ok()) return;

        let enc_base64 = await req.text();
        response = this.#decrypt(enc_base64, secret_str);

        if (!response) return;

        return response;
    }
}