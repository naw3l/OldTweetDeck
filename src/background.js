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

const isFirefox = typeof browser !== "undefined";

// Store the URL of the tab that initiated the request.
let urls = {};

const flushCache = chrome.webRequest.handlerBehaviorChanged;

chrome.webNavigation.onCommitted.addListener(
    function (details) {
        // Flushes in-memory cache when moving from other twitter.com sites to TweetDeck,
        // because if cache hits, `onBeforeRequest` event won't be called (and thus we can't block unwanted requests below).
        // Only needed in Chrome. See: https://developer.chrome.com/docs/extensions/reference/webRequest/#caching
        if (
            !isFirefox &&
            urls[details.tabId]?.[details.frameId].startsWith(
                "https://twitter.com/",
            ) &&
            details.transitionType !== "reload" &&
            details.url === "https://twitter.com/i/tweetdeck"
        ) {
            flushCache();
        // Update stored URL
        }
        if (details.tabId === -1 || details.frameId !== 0) {
            return;
        }
        if (!urls.hasOwnProperty(details.tabId)) {
            urls[details.tabId] = {};
        }
        urls[details.tabId][details.frameId] = details.url;
    },
    { url: [{ hostSuffix: "twitter.com" }] },
);

// Block requests for files related to Web App, except for main.{random}.js (which may be needed for API connection)
chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        try {
            let parsedUrl = new URL(details.url);
            let path = parsedUrl.pathname;
            // want to use details.originUrl but it's not available in Chrome
            let requestFrom = urls[details.tabId][details.frameId];
            if (
                path.startsWith("/responsive-web/client-web/") &&
                requestFrom === "https://twitter.com/i/tweetdeck"
            ) {
                return {
                    cancel: true,
                };
            }
        } catch (e) {}
    },
    { urls: ["https://abs.twimg.com/*"] },
    ["blocking"],
);