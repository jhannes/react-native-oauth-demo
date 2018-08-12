const express = require('express');
const app = express();
const bodyParser = require('body-parser'); // npm install --save body-parse
const fetch = require('node-fetch'); // npm install --save node-fetch
const qs = require('qs'); // npm install --save qs

app.use(bodyParser.urlencoded());

const Config = require('./env');

app.get('/oauth2/:loginProvider/oauth2callback', (req, res) => {
    res.redirect('myoauth2app://myapp.com' + req.url);
});


const loginProviders = {
    // For configuration values, see https://accounts.google.com/.well-known/openid-configuration
    // For Administration, see https://console.developers.google.com/apis/credentials
    google: {
        client_secret: Config.GOOGLE_CLIENT_SECRET,
        token_endpoint: 'https://accounts.google.com/o/oauth2/token'
    },
    // For configuration values, see https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration
    // For Administration, see https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps
    azure: {
        client_secret: Config.AZURE_CLIENT_SECRET,
        token_endpoint: 'https://login.microsoftonline.com/common/oauth2/token'
    }
};

function base64decode(encoded) {
    return new Buffer(encoded, 'base64').toString('ascii');
}

app.post('/oauth2/:loginProvider/token', (req, res) => {
    const {client_id, code, code_verifier, redirect_uri, grant_type} = req.body;
    const {loginProvider} = req.params;

    const configuration = loginProviders[loginProvider];
    const {token_endpoint, client_secret} = configuration;

    const payload = qs.stringify({client_id, client_secret, code, redirect_uri, grant_type, code_verifier, grant_type});
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
        const id_token = JSON.parse(base64decode(tokenResponse.id_token.split('.')[1]));
        console.log(id_token);
        res.send({
            username: id_token.name || id_token.email
        });
    }).catch(err => console.error);
});



app.listen(3000, () => console.log('Example app listening on port 3000!'))
