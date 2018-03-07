var express = require('express');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var rp = require('request-promise');
var rp2 = require('request-promise');
var mysql = require('mysql');

var app = express();

app.engine('handlebars', handlebars({extname: 'handlebars', defaultLayout: 'layout', layoutsDir: __dirname + '/views/layouts'}));
app.set('view engine', 'handlebars');
app.set('port', 8080);

app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());
app.use(express.static('public'));

var pool = mysql.createPool({
	host	: 'localhost',
	user	: 'root',
	password: 'password',
	database: 'database'
});

function homeCtrl(req, res){
	var context = req.dataToSend;
	res.render('index', context);
}

function searchCtrl(req, res, next){
	var allCities = [];
	for (i in req.body.dest)
		allCities.push(req.body.dest[i]);
	
	var ps = [];
	var ps2 = [];
	var latlng = [];
	var dataToSend = { loc: [] }
	
	for (i in allCities)
		ps.push(rp({uri: 'https://maps.googleapis.com/maps/api/geocode/json?address=' + allCities[i] + '&key=AIzaSyCNlgJddg0VQVIqp-oJN1eBgcJjFQ1ED4s', json: true}));
	
	Promise.all(ps)
		.then((results) => {
			if (results[0].status == "ZERO_RESULTS")
				return next();

			for (i in results)
				latlng.push({lat: results[i].results[0].geometry.location.lat, lng: results[i].results[0].geometry.location.lng});
			
			for (j in allCities)
				ps2.push(rp2({uri: 'https://trailapi-trailapi.p.mashape.com/?lat=' + latlng[j].lat + '&limit=3&lon=' + latlng[j].lng + '&radius=25', json: true, headers: {'X-Mashape-Key': '1higgfjDKmmshHywOWWH7zxZXDnsp1dfZi6jsn4qhwTewIZHt9'}}));
			
			Promise.all(ps2)
				.then((results) => {
					for (i in results){
						for (j in results[i].places){
							var name = results[i].places[j].name;
							var directions = "No directions listed.";
							if (results[i].places[j].directions)
								directions = (results[i].places[j].directions.replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
								directions = mysql_real_escape_string(directions);
								directions.replace(/<(?:.|\n)*?>/gm, '');
							var activities = [];
							for (k in results[i].places[j].activities){
								var actType = "No type listed.";
								var actTypeBike;
								var actTypeHike;
								if (results[i].places[j].activities[k].activity_type_name){
									actType = results[i].places[j].activities[k].activity_type_name;
									if (actType == "mountain biking")
										actTypeBike = true;
									else if (actType == "hiking")
										actTypeHike = true;
								}
								var actDesc = "No description listed.";
								actDesc = mysql_real_escape_string(actDesc);
								if (results[i].places[j].activities[k].description){
									actDesc = results[i].places[j].activities[k].description.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<(?:.|\n)*?>/gm, '');
								}
								var pic = results[i].places[j].activities[k].thumbnail;
								var rating = 0;
								var ratingStarFull = []
								var ratingStarEmpty = []
									rating = results[i].places[j].activities[k].rating;
								activities.push({actDesc, pic, rating, actType, actTypeHike, actTypeBike});
								actTypeBike = false;
								actTypeHike = false;
							}
							dataToSend.loc.push({name, directions, activities, latlng});
							req.dataToSend = dataToSend;
						}
					}
					return next();
				}).catch(err => console.log(err));
			
		}).catch(err => console.log(err));
}

app.get('/', homeCtrl);

app.post('/search', searchCtrl, homeCtrl);

app.get('/favorites', function(req, res){
	var context = { list: [] }
	pool.query('SELECT id, name, dir, rating FROM loc', function(err, rows, fields){
		if (!err){
			var actTypeHike;
			var actTypeBike;


			for (var i in rows){
				var id = rows[i].id;
				var name = rows[i].name;
				var dir = rows[i].dir;
				if (dir == "mountain biking")
					actTypeBike = true;
				if (dir == "hiking")
					actTypeHike = true;

				var rating = rows[i].rating;
				context.list.push({id, name, dir, rating, actTypeBike, actTypeHike});
			}
			res.render('favorites', context);
		}
		else
			console.log(err);
	});
});

app.post('/removeFavorite', function(req, res){
	var context = { list: [] }
	pool.query('DELETE FROM loc WHERE id=?', [req.body.postId], function(err, rows, fields){
		if (!err){
			res.redirect('/favorites');
		}
		else{
			console.log(err);
		}
	});
});

app.get('/addFavorite', function(req, res){
	res.redirect('/favorites');
});

app.get('/search', function(req, res){
	res.redirect('/');
});

app.post('/addFavorite', function(req, res){
	var context = { list: [] }
	pool.query('INSERT INTO loc (name, dir, rating) VALUES (?,?,?)', [req.body.postName, req.body.postActType, req.body.postRating], function(err, rows, fields){
		if (!err){
			res.redirect('/favorites');
		}
		else
			console.log(err);
	});
});

app.use(function(req, res){
	res.status(404);
	res.render('404');
});

app.use(function(err, req, res, next){
	console.error(err.stack);
	res.type('text/plain');
	res.status(500);
	res.render('500');
});

app.listen(app.get('port'), function() {
	console.log('Listening on port ' + app.get('port'));
});

function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char;
        }
    });
}