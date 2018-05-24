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
  console.log("message: ", message, " --- ")
  var tokenizedResult = tokenizer.tokenize(message);  
  var classifyResult = classifier.classify(message);
  var result = {
    PostStatus: classifyResult,
    Token: tokenizedResult,
    ReferenceId: uid
  }
  console.log("result: ", result)
  return result;
}

exports.ProcessNewPosts = functions.database.ref('/Posts/')
  .onWrite((change, context) => {
    // Don't care about when the posts are first created
    if (!change.before.exists()) {
      return null;
    }
    // Don't care when the posts are deleted
    if (!change.after.exists()) {
      return null;
    }
    console.log("Comes to the updated posts")
    // otherwise, when the posts are updated, push the data
    const original = change.after.val();
    
    console.log("original value: ", original);
    Object.keys(original).forEach(key => {
      console.log("processedPostsIdArray: ", processedPostsIdArray, " ---- key:", key)
      console.log("has the item: ", processedPostsIdArray.includes(key));
      if (!processedPostsIdArray.includes(key)) {
        let reference = original[key];
        let message = reference["message"];
        processedPostsIdArray.push(key);
        console.log("key: ", key, " --- message: ", message);
        let jsonReference = processInfo(message, key);
        return pushToFireBase("RideOffer2", jsonReference);
      }
    })
    return null;
  })

// Posts analyze firebase function when Posts are updated
// exports.ProcessCreatedPosts = functions.database.ref('/Posts')
//     .onCreate(snapshot => {   
//       console.log("comes to the processed created posts -------");
//       // Edit value whenever there is a change
//       const original = snapshot.val();
//       // const original = snapshot.data.val();
//       console.log(original, " <<< is the original value")
//       Object.keys(original).forEach(key => {
//       // for(var key in original) {
//         // The item processed must be in the postIdArray and not in the processedPostsIdArray to make sure all of the posts are valid and not processed
//         var post = original[key];
//         console.log("key: ", key, " post:", post);
//         var message = post["message"];
//         var postId = post["id"];
//         console.log("message: ", message)
//         var object = processInfo(message, postId);

//         // Handling the deletion and addition of the data
//         processedPostsIdArray.push(key);
//         // Will change this based on the architecture design, but for now just not deleting the messages, but storing them
//         // Post to the RideOffer Collections
//         return snapshot.ref.parent.child('RideOffer/').push(object)
//       })
//       console.log("processedPostsIdArray: ", processedPostsIdArray);
//       return null;
//     });



/**
 * This function is triggered whenever there is new posts on the /Posts collection from firebase real time database
 * @param  {object} snapshot - is the data from real-time databse
 * @returns {newChild | null} - either adding the analyzed post to the RiderOffer collection or skipping the post
 */
// exports.ProcessUpdatedPosts = functions.database.ref('/Posts')
//     .onUpdate(snapshot => {   
//       console.log("comes to the processed update posts <<<<<<<<<")
//       console.log("processedPostsIdArray on the post arrary: ", processedPostsIdArray)

//       // Only care about the changed value
//       const newVal = snapshot.after.val();
//       console.log("newVal: ", newVal);
//       for (let key in original) {
//         if (original.hasOwnProperty(key)) {
//           originalIDs.push(key);
//         }
//       }
      
//       for(var key in newVal) {
//         // The item processed must be in the postIdArray and not in the processedPostsIdArray to make sure all of the posts are valid and not processed
//           console.log("key: ", key);
//           var message = original[key]["message"]
//           var object = processInfo(message, key);

//           processedPostsIdArray.push(key);
//           // Same as the onCreate, do not want to call remove, since it will trigger more onUpdate function whenever there is a change
//           // snapshot.change.ref.child(key).remove()
//           // Post to the RideOffer Collections
//           return snapshot.before.ref.parent.child('RideOffer/').push(object);
//       }
//       return null;
//     });


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


/**
 * Compare the latestPostID and push to the database accordingly
 * @param  {} post
 */
var idComp = (post) => {
  let postId = post["id"];
  if (latestPostID !== postId) {
    latestPostID = postId;
    pushToFireBase("Posts/", post);
  }
}

// Calls the API to actually gets the posts information and add that posts information into posts collection in the database
exports.QueryPostAPI = functions.https.onRequest((request, response) => {
  req('https://us-central1-posts-eb2a3.cloudfunctions.net/restAPI', (error, resp, body) => {
    if (!error && response.statusCode === 200) {
      response.setHeader('Content-Type', 'application/json');
      // Push posts to the Posts collections
      // Parse data
      let posts = JSON.parse(body).data;

      // Go from button to top on the first time
      if (firstTime) {
        let idx;
        for (idx = posts.length - 1; idx >= 0; idx--) {
          let post = posts[idx];
          idComp(post);
        }
        firstTime = false;
      } 
      // Otherwise go from top to button
      else {
        var idx;
        for (idx = 0; idx < posts.length; idx++) {
          let post = posts[idx];
          let postId = post["id"];
          latestPostID = postId;
          if (latestPostID !== postId) {
            idComp(post);
          }
          else {
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

// // Triggers when a new ride offer is posted
// // It will notify people with the profile setting with the exact rider offer request
// exports.sendMatchingRideNotification = functions.database.ref('/RideOffer')
//   .onWrite((change, context) => {
//     console.log("change: ", change, " ---- context: ", context);
//   })


// exports.deleteOldPosts = functions.https.onRequest((request, response) => {
//   // query the database once and then delete all of the old posts

// });
