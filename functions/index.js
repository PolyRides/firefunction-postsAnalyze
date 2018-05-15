// Packages
const functions = require('firebase-functions');
var admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
var natural = require('natural');
var req = require('request');


// Initializer
var tokenizer = new natural.WordTokenizer();
var classifier = new natural.BayesClassifier();

// Training Data
classifier.addDocument('Offering  SLO -> SB Tomorrow (Friday) at 5 Returning Saturday afternoon', 'Ride Offer');
classifier.addDocument("OFFERING: Friday 5/4/2018 7pm CAL POLY >>>>> SGV / 626 / LA Sunday 5/6/2018 12pm SGV / 626 >>> CAL POLY $20 HMU", 'Ride Offer');
classifier.addDocument("seeking: May 11th (anytime after 12): SLO to Berkeley  May 13th (anytime): Berkeley to SLO  This is for my older sister's graduation so please let me know if anyone his heading up to Berkeley(-:", 'Ride Seeking');

classifier.train();

// Database connection
var database = admin.database();

var postsExternalIdArray = [];
var postsInternalIdArray = [];
var processedPostsIdArray = [];


// Mock data
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



// Compute function is handling the main logics of NLP
// Returns the processed result back
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
// Posts analyze firebase function when Posts are updated
exports.ProcessCreatedPosts = functions.database.ref('/Posts')
    .onCreate(snapshot => {   

      // Edit value whenever there is a change
      const original = snapshot.val();
      console.log(processedPostsIdArray, " <<< is the original value")
      for(var key in original) {
        // The item processed must be in the postIdArray and not in the processedPostsIdArray to make sure all of the posts are valid and not processed

        if (!processedPostsIdArray.includes(key)) {
          // && (!postsInternalIdArray.includes(key) || !postsInternalIdArray.length)) {
          var message = original[key]["message"];
          var object = processInfo(message, key);

          // Handling the deletion and addition of the data
          processedPostsIdArray.push(key);
          snapshot.ref.child(key).remove()

          // Post to the RideOffer Collections
          return snapshot.ref.parent.child('RideOffer/').push(object)
        }
      }
      return null;
    });



// // Posts analyze firebase function when Posts are updated
// exports.ProcessUpdatedPosts = functions.database.ref('/Posts')
//     .onUpdate(snapshot => {   

//       // Edit value whenever there is a change
//       const original = snapshot.change.val();
//       console.log(processedPostsIdArray, " <<< is the original value")
//       for(var key in original) {
//         // The item processed must be in the postIdArray and not in the processedPostsIdArray to make sure all of the posts are valid and not processed

//         if (!processedPostsIdArray.includes(key) && (!postsInternalIdArray.includes(key) || !postsInternalIdArray.length)) {
//           var message = original[key]["message"]
//           var object = compute(message, key);

//           processedPostsIdArray.push(key);
//           snapshot.change.ref.child(key).remove()
//           // Post to the RideOffer Collections
//           return snapshot.change.ref.parent.child('RideOffer/').push(object)
//         }
//       }
//       return null;
//     });


// Calls the API to actually gets the posts information and add that posts information into posts collection in the database
exports.QueryPostAPI = functions.https.onRequest((request, response) => {
  req('https://us-central1-posts-6706e.cloudfunctions.net/restAPI', function (error, resp, body) {
    if (!error && response.statusCode === 200) {
      response.setHeader('Content-Type', 'application/json');

      // Push posts to the Posts collections
      // Parse data
      posts = JSON.parse(body);
      // Post data
      posts.data.map(post => {
        
        postId = post["id"]; 
        
        // Only add new posts
        if (!postsExternalIdArray.includes(postId)) {
          // Gets the value references
          var newPostRef = database.ref("Posts/").push({
          // Gets all of the required fields
            created_time: post["created_time"],
            id: postId,
            message: post["message"]
          });

          // Put new item to the postsIdArray to be tracked
          postsExternalIdArray.push(postId);
          postsInternalIdArray.push(newPostRef.key);
        }
      })
      
      response.send({postids: postsInternalIdArray, processed: processedPostsIdArray, externalIDs: postsExternalIdArray});
      response.end();
    } else {
      response.statusCode = 404;
      response.end();
    }

    // response.send("DONE");
  });
});
