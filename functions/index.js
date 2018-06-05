/**
 * packages and libraries
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const natural = require('natural');
const req = require('request');
const https = require("https");
const nodemailer = require("nodemailer");
const language = require('@google-cloud/language');

/**
 * email, password, and mailTransporter for email notification service
 */
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mapAPIKey = functions.config().map.key;
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

admin.initializeApp(functions.config().firebase);

// Instantiates a clientd
const client = new language.LanguageServiceClient();

/**
 * tokenizer is the function variable references the natural.WordTokenizer()
 * @type {function} - function reference
 */
let firstTime = true;
var tokenizer = new natural.WordTokenizer();

/**
 * classifier is the function variable references the natural.BayesClassifier()
 * @type {function} - function reference
 */
var classifier = new natural.BayesClassifier();

/**
 * This is a static variable keep track of whether it is the first time for the function to be excuted
 */
var db = admin.database();

// Training Data
classifier.addDocument('Offering  SLO -> SB Tomorrow (Friday) at 5 Returning Saturday afternoon', 'Ride Offer');
classifier.addDocument("OFFERING: Friday 5/4/2018 7pm CAL POLY >>>>> SGV / 626 / LA Sunday 5/6/2018 12pm SGV / 626 >>> CAL POLY $20 HMU", 'Ride Offer');
classifier.addDocument("seeking: May 11th (anytime after 12): SLO to Berkeley  May 13th (anytime): Berkeley to SLO  This is for my older sister's graduation so please let me know if anyone his heading up to Berkeley(-:", 'Ride Seeking');

classifier.train();

// Database connection
var database = admin.database();

// Variable keeps track of the post
var latestPostID = null;
var processedPostsIdArray = [];


// The Mock data
const rideOffermockData = {
  origin: "San Luis Obispo, CA",
  originLat: 35.30199,
  originLon: -120.66381,
  Destination: "San Jose, CA", // (City, State)
  destinationLat: 37.3382,
  destinationLon: -121.8863,
  departureDate: "04/20/2018 14:00",
  seats: 3,
  cost: 20,
  description: "This is a ride"
}

/**
 * Function that is responsible for sending email
 * @param {string} message the message to be send
 * @param {string} toEmail email receiver
 */
let sendEmail = (message, toEmail) => {
  var mailOptions = {
    from: '"Wen He" <noreply@firebase.com>',
    to: toEmail,
    subject: "analysis failed",
    text: "Poly Rire Share NLP can not process " + message
  }

  mailTransport.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}


/**
 * Handles the main logics of NLP
 * @param {string} text - The post string from facebook post
 * @return {object} json object with classification result and token array with a referenceID for the uid
 */
let callGoogleAPI = function (text) {
  const document = {
    content: text,
    type: "PLAIN_TEXT",
  };
  let getAPIResultPromise = client.analyzeEntities({document: document});

  return Promise.all([getAPIResultPromise]).then(result => {
    const entities = result[0].entities;
    return entities;
  }) .catch(err => {
    console.log("ERROR: ", err);    
  })
}

/**
 * Main logics of processing post information
 * 
 * @param {string} message message to be processed
 * @param {string} uid unique referenceID for the post from firebase
 */
let processInfo = function (message, uid) {
  // Calling the textRazor API to process the information
  var tokenizedResult = tokenizer.tokenize(message);
  var classifyResult = classifier.classify(message);

  // Don't want to process ride seekings
  if (classifyResult !== "Ride Offer") {
    return;
  }

  const document = {
    content: message,
    type: "PLAIN_TEXT",
  };
  let getAPIResultPromise = client.analyzeEntities({document: document});

  return Promise.all([getAPIResultPromise]).then(analyzeResult => {
    const entities = analyzeResult[0][0].entities;
    let locations = [];

    entities.forEach(data => {
      console.log("data: ", data)
      if (data.type && data["type"] === "LOCATION") {
        locations.push(data["name"]);
      }
    })

    console.log("locations: ", locations);

    sendEmail("message can not be processed: " + message, "wenmin.he518@gmail.com")
    var result = {
      PostStatus: classifyResult,
      // Token: tokenizedResult,
      ReferenceId: uid,
      origin: locations[0] ? locations[0] : null,
      destination: locations[1] ? locations[1] : null,
      // departureDate: "01 Jan 2018 00:00:00 GMT",
      // result: entities
    }
    return pushToFireBase("processedRides/", result);
  }) .catch(err => {
    console.log("ERROR: ", err);    
  })

}


/**
 * This process the latest post available in the Posts colletions
 */
