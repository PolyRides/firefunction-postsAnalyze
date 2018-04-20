const functions = require('firebase-functions');
var admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

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

var database = admin.database();

exports.PolyRideShareAPI = functions.https.onRequest((request, response) => {
	// var rideOfferRef = database.ref();

	// Put mock data to the firebase realtime database
	// riderO
	database.ref("RideOffer/").push({rideOffermockData})
	response.send("DONE");

})