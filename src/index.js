// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict';

var AWS = require('aws-sdk');
var ecs = new AWS.ECS();

// Reading environment variables
const ecsClusterArn = process.env.ecsClusterArn;
const ecsTaskDefinationArn = process.env.ecsTaskDefinationArn;
const ecsContainerName = process.env.ecsContainerName;

let responseBody = {
    message: '',
    input: ''
};

let response = {
    statusCode: 200,
    headers: {},
    body: ''
};
 
exports.handler = function(event, context, callback) {
    let meetingURL = "";
    let taskId = "";
    let action = "";
    let rtmpEndpoint = "";
    
    console.log("event", event);
    responseBody.input = event;
    
    if(event.queryStringParameters && event.queryStringParameters.action) {
        console.log("Broadcast Action: " + event.queryStringParameters.action);
        action = event.queryStringParameters.action;
    }
    
    switch(action.toLowerCase()) {
        case 'start':
            if(event.queryStringParameters 
                && event.queryStringParameters.meetingURL
                && event.queryStringParameters.rtmpEndpoint) {
                console.log("Meeting URL: " + event.queryStringParameters.meetingURL);
                console.log("RTMP Endpoint: " + event.queryStringParameters.rtmpEndpoint);
                meetingURL = decodeURIComponent(event.queryStringParameters.meetingURL);
                rtmpEndpoint = decodeURIComponent(event.queryStringParameters.rtmpEndpoint);
                return startRecording(event, context, callback, meetingURL, rtmpEndpoint);
            } else {
                responseBody = {
                    message: "Missing parameter: meetingURL or rtmpEndpoint",
                    input: event
                };
                response = {
                    statusCode: 400,
                    headers: {},
                    body: JSON.stringify(responseBody, null, ' ')
                };
                context.succeed(response);
            }
        case 'stop':
            if(event.queryStringParameters && event.queryStringParameters.taskId) {
                console.log("ECS task ID: " + event.queryStringParameters.taskId);
                taskId = event.queryStringParameters.taskId;
                return stopRecording(event, context, taskId);
            } else {
                responseBody = {
                    message: "Missing parameter: taskId",
                    input: event
                };
                response = {
                    statusCode: 400,
                    headers: {},
                    body: JSON.stringify(responseBody, null, ' ')
                };
                context.succeed(response);
            }
        default:
            responseBody = {
                message: "Invalid parameter: action. Valid values 'start' & 'stop'",
                input: event
            };
            response = {
                statusCode: 400,
                headers: {},
                body: JSON.stringify(responseBody)
            };
    }
    
    console.log("response: " + JSON.stringify(response));
    callback(null, response);
};

function startRecording(event, context, callback, meetingUrl, rtmpEndpoint) {
    let ecsRunTaskParams = {
        cluster: ecsClusterArn,
        launchType: "EC2",
        count: 1,
        overrides: {
            containerOverrides: [ 
                 { 
                    environment: [ 
                        { 
                            name: "MEETING_URL",
                            value: meetingUrl
                        },
                        {
                            name: "RTMP_URL",
                            value: rtmpEndpoint
                        }
                    ],
                    name: ecsContainerName
                }
            ],
        },
        placementConstraints: [{
            type: "distinctInstance"
        }],
        taskDefinition: ecsTaskDefinationArn
    };
    
    console.log("ecsRunTaskParams:", JSON.stringify(ecsRunTaskParams));
    
    ecs.runTask(ecsRunTaskParams, function(err, data) {
        if (err) {
            console.log("run task error: ", err);   // an error occurred
            response.statusCode = err.statusCode;
            response.body = JSON.stringify(err, null, ' ');
            context.succeed(response);
        }
        else {
            console.log("run task succeed", data);  // successful response
            response.statusCode = 200;
            response.body = JSON.stringify((data.tasks.length && data.tasks[0].taskArn) ? data.tasks[0].taskArn : data, null, ' ');
            context.succeed(response);
        }
    });
}

function stopRecording(event, context, taskId) {
    let ecsStopTaskParam = {
        cluster: ecsClusterArn,
        task: taskId
    };
    
    ecs.stopTask(ecsStopTaskParam, function(err, data) {
        if (err) {
            console.log(err);   // an error occurred
            response.statusCode = err.statusCode;
            response.body = JSON.stringify(err, null, ' ');
            context.succeed(response);
        }
        else {
            console.log(data);  // successful response
            response.statusCode = 200;
            responseBody = data;
            response.body = JSON.stringify(data, null, ' ');
            console.log("Stop task succeeded.", response);
            context.succeed(response);
        }
    });
}