exports.ProcessNewPosts = functions.database.ref('/Posts/')
  .onWrite((change, context) => {

    // Don't care when the posts are deleted
    if (!change.after.exists()) {
      return null;
    }
    // otherwise, when the posts are updated, push the data
    const original = change.after.val();


    // Only process the newest item in the collection
    let lastItemKey = null;
    Object.keys(original).forEach(element => {
      lastItemKey = element;
    });
    // Update the processedPostsIdArray when id is processed
    if (!processedPostsIdArray.includes(lastItemKey)) {
      let reference = original[lastItemKey];
      let message = reference["message"];
      processedPostsIdArray.push(lastItemKey);
      processInfo(message, lastItemKey);
    }
    return null;
  })



/**
 * This function is pushing the data into the firebase realtime and return a reference of the data pushed
 * @param  {string} path - path for the firebase collection to be pushed
 * @param  {object} jsonObject - the facebook post json object from API call
 * @param  {function} handlerFunction - an optional function for failure handling
 * @return {object} - a collection reference
 */
var pushToFireBase = (path, jsonObject, handlerFunction) => {
  var postReference = database.ref(path).push(jsonObject, handlerFunction)
  return postReference;
}



// Calls the API to actually gets the posts information and add that posts information into posts collection in the database
exports.QueryPostAPI = functions.https.onRequest((request, response) => {
  req('https://us-central1-posts-eb2a3.cloudfunctions.net/restAPI', (error, resp, body) => {
    if (!error && response.statusCode === 200) {
      response.setHeader('Content-Type', 'application/json');
      // Push posts to the Posts collections
      // Parse data
      let posts = JSON.parse(body).data;
      var idx;
      // Keep track of the firstID, it is the the most recent one
      let firstPostID = posts[0]["id"];
      for (idx = 0; idx < posts.length; idx++) {
        let post = posts[idx];
        let postId = post["id"];

        // If the post is not the latestPost, it means new posts are constructed
        // If it is first time running, then add to the posts
        if (latestPostID !== postId || firstTime) {
          pushToFireBase("Posts/", post);
          firstTime = false;
          latestPostID = firstPostID;
        }
        // If lastPostId is reached, stop it
        else if (latestPostID === postId) {
          latestPostID = firstPostID;
          response.send({
            postids: latestPostID
          });
          response.end();
          return;
        }
      }

      // Return in the end
      response.send({
        postids: latestPostID
      });
      response.end();
    }
  })
});


/**
 * Deletes the json collections with the object at key to be older than current time
 * @param {string} path path to the json collection
 * @param {string} key the key that references to the dateTime object to be compared eg. departureDate key with in the mock data
 */
const deleteCollectionBasedOnTime = function (path, key) {
  let ref = db.ref("/" + path);
  ref.once("value", (data) => {
    // Get the json objects
    let dataObj = data.val();
    // Loop through the json objects
    for (let firebaseKey in dataObj) {
      // Compare the dateTime value
      if (dataObj.hasOwnProperty(firebaseKey)) {
        let item = dataObj[firebaseKey];
        if (item[key]) {
          let dateUTC = Date.parse(item[key]);
          let currenTimeUTC = Date.now();
          // Remove object if necessary
          if (dateUTC < currenTimeUTC) {
            ref.child("/" + firebaseKey).remove();
          }
        }
      }
    }
  })
}

exports.deleteOldPosts = functions.https.onRequest((request, response) => {
  // query the database once and then delete all of the old posts
  deleteCollectionBasedOnTime("Posts", "created_time");
  deleteCollectionBasedOnTime("processedRides", "departureDate");
  response.send("DONE");
});



/**
 * Triggers when there is a new ride offer
 *
 * Gets the notification token from the profile, and then send message through cloud messaging service
 */
exports.sendRideOfferMatchingNotification = functions.database.ref('/RideOffer')
  .onWrite((change, context) => {
    // Don't care when the posts are deleted
    if (!change.after.exists()) {
      return null;
    }
    // Gets all of the profile information
    const getDeviceTokenPromise = database.ref("/Profile").once("value");

    return Promise.all([getDeviceTokenPromise]).then(results => {
      let profiles = results[0].val();

      // otherwise, when the posts are updated, push the data
      const original = change.after.val();
      // Only process the newest item in the collection
      let lastItemKey = null;
      object.keys(original).forEach(element => {
        let rideOfferDestination = element["destination"];
        // Loop through the profile array to check for the matches
        for (key in profiles) {
          if (profiles.hasOwnProperty(key)) {
            let profile = profiles[key];
            deviceToken = profile["deviceToken"];
            // send notification only if destination match and there is a deviceToken associated
            if (profile["destination"] === rideOfferDestination && deviceToken) {
              let token = Object.keys(deviceToken);
              const payload = {
                notification: {
                  title: "Matching Ride",
                  body: "There is a ride offer that matches your request to " + rideOfferDestination,
                }
              }
              return admin.messaging().sendToDevice(token, payload);
            }
          }
        }
      })
      return;
    })
  })