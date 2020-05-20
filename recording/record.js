// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const { spawn } = require('child_process');
const { S3Uploader } = require('./utils/upload');

const MEETING_URL = process.env.MEETING_URL || 'Not present in environment';
console.log(`[recording process] MEETING_URL: ${MEETING_URL}`);

const args = process.argv.slice(2);
const BUCKET_NAME = args[0];
console.log(`[recording process] BUCKET_NAME: ${BUCKET_NAME}`);
const BROWSER_SCREEN_WIDTH = args[1];
const BROWSER_SCREEN_HEIGHT = args[2];
console.log(`[recording process] BROWSER_SCREEN_WIDTH: ${BROWSER_SCREEN_WIDTH}, BROWSER_SCREEN_HEIGHT: ${BROWSER_SCREEN_HEIGHT}`);

const VIDEO_BITRATE = 3000;
const VIDEO_FRAMERATE = 30;
const VIDEO_GOP = VIDEO_FRAMERATE * 2;
const AUDIO_BITRATE = '128k';
const AUDIO_SAMPLERATE = 44100;
const AUDIO_CHANNELS = 2
const DISPLAY = process.env.DISPLAY;

const transcodeStreamToOutput = spawn('ffmpeg',[
    '-hide_banner',
    '-loglevel', 'error',
    // disable interaction via stdin
    '-nostdin',
    '-f', 'pulse',
        '-ac', '2',
        '-i', 'default',
    '-c:a', 'aac',
        '-b:a', `${AUDIO_BITRATE}`,
        '-ac', `${AUDIO_CHANNELS}`,
        '-ar', `${AUDIO_SAMPLERATE}`,
    // adjust fragmentation to prevent seeking(resolve issue: muxer does not support non seekable output)
    '-movflags', 'frag_keyframe+empty_moov',
    // set output format to mp4 and output file to stdout
    '-f', 'mp3', '-'
    ]
);

transcodeStreamToOutput.stderr.on('data', data => {
    console.log(`[transcodeStreamToOutput process] stderr: ${(new Date()).toISOString()} ffmpeg: ${data}`);
});

const timestamp = new Date();
const fileTimestamp = timestamp.toISOString().substring(0,19);
const year = timestamp.getFullYear();
const month = timestamp.getMonth() + 1;
const day = timestamp.getDate();
const hour = timestamp.getUTCHours();
const fileName = `${year}${month}${day}-${hour}-${fileTimestamp}.mp3`;
new S3Uploader(BUCKET_NAME, fileName).uploadStream(transcodeStreamToOutput.stdout);

// event handler for docker stop, not exit until upload completes
process.on('SIGTERM', (code, signal) => {
    console.log(`[recording process] exited with code ${code} and signal ${signal}(SIGTERM)`);
    process.kill(transcodeStreamToOutput.pid, 'SIGTERM');
});

// debug use - event handler for ctrl + c
process.on('SIGINT', (code, signal) => {
    console.log(`[recording process] exited with code ${code} and signal ${signal}(SIGINT)`)
    process.kill('SIGTERM');
});

process.on('exit', function(code) {
    console.log('[recording process] exit code', code);
});