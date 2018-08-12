const express = require('express');
const app = express();
const bodyParser = require('body-parser'); // npm install --save body-parse
const fetch = require('node-fetch'); // npm install --save node-fetch
const qs = require('qs'); // npm install --save qs

app.use(bodyParser.urlencoded());


app.get('/oauth2/:loginProvider/oauth2callback', (req, res) => {
    res.redirect('myoauth2app://myapp.com' + req.url);
});


const loginProviders = {
    // For configuration values, see https://accounts.google.com/.well-known/openid-configuration
    // For Administration, see https://console.developers.google.com/apis/credentials
    google: {
        client_secret: 's7qwbqSFB457ylHYrVhhDGj3',
        token_endpoint: 'https://accounts.google.com/o/oauth2/token',
        grant_type: 'authorization_code'
    }
};

function base64decode(encoded) {
    return new Buffer(encoded, 'base64').toString('ascii');
}

app.post('/oauth2/:loginProvider/token', (req, res) => {
    const {client_id, code, code_verifier, redirect_uri} = req.body;
    const {loginProvider} = req.params;

    const configuration = loginProviders[loginProvider];
    const {token_endpoint, client_secret, grant_type} = configuration;

    const payload = qs.stringify({client_id, client_secret, code, redirect_uri, grant_type, code_verifier});
    console.log(payload);

    fetch(token_endpoint, {
        method: 'POST',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        },
        body: payload
    }).then(response => {
        console.log(response.status);
        return response.json();
    }).then(tokenResponse => {
        console.log(tokenResponse);
        const idToken = JSON.parse(base64decode(tokenResponse.id_token.split('.')[1]));
        res.send({
            username: idToken.email
        });
    }).catch(err => console.error);
});



app.listen(3000, () => console.log('Example app listening on port 3000!'))
