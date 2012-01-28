var express = require('express'),
	connect = require('connect'), // http://www.senchalabs.org/connect/
	mongoose = require('mongoose'), //Load library
	mongoStore = require('connect-mongodb'),
	jade = require('jade'),
	stylus = require('stylus'),
	app = module.exports = express.createServer(),
    models = require('./models'),
    db, Document, User, LoginToken;

// Configuration
// Middleware ordering is important
app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({ store: mongoStore(app.get('db-uri')), secret: 'precious' }));
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){ // Configuring different environments
	app.use(express.logger());
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
	app.set('db-uri', 'mongodb://localhost/nodepad-development'); //Instantiate database connection
});

app.configure('production', function(){ // Configuring different environments
	app.use(express.logger());
	app.use(express.errorHandler()); 
	app.set('db-uri', 'mongodb://localhost/nodepad-production'); //Instantiate database connection
});

app.configure('test', function() {
	app.use(express.logger());
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
	app.set('db-uri', 'mongodb://localhost/nodepad-test');
});

// Define models
models.defineModels(mongoose, function() {
	app.Document = Document = mongoose.model('DocumentModel');
	app.User = User = mongoose.model('UserModel');
	app.LoginToken = LoginToken = mongoose.model('LoginTokenModel');
	db = mongoose.connect(app.set('db-uri')); //Instantiate database connection
});

function authenticateFromLoginToken(req, res, next) {
   var cookie = JSON.parse(req.cookies.logintoken);

   LoginToken.findOne({
		email: cookie.email,
		series: cookie.series,
		token: cookie.token
   }, (function(err, token) {
        if (!token) {
            res.redirect('/sessions/new');
            return;
        }

        User.findOne({ email: token.email }, function(err, user) {
			// Get user to sign in
            if (user) {
                req.session.user_id = user.id;
                req.currentUser = user;

				// Renew Token
                token.token = token.randomToken();
                token.save(function() {
                    res.cookie('logintoken', token.cookieValue, {
                        expires: new Date(Date.now() + 2 * 604800000),
                        path: '/'
                    });
                    next();
                });
            } else {
                res.redirect('/sessions/new');
            }
       	});
   	}));
}

function loadUser(req, res, next) {
	// Se já existe uma sessão iniciada com um id
	if (req.session.user_id) {
		User.findById(req.session.user_id, function(err, user) {
			if(!err) {
				// Verifica se o usuário que quer acessar é o dono da sessão
				if (user) {
					 req.currentUser = user;
					 next();
				} else {
					 res.redirect('/sessions/new');
				}
			}
		});
	// Se não existe uma sessão iniciada, verifica os cookies => autentica e faz login
	} else if (req.cookies.logintoken) {
	    	authenticateFromLoginToken(req, res, next);
	// Se nem cookie existe, então o jeito é fazer login
	} else {
		res.redirect('/sessions/new');
	}
}

/*
 * Route: Users
 */
// New
app.get('/users/new', function(req, res) {
	res.render('users/new.jade', {
		locals: { user: new User() }
	});
});

// Create
app.post('/users.:format?', function(req, res) {

    var user = new User(req.body.user);

	function userSaveFailed() {
		req.flash('error', 'Account creation failed');
		res.render('users/new.jade', {
			locals: { user: user }
		});
	}

	user.save( function(err) {
        if(err) return userSaveFailed();
		else {
			switch (req.params.format) {
	        	case 'json':
		            res.send(user.toObject());
	            break;

		        default:
					req.session.user_id = user.id;
		            res.redirect('/');
	        }
		}
    });

});

/*
 * Route: Sessions
 */
// New
app.get('/sessions/new', function(req, res) {
	res.render('sessions/new.jade', {
		locals: { user: new User() }
	});
});

