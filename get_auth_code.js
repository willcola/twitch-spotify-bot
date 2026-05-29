/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 */

var express = require('express');
var request = require('request');
var crypto = require('crypto');
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var fs = require('fs');
var path = require('path');
var readline = require('readline');

var configPath = path.join(__dirname, 'config.json');
var redirect_uri = 'http://127.0.0.1:8888/callback'; // Your redirect uri

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
    return {};
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function prompt(question) {
  var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(function(resolve) {
    rl.question(question, function(answer) {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getToken(code, clientId, clientSecret) {
  var url = 'https://accounts.spotify.com/api/token';
  var options = {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (Buffer.from(clientId + ':' + clientSecret).toString('base64'))
    },
    body: 'code=' + encodeURIComponent(code) +
      '&redirect_uri=' + encodeURIComponent(redirect_uri) +
      '&grant_type=authorization_code',
  };

  var res = await fetch(url, options);
  return res.json();
}

async function ensureCredentials() {
  var config = loadConfig();
  var updated = false;

  if (!config.id) {
    config.id = await prompt('Spotify Client ID: ');
    updated = true;
  }
  if (!config.secret) {
    config.secret = await prompt('Spotify Client Secret: ');
    updated = true;
  }

  if (updated) {
    saveConfig(config);
  }

  return config;
}


const generateRandomString = (length) => {
  let d = new Date().getTime()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0
    d = Math.floor(d / 16)
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

var stateKey = 'spotify_auth_state';

async function start() {
  var config = await ensureCredentials();
  var client_id = config.id;
  var client_secret = config.secret;

  var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'app-remote-control',
    'streaming',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-private',
    'playlist-modify-public',
    'user-follow-modify',
    'user-follow-read',
    'user-read-playback-position',
    'user-top-read',
    'user-read-recently-played',
    'user-library-modify',
    'user-library-read',
  ]
  var scope = scopes.join(' ');
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', async function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;

  if (code) {
    var config = loadConfig();
    config.code = code;
    saveConfig(config);

    try {
      var tokenData = await getToken(code, client_id, client_secret);
      if (tokenData.refresh_token) {
        config.refresh_token = tokenData.refresh_token;
        saveConfig(config);
        console.log('Refresh token saved to config.json');
        res.send('Authorization successful. Refresh token saved to config.json.');
        return;
      }
      console.log('Failed to get refresh token:', tokenData);
      res.status(400).send('Authorization code saved but failed to get refresh token.');
      return;
    } catch (err) {
      console.log('Error getting refresh token:', err);
      res.status(500).send('Authorization code saved but error exchanging for tokens.');
      return;
    }
  }
  console.log('Authorization failed');
  res.status(400).send('Authorization failed');
});

app.get('/refresh_token', function(req, res) {

  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64')) 
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token,
          refresh_token = body.refresh_token;
      res.send({
        'access_token': access_token,
        'refresh_token': refresh_token
      });
    }
  });
});

  console.log('Listening on 8888');
  app.listen(8888);
}

start();
