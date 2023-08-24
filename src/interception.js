const PUBLIC_TOKEN = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
const NEW_API = 'https://twitter.com/i/api/graphql';
const cursors = {};

function parseNoteTweet(result) {
    let text, entities;
    if(result.note_tweet.note_tweet_results.result) {
        text = result.note_tweet.note_tweet_results.result.text;
        entities = result.note_tweet.note_tweet_results.result.entity_set;
        if(result.note_tweet.note_tweet_results.result.richtext?.richtext_tags.length) {
            entities.richtext = result.note_tweet.note_tweet_results.result.richtext.richtext_tags // logically, richtext is an entity, right?
        }
    } else {
        text = result.note_tweet.note_tweet_results.text;
        entities = result.note_tweet.note_tweet_results.entity_set;
    }
    return {text, entities};
}

function parseTweet(res) {
    if(typeof res !== "object") return;
    if(res.limitedActionResults) {
        let limitation = res.limitedActionResults.limited_actions.find(l => l.action === "Reply");
        if(limitation) {
            res.tweet.legacy.limited_actions_text = limitation.prompt ? limitation.prompt.subtext.text : "This tweet has limitations to who can reply.";
        }
        res = res.tweet;
    }
    if(!res.legacy && res.tweet) res = res.tweet;
    let tweet = res.legacy;
    if(!res.core) return;
    tweet.user = res.core.user_results.result.legacy;
    tweet.user.id_str = tweet.user_id_str;
    if(res.core.user_results.result.is_blue_verified) {
        tweet.user.verified = true;
        tweet.user.verified_type = "Blue";
    }
    if(tweet.retweeted_status_result) {
        let result = tweet.retweeted_status_result.result;
        if(result.limitedActionResults) {
            let limitation = result.limitedActionResults.limited_actions.find(l => l.action === "Reply");
            if(limitation) {
                result.tweet.legacy.limited_actions_text = limitation.prompt ? limitation.prompt.subtext.text : "This tweet has limitations to who can reply.";
            }
            result = result.tweet;
        }
        if(
            result.quoted_status_result && 
            result.quoted_status_result.result.legacy &&
            result.quoted_status_result.result.core &&
            result.quoted_status_result.result.core.user_results.result.legacy    
        ) {
            result.legacy.quoted_status = result.quoted_status_result.result.legacy;
            if(result.legacy.quoted_status) {
                result.legacy.quoted_status.user = result.quoted_status_result.result.core.user_results.result.legacy;
                result.legacy.quoted_status.user.id_str = result.legacy.quoted_status.user_id_str;
                if(result.quoted_status_result.result.core.user_results.result.is_blue_verified) {
                    result.legacy.quoted_status.user.verified = true;
                    result.legacy.quoted_status.user.verified_type = "Blue";
                }
            } else {
                console.warn("No retweeted quoted status", result);
            }
        }
        tweet.retweeted_status = result.legacy;
        if(tweet.retweeted_status && result.core.user_results.result.legacy) {
            tweet.retweeted_status.user = result.core.user_results.result.legacy;
            tweet.retweeted_status.user.id_str = tweet.retweeted_status.user_id_str;
            if(result.core.user_results.result.is_blue_verified) {
                tweet.retweeted_status.user.verified = true;
                tweet.retweeted_status.user.verified_type = "Blue";
            }
            tweet.retweeted_status.ext = {};
            if(result.views) {
                tweet.retweeted_status.ext.views = {r: {ok: {count: +result.views.count}}};
            }
            if(res.card && res.card.legacy && res.card.legacy.binding_values) {
                tweet.retweeted_status.card = res.card.legacy;
            }
        } else {
            console.warn("No retweeted status", result);
        }
        if(result.note_tweet && result.note_tweet.note_tweet_results) {
            let note = parseNoteTweet(result);
            tweet.retweeted_status.full_text = note.text;
            tweet.retweeted_status.entities = note.entities;
            tweet.retweeted_status.display_text_range = undefined; // no text range for long tweets
        }
    }

    if(res.quoted_status_result) {
        tweet.quoted_status_result = res.quoted_status_result;
    }
    if(res.note_tweet && res.note_tweet.note_tweet_results) {
        let note = parseNoteTweet(res);
        tweet.full_text = note.text;
        tweet.entities = note.entities;
        tweet.display_text_range = undefined; // no text range for long tweets
    }
    if(tweet.quoted_status_result) {
        let result = tweet.quoted_status_result.result;
        if(!result.core && result.tweet) result = result.tweet;
        if(result.limitedActionResults) {
            let limitation = result.limitedActionResults.limited_actions.find(l => l.action === "Reply");
            if(limitation) {
                result.tweet.legacy.limited_actions_text = limitation.prompt ? limitation.prompt.subtext.text : "This tweet has limitations to who can reply.";
            }
            result = result.tweet;
        }
        tweet.quoted_status = result.legacy;
        if(tweet.quoted_status) {
            tweet.quoted_status.user = result.core.user_results.result.legacy;
            if(!tweet.quoted_status.user) {
                delete tweet.quoted_status;
            } else {
                tweet.quoted_status.user.id_str = tweet.quoted_status.user_id_str;
                if(result.core.user_results.result.is_blue_verified) {
                    tweet.quoted_status.user.verified = true;
                    tweet.quoted_status.user.verified_type = "Blue";
                }
                tweet.quoted_status.ext = {};
                if(result.views) {
                    tweet.quoted_status.ext.views = {r: {ok: {count: +result.views.count}}};
                }
            }
        } else {
            console.warn("No quoted status", result);
        }
    }
    if(res.card && res.card.legacy) {
        tweet.card = res.card.legacy;
        let bvo = {};
        for(let i = 0; i < tweet.card.binding_values.length; i++) {
            let bv = tweet.card.binding_values[i];
            bvo[bv.key] = bv.value;
        }
        tweet.card.binding_values = bvo;
    }
    if(res.views) {
        if(!tweet.ext) tweet.ext = {};
        tweet.ext.views = {r: {ok: {count: +res.views.count}}};
    }
    if(res.source) {
        tweet.source = res.source;
    }
    if(res.birdwatch_pivot) { // community notes
        tweet.birdwatch = res.birdwatch_pivot;
    }

    if(tweet.favorited && tweet.favorite_count === 0) {
        tweet.favorite_count = 1;
    }
    if(tweet.retweeted && tweet.retweet_count === 0) {
        tweet.retweet_count = 1;
    }

    return tweet;
}

