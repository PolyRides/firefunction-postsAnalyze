(function() {
  // Initialize Firebase
  var config = {
    apiKey: "AIzaSyBmhHML9QsZlDj5hIbFZ7Pj4gLdiQ1HSP0",
    authDomain: "postsanalyze-69dd1.firebaseapp.com",
    databaseURL: "https://postsanalyze-69dd1.firebaseio.com",
    projectId: "postsanalyze-69dd1",
    storageBucket: "postsanalyze-69dd1.appspot.com",
    messagingSenderId: "67818150244"
  };
	firebase.initializeApp(config);
	
	// Get elements
	const preObject = document.getElementById("object");

	// Create Reference
	const dbRef = firebase.database().ref().child("RideOffer");

	// Sync object changes
	dbRef.on("value", snap => {
		console.log("snap value: ", snap.val());
	})
}());