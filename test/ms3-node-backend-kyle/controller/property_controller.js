var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var secret = require('../secret/secret.json')
var jwt = require('jsonwebtoken');

const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.use(function timeLog (req, res, next) {
  console.log('In Properties Controller @ Time: ', Date.now());
  next();
});

router.route('/')

		.post(function(req, res){

		});


router.route('/:id')

		.delete(function(req, res){
			var valid = true;
			var token = '';
			var decoded = {};

			// sync verify if token valid
			try {
				token = req.get('token');
				decoded = jwt.verify(token, secret.token_secret);
				if (decoded.data.id === undefined || decoded.data.email === undefined || decoded.data.type === undefined) {
					console.log('Missing JWT Payload Property');
					throw new Error('Missing JWT Payload Property');
				}
			} catch (err) {
				valid = false;
				res.status(401);
				res.json({ message: 'Invalid Auth Token' });
			}

			// for users, check if password property in request body
			if (valid === true) {
				if (decoded.data.type === 'user') {
					if (req.body.password === undefined) {
						valid = false;
						console.log('Missing Password');
						res.status(400);
						res.json({ message: 'Malformed Request' });
					}
				}
			}

			// check if token in token blacklist
			if (valid === true) {
				const query = datastore.createQuery('Token_Blacklist_V1').filter('token', '=', token);
				datastore.runQuery(query, function(err, entities) {
					if (err) {
						valid = false;
						console.log('Error Running Token Blacklist Query');
						res.status(500);
						res.json({ message: 'Internal Server Error' });
					} else {
						if (entities.length != 0) {
							valid = false;
							console.log('Token Blacklisted');
							res.status(401);
							res.json({ message: 'Invalid Auth Token' });	
				        }
		            }
				});
			}
			
			// if is user request, verify user owns the listing


		});



