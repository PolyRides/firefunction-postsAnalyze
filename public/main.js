
<script src="https://www.gstatic.com/firebasejs/5.0.4/firebase.js"></script>

<script>
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
  var database = firebase.database();

  function getData() {
    let rideOfferReference = database.ref("/RideOffer");
    rideOfferReference.once("value", function (snap) {
      console.log("value: ", snap.val());
    })
  }

  function print() {
    alert("hello world");
  }
  
  firebase.auth().signInWithEmailAndPassword(email, password).catch(function (error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // ...
  });
</script>