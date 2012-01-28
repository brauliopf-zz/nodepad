// Mongoose 1.0 models are defined using Schema objects.
// Once they’ve been defined it’s possible to decorate them with virtual attributes and middleware.
// Virtual attributes are getters and setters, and middleware is a convenient way of injecting functions into key lifecycle events.

var crypto = require('crypto');

function defineModels(mongoose, fn){
	var	Schema = mongoose.Schema
	  ,	ObjectId = Schema.ObjectId;

	/*
	 * Model: Document
	 */
	var DocumentSchema = new Schema({
		'title': { type: String, index: true },
		'data': String,
		'tags': [String],
		'keywords': [String],
		'user_id': ObjectId
	});

	DocumentSchema.virtual('id').get(function() {
		return this._id.toHexString();
	});

	// DocumentSchema.pre('save', function(next) {
	// 	this.keywords = extractKeywords(this.data);
	// 	next();
	// });

	//tell mongoose about the schema I just created
	mongoose.model('DocumentModel', DocumentSchema);
	
	/*
	 * Model: User
	 */
	function validatePresenceOf(value) {
		return value && value.length;
	}
	
	var UserSchema = new Schema({
		'email': { type: String, validate: [validatePresenceOf, 'an email is required'], index: { unique: true } },
		'hashed_password': String,
		'salt': String
	});

	UserSchema.virtual('id').get(function() {
		return this._id.toHexString();
	});

	UserSchema.virtual('password')
		.set(function(password) {
			this._password = password;
			this.salt = this.makeSalt();
			this.hashed_password = this.encryptPassword(password);
		})
		.get(function() { 
			return this._password;
		});
	
	UserSchema.method('authenticate', function(plainText) {
		return this.encryptPassword(plainText) === this.hashed_password;
	});

	UserSchema.method('makeSalt', function() {
		return Math.round((new Date().valueOf() * Math.random())) + '';
    });

	UserSchema.method('encryptPassword', function(password) {
		return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
    });

	UserSchema.pre('save', function(next) {
		if (!validatePresenceOf(this.password)) {
			next(new Error('Invalid password'));
		} else {
			next();
		}
	});

	//tell mongoose about the schema I just created
	mongoose.model('UserModel', UserSchema);

	/*
	 * Model: LoginToken
	 * Used ofr session persistence
	 */
	var LoginTokenSchema = new Schema({
	    email: {
	        type: String,
	        index: true
	    },
	    series: {
	        type: String,
	        index: true
	    },
	    token: {
	        type: String,
	        index: true
	    }
	});

	LoginTokenSchema.method('randomToken', function() {
	    return Math.round((new Date().valueOf() * Math.random())) + '';
	});

	LoginTokenSchema.pre('save', function(next) {
	    // Automatically create the tokens
	    this.token = this.randomToken();

	    if (this.isNew)
			this.series = this.randomToken();

	    next();
	});

	LoginTokenSchema.virtual('id').get(function() {
	    		return this._id.toHexString();
			});

	LoginTokenSchema.virtual('cookieValue').get(function() {
	    return JSON.stringify({
	        email: this.email,
	        token: this.token,
	        series: this.series
	    });
	});
	
	mongoose.model('LoginTokenModel', LoginTokenSchema);
	
	fn();
}

exports.defineModels = defineModels;