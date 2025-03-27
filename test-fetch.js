// test-fetch.js
// Use native fetch if Node >= 18, otherwise install and require node-fetch
// const fetch = require('node-fetch'); // Uncomment if using older Node + node-fetch package

const url = "https://efabsoerrhusepckjtht.supabase.co/rest/v1/"; // Use the same URL you hardcoded

console.log(`Attempting to fetch (Node.js): ${url}`);

fetch(url, { method: "HEAD" }) // Just get headers
  .then((res) => {
    console.log("Node Fetch Success!");
    console.log("Status:", res.status);
    // console.log('Headers:', res.headers.raw()); // Optional: view headers
  })
  .catch((err) => {
    console.error("Node Fetch Failed!");
    console.error(err); // Log the specific error
  });
