const functions = require('firebase-functions');
<<<<<<< HEAD
// const spacyNLP = require("spacy-nlp");
var admin = require('firebase-admin');
var nlp = require('compromise')
var speak = require("speakeasy-nlp");
// const nlp = spacyNLP.nlp;
admin.initializeApp(functions.config().firebase);

var database = admin.database();
=======
var admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
>>>>>>> d89c764a7d51d97037197ae653ce5712df08a409

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

<<<<<<< HEAD

exports.ProcessPost = functions.database.ref('/posts/')
    .onCreate((snapshot, context) => {
      // Grab the current value of what was written to the Realtime Database.
      const original = snapshot.val();
      console.log('Uppercasing', context.params.pushId, original);
      const uppercase = original.toUpperCase();
      // You must return a Promise when performing asynchronous tasks inside a Functions such as
      // writing to the Firebase Realtime Database.
      // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
      // var doc = original.replace('$', "")
      // var result = nlp(doc)
      // nlp.parse(original).then(output => {
      //   console.log(output);
      //   return snapshot.ref.parent.child('RideOffer/').push({output})
      // })
      // .catch(error => {
      //   console.log(error);
      // })
      // return "DONE";
      var result = speak.classify(original)
      console.log(result, " <<< is the result")
      return snapshot.ref.parent.child('RideOffer/').push({result})
      // 
    });

exports.CreatePost = functions.https.onRequest((request, response) => {
  // var rideOfferRef = database.ref();

  // Put mock data to the firebase realtime database
  // riderO
  database.ref("RideOffer/").push({rideOffermockData})
  response.send("DONE");
=======
var database = admin.database();

exports.PolyRideShareAPI = functions.https.onRequest((request, response) => {
	// var rideOfferRef = database.ref();

	// Put mock data to the firebase realtime database
	// riderO
	database.ref("RideOffer/").push({rideOffermockData})
	response.send("DONE");
>>>>>>> d89c764a7d51d97037197ae653ce5712df08a409

})