const extraInfoSpec = ["blocking", "responseHeaders"];
if (chrome.webRequest.OnHeadersReceivedOptions.hasOwnProperty("EXTRA_HEADERS")) {
    extraInfoSpec.push("extraHeaders");
}

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        let headers = details.responseHeaders.filter(header => header.name.toLowerCase() !== 'content-security-policy' && header.name.toLowerCase() !== 'location');
        return {
            responseHeaders: headers
        }
    },
    {urls: ["https://twitter.com/i/tweetdeck"]},
    extraInfoSpec
);

chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        let headers = details.requestHeaders.filter(header => header.name.toLowerCase() !== 'referer');
        return {
            requestHeaders: headers
        }
    },
    {urls: ["https://twitter.com/i/api/graphql/*"]},
    extraInfoSpec.map(s => s.replace('response', 'request'))
)

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        try {
            let parsedUrl = new URL(details.url);
            let path = parsedUrl.pathname;
            if(path === '/decider') {
                return {
                    redirectUrl: chrome.runtime.getURL('/files/decider.json')
                }
            } else if(path === '/web/dist/version.json') {
                return {
                    redirectUrl: chrome.runtime.getURL('/files/version.json')
                }
            };
        } catch(e) {}
    },
    {urls: ["https://*.twitter.com/*"]},
    ["blocking"]
);

chrome.webRequest.onBeforeRequest.addListener(
    function() {
        return {
            redirectUrl: 'https://twitter.com/i/tweetdeck'
        }
    },
    {urls: ["https://tweetdeck.twitter.com/*"]},
    ["blocking"]
);