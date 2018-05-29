/**
 * packages and libraries
 */
const functions = require('firebase-functions');
var admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
var natural = require('natural');
var req = require('request');


/**
 * tokenizer is the function variable references the natural.WordTokenizer()
 * @type {function} - function reference
 */
var tokenizer = new natural.WordTokenizer();

/**
 * classifier is the function variable references the natural.BayesClassifier()
 * @type {function} - function reference
 */
var classifier = new natural.BayesClassifier();

/**
 * This is a static variable keep track of whether it is the first time for the function to be excuted
 */
let firstTime = true;
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
 * Handles the main logics of NLP
 * @param {string} message - The post string from facebook post
 * @param {string} uid - The unique id associated with the firebase collection(firebase collection uid)
 * @return {object} json object with classification result and token array with a referenceID for the uid
//  */
let processInfo = function(message, uid) {
  var tokenizedResult = tokenizer.tokenize(message);  
  var classifyResult = classifier.classify(message);
  var result = {
    PostStatus: classifyResult,
    Token: tokenizedResult,
    ReferenceId: uid
  }
  return result;
}

var rideOfferRef = db.ref("/RideOffer");


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
    console.log("processedPostsIdArray: ", processedPostsIdArray);
    // Update the processedPostsIdArray when id is processed
    if (!processedPostsIdArray.includes(lastItemKey)) {
      let reference = original[lastItemKey];
      let message = reference["message"];
      processedPostsIdArray.push(lastItemKey);
      let jsonReference = processInfo(message, lastItemKey);
      return pushToFireBase("RideOffer/", jsonReference);
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
      console.log("firstTime: ", firstTime);
      let posts = JSON.parse(body).data;

      // Go from button to top on the first time
      if (firstTime) {
        let theId;
        let idx;
        for (idx = posts.length - 1; idx >= 0; idx--) {
          let post = posts[idx];
          theId = post["id"];
          pushToFireBase("Posts/", post);
        }
        firstTime = false;
        latestPostID = theId;
      } 
      // Otherwise go from top to button
      else {
        var idx;
        // Keep track of the firstID, it is the the most recent one
        let firstPostID = posts[0]["id"];
        for (idx = 0; idx < posts.length; idx++) {
          let post = posts[idx];
          let postId = post["id"];
          
          // If the post is not the latestPost, it means new posts are constructed
          if (latestPostID !== postId) {
            pushToFireBase("Posts/", post);
          }
          // Otherwise, it reaches the last post
          else {
            latestPostID = firstPostID;
            response.send({postids: latestPostID});
            response.end();
            return;
          }
        }
      }
      // Return in the end
      response.send({postids: latestPostID});
      response.end();
    }}
  )});



// const rideOffermockData = {
//   origin: "San Luis Obispo, CA", 
//   originLat: 35.30199,
//   originLon: -120.66381, 
//   Destination: "San Jose, CA", // (City, State)
//   destinationLat: 37.3382,
//   destinationLon: -121.8863,
//   departureDate: "04/20/2018 14:00",
//   seats: 3,
//   cost: 20,
//   description: "This is a ride"
//   }

/**
 * Deletes the json collections with the object at key to be older than current time
 * @param {string} path path to the json collection
 * @param {string} key the key that references to the dateTime object to be compared eg. departureDate key with in the mock data
 */
const deleteCollectionBasedOnTime = function(path, key) {
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
          if (dateUTC <  currenTimeUTC) {
            // console.log("something");
            ref.child("/"+firebaseKey).remove();
          }
        }
      }
    }
  })
}

exports.deleteOldPosts = functions.https.onRequest((request, response) => {
  // query the database once and then delete all of the old posts
  deleteCollectionBasedOnTime("Posts", "created_time");
  response.send("DONE");
});



/**
 * Triggers when a user gets a new follower and sends a notification.
 *
 * Followers add a flag to `/followers/{followedUid}/{followerUid}`.
 * Users save their device notification tokens to `/users/{followedUid}/notificationTokens/{notificationToken}`.
 */
exports.sendFollowerNotification = functions.database.ref('/followers/{followedUid}/{followerUid}')
    .onWrite((change, context) => {
      const followerUid = context.params.followerUid;
      const followedUid = context.params.followedUid;
      // If un-follow we exit the function.
      if (!change.after.val()) {
        return console.log('User ', followerUid, 'un-followed user', followedUid);
      }
      console.log('We have a new follower UID:', followerUid, 'for user:', followerUid);

      // Get the list of device notification tokens.
      const getDeviceTokensPromise = admin.database()
          .ref(`/users/${followedUid}/notificationTokens`).once('value');

      // Get the follower profile.
      const getFollowerProfilePromise = admin.auth().getUser(followerUid);

      // The snapshot to the user's tokens.
      let tokensSnapshot;

      // The array containing all the user's tokens.
      let tokens;

      return Promise.all([getDeviceTokensPromise, getFollowerProfilePromise]).then(results => {
        tokensSnapshot = results[0];
        const follower = results[1];

        // Check if there are any device tokens.
        if (!tokensSnapshot.hasChildren()) {
          return console.log('There are no notification tokens to send to.');
        }
        console.log('There are', tokensSnapshot.numChildren(), 'tokens to send notifications to.');
        console.log('Fetched follower profile', follower);

        // Notification details.
        const payload = {
          notification: {
            title: 'You have a new follower!',
            body: `${follower.displayName} is now following you.`,
            icon: follower.photoURL
          }
        };

        // Listing all tokens as an array.
        tokens = Object.keys(tokensSnapshot.val());
        // Send notifications to all tokens.
        return admin.messaging().sendToDevice(tokens, payload);
      }).then((response) => {
        // For each message check if there was an error.
        const tokensToRemove = [];
        response.results.forEach((result, index) => {
          const error = result.error;
          if (error) {
            console.error('Failure sending notification to', tokens[index], error);
            // Cleanup the tokens who are not registered anymore.
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
              tokensToRemove.push(tokensSnapshot.ref.child(tokens[index]).remove());
            }
          }
        });
        return Promise.all(tokensToRemove);
      });
    });
