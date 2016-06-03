var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
	username: String,
	auth: {
		access_token: String,
		refresh_token: String
	}

});

module.exports = mongoose.model('user', userSchema);