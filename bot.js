#!/usr/bin/env node
require('dotenv').config();

const { Cron } = require('croner');
const https = require('https');
const { TwitterApi, ApiResponseError } = require('twitter-api-v2');

// Combine all the songs
var allSongs = [
	...require('./songs/songs.json'),
	...require('./songs/days_of_thunder.json'),
	...require('./songs/endless_summer.json'),
	...require('./songs/nocturnal.json'),
	...require('./songs/kids.json'),
	...require('./songs/monsters.json'),
	...require('./songs/horror_show.json'),
	...require('./songs/heroes.json'),
];

const getRandomInt = (max) => {
	return Math.floor(Math.random() * max);
}

const getPostContent = () => {
	// Special post at midnight
	if (new Date().getHours() === 0) {
		var post = 'We are one beating heart';
		var reply = '💓';
	}

	else {
		// Get a random song from files
		var randomInt = getRandomInt(allSongs.length - 1);
		var song = allSongs[randomInt];
		// Then get a random lyric from that song
		var lyrics = song.lyrics.split('|');
		var post = lyrics[getRandomInt(lyrics.length - 1)];
		// Get spotify id of song
		var id = song.id;
		var emoji = song.emoji;
		var reply = song.reply;

		// If reply is undefined, create one with emoji (if exist) and Spotify link
		if (reply === undefined) {
			reply = emoji
				? `${emoji} https://open.spotify.com/track/${id}`
				: `https://open.spotify.com/track/${id}`;
		}
	}

	return {
		'post': post,
		'reply': reply
	}
}

// Lyric posting bot
const lyricPost = () => {
	// Twitter integration
	if (process.env.TWITTER_ACTIVE == 'true') {
		const twitterClient = new TwitterApi({
			appKey: process.env.TWITTER_API_KEY,
			appSecret: process.env.TWITTER_API_SECRET_KEY,
			accessToken: process.env.TWITTER_ACCESS_TOKEN,
			accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
		}).readWrite.v2;

		const lyricTweet = async () => {
			var tweet = getPostContent();

			// Tweet that lyric
			try {
				const {data: createdTweet} = await twitterClient.tweet(tweet.post);
				console.log('Tweet sent: ' + createdTweet.text);

				const {data: replyTweet} = await twitterClient.reply(tweet.reply, createdTweet.id);
				console.log('Reply sent: ' + replyTweet.text);
			}

			catch (e) {
				if (e instanceof ApiResponseError && e.code === 403) {
					console.log('Tweet with duplicate content detected (error 403) - retrying lyricTweet()');
					lyricTweet();
				}

				else
					console.error(e);
			}
		}

		lyricTweet();
	}
}

// Post at every 2 hours
const lyricJob = Cron('00 */2 * * *', () => {
	lyricPost();
});

// UptimeRobot heartbeat monitoring
if (process.env.UPTIMEROBOT_HEARTBEAT_URL !== '') {
	Cron('*/5 * * * *', () => {
		https.get(process.env.UPTIMEROBOT_HEARTBEAT_URL);
	});
}

var minsUntilNextPost = Math.ceil(lyricJob.msToNext() / 1000 / 60);
console.log('Bot has started successfully - ' + minsUntilNextPost + ' minutes until next post.');

lyricPost();
