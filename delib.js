export class DelibAPI {
    static #toUint8Array = str => (new TextEncoder()).encode(str);
    static #toBase64 = bytes => btoa(bytes.reduce((s, b) => s + String.fromCharCode(b), ""));
    static #fromBase64 = base64 => Uint8Array.from(atob(base64), char => char.charCodeAt(0));

    static #isIPv6(ip) {
        if (typeof ip !== "string") return;

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
    /** True whenever ip is valid */
    static validateIP = ip => this.#isIPv4(ip) || this.#isIPv6(ip);
    /** True whenever data is valid */
    static validateData = data => typeof data === "string" && data.trim().length >= 1;
    /** True whenever secret (AES-GCM private key) is valid */
    static validateSecret = secret_str => new TextEncoder().encode(secret_str).length == 32;

    /** Encrypts data using aes-256-gcm.
     * `data` - plain text data to encrypt;
     * `secret_str` - 32-bytes key as a string.
     */
    static async encrypt(data, secret_str) {
        if (typeof data !== "string") return;
        if (!this.validateSecret(secret_str)) return;

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
    static async decrypt(enc_base64, secret_str) {
        if (typeof enc_base64 !== "string") return;
        if (!this.validateSecret(secret_str)) return;

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

    /** Sends async request with following arguments:
     * 
     * `url_str` - Device direct url address to send request to or some location to a server path to evade cross-origin requests.
     * 
     * `secret_str` - 32-bytes device secret string used to encrypt data transfer.
     * 
     * `data` - Some plain text data to send.
     */
    static async request(url_str, secret_str, data) {
        let response;

        const body = await this.encrypt(data, secret_str);

        if (!body) return;
        
        const req = await fetch(url_str, { method: "POST", body });

        if (!req.ok()) return;

        const enc_base64 = await req.text();

        if (!enc_base64) return;

        response = this.decrypt(enc_base64, secret_str);

        if (!response) return;

        return response;
    }
}