function getCurrentUserId() {
    let accounts = TD.storage.accountController.getAll();
    let screen_name = TD.storage.accountController.getUserIdentifier();
    let account = accounts.find(account => account.state.username === screen_name);
    return account.state.userId;
}

function generateParams(features, variables, fieldToggles) {
    let params = new URLSearchParams();
    params.append('variables', JSON.stringify(variables));
    params.append('features', JSON.stringify(features));
    if(fieldToggles) params.append('fieldToggles', JSON.stringify(fieldToggles));

    return params.toString();
}

const OriginalXHR = XMLHttpRequest;
const proxyRoutes = [
    {
        path: '/1.1/statuses/user_timeline.json',
        method: 'GET',
        beforeRequest: xhr => {
            xhr.modReqHeaders['Authorization'] = PUBLIC_TOKEN;
            try {
                let url = new URL(xhr.modUrl);
                let params = new URLSearchParams(url.search);
                let user_id = params.get('user_id');
                let variables = {"count":100,"includePromotedContent":false,"withQuickPromoteEligibilityTweetFields":false,"withVoice":true,"withV2Timeline":true};
                let features = {"rweb_lists_timeline_redesign_enabled":false,"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"tweetypie_unmention_optimization_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":false,"tweet_awards_web_tipping_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":true,"responsive_web_media_download_video_enabled":false,"responsive_web_enhance_cards_enabled":false};
                let fieldToggles = {"withArticleRichContentState":false};
                if(!user_id) {
                    variables.userId = getCurrentUserId();
                } else {
                    variables.userId = user_id;
                }
                let max_id = params.get('max_id');
                if(max_id) {
                    let bn = BigInt(params.get('max_id'));
                    bn += BigInt(1);
                    if(cursors[`${variables.userId}-${bn}`]) {
                        variables.cursor = cursors[`${variables.userId}-${bn}`];
                    }
                }
                xhr.storage.user_id = variables.userId;
                xhr.modUrl = `${NEW_API}/wxoVeDnl0mP7VLhe6mTOdg/UserTweetsAndReplies?${generateParams(features, variables, fieldToggles)}`;
            } catch(e) {
                console.error(e);
            }
        },
        afterRequest: xhr => {
            try {
                data = JSON.parse(xhr.responseText);
            } catch(e) {
                console.error(e);
                return [];
            }
            if (data.errors && data.errors[0]) {
                return [];
            }
            let instructions = data.data.user.result.timeline_v2.timeline.instructions;
            let entries = instructions.find(e => e.type === "TimelineAddEntries");
            if(!entries) {
                return [];
            }
            entries = entries.entries;
            let tweets = [];
            for(let entry of entries) {
                if(entry.entryId.startsWith("tweet-")) {
                    let result = entry.content.itemContent.tweet_results.result;
                    let tweet = parseTweet(result);
                    if(tweet) {
                        tweet.hasModeratedReplies = entry.content.itemContent.hasModeratedReplies;
                        tweets.push(tweet);
                    }
                } else if(entry.entryId.startsWith("profile-conversation-")) {
                    let items = entry.content.items;
                    for(let i = 0; i < items.length; i++) {
                        let item = items[i];
                        let result = item.item.itemContent.tweet_results.result;
                        if(item.entryId.includes("-tweet-")) {
                            let tweet = parseTweet(result);
                            if(!tweet) continue;

                            if(i !== items.length - 1) tweet.threadContinuation = true;
                            if(i !== 0) tweet.noTop = true;

                            tweet.hasModeratedReplies = item.item.itemContent.hasModeratedReplies;
                            tweets.push(tweet);
                        }
                    }
                }
            }

            let cursor = entries.find(e => e.entryId.startsWith("sq-cursor-bottom-") || e.entryId.startsWith("cursor-bottom-")).content.value;
            if(cursor) {
                cursors[`${xhr.storage.user_id}-${tweets[tweets.length-1].id_str}`] = cursor;
            }

            return tweets;
        }
    },
    {
        path: '/1.1/search/universal.json',
        method: 'GET',
        beforeRequest: xhr => {
            xhr.modReqHeaders['Authorization'] = PUBLIC_TOKEN;
            try {
                let url = new URL(xhr.modUrl);
                let params = new URLSearchParams(url.search);
                let variables = {
                    rawQuery: params.get('q'),
                    count: 40,
                    querySource: 'typed_query',
                    product: "Latest",
                };
                let features = {"rweb_lists_timeline_redesign_enabled":false,"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"tweetypie_unmention_optimization_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":false,"tweet_awards_web_tipping_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":true,"responsive_web_media_download_video_enabled":false,"responsive_web_enhance_cards_enabled":false};

                xhr.modUrl = `${NEW_API}/nK1dw4oV3k4w5TdtcAdSww/SearchTimeline?${generateParams(features, variables)}`;
            } catch(e) {
                console.error(e);
            }
        },
        afterRequest: xhr => {
            try {
                data = JSON.parse(xhr.responseText);
            } catch(e) {
                console.error(e);
                return [];
            }
            if (data.errors && data.errors[0]) {
                return [];
            }
            let instructions = data.data.search_by_raw_query.search_timeline.timeline.instructions;
            let entries = instructions.find(i => i.entries);
            if(!entries) {
                return [];
            }
            entries = entries.entries;
            let res = [];
            for(let entry of entries) {
                if(entry.entryId.startsWith('sq-I-t-') || entry.entryId.startsWith('tweet-')) {
                    let result = entry.content.itemContent.tweet_results.result;

                    if(entry.content.itemContent.promotedMetadata) {
                        continue;
                    }
                    let tweet = parseTweet(result);
                    if(!tweet) {
                        continue;
                    }
                    res.push(tweet);
                }
            }
            let cursor = entries.find(e => e.entryId.startsWith('sq-cursor-bottom-') || e.entryId.startsWith('cursor-bottom-'));
            if(cursor) {
                cursor = cursor.content.value;
            } else {
                cursor = instructions.find(e => e.entry_id_to_replace && (e.entry_id_to_replace.startsWith('sq-cursor-bottom-') || e.entry_id_to_replace.startsWith('cursor-bottom-')));
                if(cursor) {
                    cursor = cursor.entry.content.value;
                } else {
                    cursor = null;
                }
            }

            return {
                metadata: {
                    cursor,
                    refresh_interval_in_sec: 30
                },
                modules: res.map(t => ({status: {data: t}}))
            };
        }
    },
    {
        path: '/1.1/users/search.json',
        method: 'GET',
        beforeRequest: xhr => {
            xhr.modReqHeaders['Authorization'] = PUBLIC_TOKEN;
            try {
                let url = new URL(xhr.modUrl);
                let params = new URLSearchParams(url.search);
                let variables = {
                    rawQuery: params.get('q'),
                    count: 20,
                    querySource: 'typed_query',
                    product: "People",
                };
                let features = {"rweb_lists_timeline_redesign_enabled":false,"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"tweetypie_unmention_optimization_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":false,"tweet_awards_web_tipping_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":true,"responsive_web_media_download_video_enabled":false,"responsive_web_enhance_cards_enabled":false};

                xhr.modUrl = `${NEW_API}/nK1dw4oV3k4w5TdtcAdSww/SearchTimeline?${generateParams(features, variables)}`;
            } catch(e) {
                console.error(e);
            }
        },
        afterRequest: xhr => {
            try {
                data = JSON.parse(xhr.responseText);
            } catch(e) {
                console.error(e);
                return [];
            }
            if (data.errors && data.errors[0]) {
                return [];
            }
            let instructions = data.data.search_by_raw_query.search_timeline.timeline.instructions;
            let entries = instructions.find(i => i.entries);
            if(!entries) {
                return [];
            }
            entries = entries.entries;
            let res = [];
            for(let entry of entries) {
                if(entry.entryId.startsWith('sq-I-u-') || entry.entryId.startsWith("user-")) {
                    let result = entry.content.itemContent.user_results.result;
                    if(!result || !result.legacy) {
                        console.log("Bug: no user", entry);
                        continue;
                    }
                    let user = result.legacy;
                    user.id_str = result.rest_id;
                    res.push(user);
                }
            }
            let cursor = entries.find(e => e.entryId.startsWith('sq-cursor-bottom-') || e.entryId.startsWith('cursor-bottom-'));
            if(cursor) {
                cursor = cursor.content.value;
            } else {
                cursor = instructions.find(e => e.entry_id_to_replace && (e.entry_id_to_replace.startsWith('sq-cursor-bottom-') || e.entry_id_to_replace.startsWith('cursor-bottom-')));
                if(cursor) {
                    cursor = cursor.entry.content.value;
                } else {
                    cursor = null;
                }
            }

            return res;
        }
    }
];

// wrap the XMLHttpRequest
XMLHttpRequest = function () {
    return new Proxy(new OriginalXHR(), {
        open(method, url, async, username = null, password = null) {
            this.modMethod = method;
            this.modUrl = url;
            this.originalUrl = url;
            this.modReqHeaders = {};
            this.storage = {};
            
            try {
                let parsedUrl = new URL(url);
                this.proxyRoute = proxyRoutes.find(route => route.path === parsedUrl.pathname && route.method.toUpperCase() === method.toUpperCase());
            } catch(e) {
                console.error(e);
            }
            if(this.proxyRoute && this.proxyRoute.beforeRequest) {
                this.proxyRoute.beforeRequest(this);
            }

            this.open(method, this.modUrl, async, username, password);
        },
        setRequestHeader(name, value) {
            this.modReqHeaders[name] = value;
        },
        send(body = null) {
            for (const [name, value] of Object.entries(this.modReqHeaders)) {
                this.setRequestHeader(name, value);
            }
            this.send(body);
        },
        get(xhr, key) {
            if (!key in xhr) return undefined;
            if(key === 'responseText') return this.interceptResponseText(xhr);

            let value = xhr[key];
            if (typeof value === "function") {
                value = this[key] || value;
                return (...args) => value.apply(xhr, args);
            } else {
                return value;
            }
        },
        set(xhr, key, value) {
            if (key in xhr) {
                xhr[key] = value;
            }
            return value;
        },
        interceptResponseText(xhr) {
            if(xhr.proxyRoute && xhr.proxyRoute.afterRequest) {
                let out = xhr.proxyRoute.afterRequest(xhr);
                if(typeof out === "object") {
                    return JSON.stringify(out);
                } else {
                    return out;
                }
            }
            return xhr.responseText;
        }
    });
}