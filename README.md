### General usage

De:things relies on [GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode) encryption, so this library is just a time-saver that saves you from manually encrypting requests for de:things infrastructure on **client side**.

```js
import { DelibAPI } from "path/to/index.js"

// server entry to send request to (if you use library on client side)
const url_str = "/api";

// You can use URL such as 'http://your_device_ip/' to send requests directly to a ddv,
// but in such case this library will expose cross-origin requests,
// so better way to use it in client code is to create backend server 
// with an entry such '/api' and redirect DelibAPI requests
// to actual de:things devices over the network through the backend.

// 32-byte private key required by AES-256-GCM as a plain text
const secret_str = "<private-key>";

// request body
const data = "!whoami";

DelibAPI.request(url_str, secret_str, data).then(res => {
    if (res) return console.log(res);

    console.log("Failed");
});
```

The code above sends a `POST` request to a server, encrypting `data` with `secret_str`, then handles the server’s response, decrypts its content and returns this content as `res` on success.

So if your server has some `/api` entry you can use it to communicate with de:things devices through a server.