// Create
app.post('/sessions', function(req, res) {
	User.findOne({ email: req.body.user.email }, function(err, user) {
		if(!err) {
			if (user && user.authenticate(req.body.user.password)) {
				req.session.user_id = user.id;

		        // Remember me
   		        if (req.body.remember_me) {
   		            var loginToken = new LoginToken({
   		                email: user.email
   		            });
   		            loginToken.save(function() {
   		                res.cookie('logintoken', loginToken.cookieValue, {
   		                    expires: new Date(Date.now() + 2 * 604800000),
   		                    path: '/'
   		                });
   		                res.redirect('/');
   		            });
   		        } else res.redirect('/');

			} else {
				req.flash('error', 'Incorrect credentials');
				res.redirect('/sessions/new');
			}
		}
	});
});

// Delete
app.del('/sessions', loadUser, function(req, res) {
	if (req.session) { LoginToken.remove({ email: req.currentUser.email }, function() {});
	    res.clearCookie('logintoken');
	    req.session.destroy(function() {});
	}
	res.redirect('/sessions/new');
});

/*
 * Route: Documents
 */
// Home
app.get('/', loadUser, function(req, res) {
	Document.find({}, [], { sort: ['title', 'descending'] }, function(err, docs) {
		if(!err) {
			res.render('documents', {
				locals: { documents: docs }
			});
		}
	});
});

// Edit
app.get('/documents/:id.:format?/edit', loadUser, function(req, res) {
	Document.findById(req.params.id, function(err, doc) {
		if(!err) {
			res.render('documents/edit.jade', {
				locals: { d: doc }
			});
		}
	});
});

// New
app.get('/documents/new', loadUser, function(req, res) {
	res.render('documents/new.jade', {
		locals: { d: new Document() }
	});
});

/* ***CRUD Document*** */
// Create document
app.post('/documents.:format?', loadUser, function(req, res) {
    var d = new Document(req.body.document);
    d.save( function(err) {
        if(!err) {
			switch (req.params.format) {
	        	case 'json':
		            res.send(d.__doc);
	            break;

		        default:
		            res.redirect('/');
	        }
		}
    });
});

// Read document
app.get('/documents/:id.:format?', loadUser, function(req, res) {
    Document.findById(req.params.id, function(err, doc) {
		if(!err) {
	        switch (req.params.format) {
		        case 'json':
		            res.send(doc.__doc);
		            break;

		        default:
		            res.render('documents/show.jade', {
		                locals: { d: doc }
		            });
	        }
		}
    });
});

// Update document
app.put('/documents/:id.:format?', loadUser, function(req, res) {
	// Load the document
	Document.findById(req.body.document.id, function(err, doc) {
		if(!err) {
			// Do something with it
			doc.title = req.body.document.title;
			doc.data = req.body.document.data;

			// Persist the changes
			doc.save( function() {
				// Respond according to the request format
				switch (req.params.format) {
					case 'json':
						res.send(d.__doc);
					break;
					
					default:
						res.redirect('/');
				}
			});
		}
	});
});

// Delete document
app.del('/documents/:id.:format?', loadUser, function(req, res) {
	// Load the document
	Document.findById(req.params.id, function(err, doc) {
		if(!err) {
			// Do something with it
			doc.title = req.params.title;
			doc.data = req.params.data;

			// Persist the changes
			doc.remove( function() {
				// Respond according to the request format
				switch (req.params.format) {
					case 'json':
						res.send(d.__doc);
					break;

					default:
						res.redirect('/');
				}
			});
		}
	});
});

app.listen(3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);

/*
 * Debugging
 */
function removeTokens (tokens) {
	for (t in tokens){
		tokens[t].remove( function() {
			// Respond according to the request format
			switch (tokens[t].format) {
				case 'json':
					res.send(d.__t);
				break;
	
				default:
			}
		});
	}
}

function listTokens (where) {
	LoginToken.find({}, function(err, tokens) {
		if(!err) {
			// removeTokens(tokens);
			console.log('Im at:' + where + '	');
			console.log(tokens);
		}
	});

}

// listTokens('end');