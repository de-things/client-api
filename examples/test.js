import { DelibAPI } from "./delib.min.js";

DelibAPI.request("0.0.0.0", "00000000000000000000000000000000", "!example").then(data => {
    // `data` is a plain text device response
})
.catch(e => {
    console.log("An expected failure!");
});